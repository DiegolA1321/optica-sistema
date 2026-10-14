-- Factura electrónica (rama ventas-v2): guardar y entregar la que la óptica emite por fuera. El sistema NO emite facturas electrónicas.
-- BORRADOR: se muestra a Diego antes de aplicarse (protocolo de siempre: respaldo con pg_dump, ensayo en transacción con
-- scripts/ensayo-0110.mjs, verificación con sesiones reales). Propuesta aprobada: docs/propuesta-factura-electronica.md.
--
-- Qué hace
--   1. Cuatro tablas nuevas, ninguna con escritura directa (solo por las funciones de abajo):
--        facturas_electronicas          una por comprobante: clave de acceso (49 dígitos) y fecha de autorización.
--        facturas_electronicas_archivos cada archivo (RIDE en PDF y XML autorizado) y cada versión: un archivo reemplazado NO se borra
--                                       (los documentos se conservan 7 años); el vigente es el último de cada tipo.
--        enlaces_descarga               enlaces seguros de descarga (WhatsApp): solo se guarda el HASH del código; vencen (7 días) y se revocan.
--        facturas_electronicas_eventos  registro de cada registro, reemplazo, descarga y envío (quién y cuándo).
--   2. Bucket de almacenamiento PRIVADO `facturas-electronicas` (5 MB; PDF y XML) con políticas: ver con Ventas "ver", subir con Ventas
--      "editar", y nadie borra ni sobrescribe. El paciente no tiene acceso directo: baja sus archivos por una Edge Function que valida su sesión.
--   3. Funciones: guardar_factura_electronica (valida la clave y los archivos en el servidor), crear_enlaces_factura, revocar_enlaces_factura,
--      registrar_evento_factura_electronica, mis_compras_paciente (para el portal) y dos que solo puede llamar la Edge Function
--      (resolver_enlace_descarga y autorizar_descarga_paciente).
--
-- COMPATIBLE CON LA VERSIÓN PUBLICADA: no cambia ninguna tabla, función ni política existente. `registrar_factura_electronica` (solo el número)
-- sigue funcionando igual.

-- ════════════════════════════════════════════════════════════════
-- 1. Tablas
-- ════════════════════════════════════════════════════════════════
create table public.facturas_electronicas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null unique references public.facturas_venta(id) on delete cascade,
  clave_acceso text check (clave_acceso ~ '^[0-9]{49}$'),
  autorizada_el date,
  registrada_por uuid references public.perfiles(id) on delete set null,
  registrada_en timestamptz not null default now(),
  actualizada_en timestamptz not null default now()
);
-- Una clave de acceso identifica una sola factura dentro de la óptica.
create unique index facturas_electronicas_clave_unica on public.facturas_electronicas (optica_id, clave_acceso) where clave_acceso is not null;

create table public.facturas_electronicas_archivos (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  tipo text not null check (tipo in ('pdf', 'xml')),
  ruta text not null unique,
  bytes integer not null check (bytes > 0 and bytes <= 5242880),
  subido_por uuid references public.perfiles(id) on delete set null,
  subido_en timestamptz not null default clock_timestamp(), -- la hora real: dos versiones de un mismo trámite no empatan
  constraint facturas_electronicas_archivos_xml_tamano check (tipo <> 'xml' or bytes <= 2097152)
);
create index facturas_electronicas_archivos_factura_idx on public.facturas_electronicas_archivos (factura_id, tipo, subido_en desc);

create table public.enlaces_descarga (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  tipo text not null check (tipo in ('pdf', 'xml')),
  token_hash text not null unique,
  expira_en timestamptz not null,
  revocado_en timestamptz,
  usos integer not null default 0,
  creado_por uuid references public.perfiles(id) on delete set null,
  creado_en timestamptz not null default now()
);
create index enlaces_descarga_factura_idx on public.enlaces_descarga (factura_id);

create table public.facturas_electronicas_eventos (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  accion text not null check (accion in ('registro', 'reemplazo', 'descarga_pdf', 'descarga_xml', 'impresion', 'envio_whatsapp', 'envio_correo', 'descarga_enlace', 'descarga_paciente')),
  actor_perfil uuid references public.perfiles(id) on delete set null,
  actor_paciente uuid,
  detalle text,
  creado_en timestamptz not null default now()
);
create index facturas_electronicas_eventos_factura_idx on public.facturas_electronicas_eventos (factura_id, creado_en);

-- Lectura: personal de la misma óptica (activa, con MFA) con el nivel "ver" de Ventas. Escritura: nadie directamente. Los enlaces no se leen nunca.
alter table public.facturas_electronicas enable row level security;
alter table public.facturas_electronicas_archivos enable row level security;
alter table public.facturas_electronicas_eventos enable row level security;
alter table public.enlaces_descarga enable row level security;

create policy facturas_electronicas_select on public.facturas_electronicas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and tiene_permiso('ventas', 'ver'));
create policy facturas_electronicas_archivos_select on public.facturas_electronicas_archivos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and tiene_permiso('ventas', 'ver'));
create policy facturas_electronicas_eventos_select on public.facturas_electronicas_eventos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and tiene_permiso('ventas', 'ver'));
create policy facturas_electronicas_superadmin on public.facturas_electronicas for all using (es_superadmin()) with check (es_superadmin());
create policy facturas_electronicas_archivos_superadmin on public.facturas_electronicas_archivos for all using (es_superadmin()) with check (es_superadmin());
create policy facturas_electronicas_eventos_superadmin on public.facturas_electronicas_eventos for all using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.facturas_electronicas as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.facturas_electronicas_archivos as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.facturas_electronicas_eventos as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());

revoke all on public.facturas_electronicas, public.facturas_electronicas_archivos, public.facturas_electronicas_eventos, public.enlaces_descarga from anon;
revoke insert, update, delete, truncate on public.facturas_electronicas, public.facturas_electronicas_archivos, public.facturas_electronicas_eventos from authenticated;
revoke all on public.enlaces_descarga from authenticated;

-- ════════════════════════════════════════════════════════════════
-- 2. Almacenamiento privado
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('facturas-electronicas', 'facturas-electronicas', false, 5242880, array['application/pdf', 'application/xml', 'text/xml']);

-- Ver: personal de la misma óptica con Ventas "ver" (la primera carpeta de la ruta es la óptica). Subir: con Ventas "editar".
-- No hay políticas de update ni de delete: un documento no se borra ni se sobrescribe (un reemplazo es un archivo nuevo).
create policy facturas_electronicas_lectura_staff on storage.objects for select
  using (bucket_id = 'facturas-electronicas' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('ventas', 'ver')))));
create policy facturas_electronicas_escritura_staff on storage.objects for insert
  with check (bucket_id = 'facturas-electronicas' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('ventas', 'editar')))));

-- ════════════════════════════════════════════════════════════════
-- 3. Comprobaciones de la clave de acceso (las mismas de la pantalla, src/utilidades/facturaElectronica.js)
-- ════════════════════════════════════════════════════════════════
-- Dígito verificador (módulo 11): pesos 2 a 7 de derecha a izquierda sobre los primeros 48 dígitos; 11 → 0 y 10 → 1.
create function public.digito_verificador_clave(p_base text)
returns integer
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_suma integer := 0;
  v_peso integer := 2;
  v_d integer;
begin
  for i in reverse length(p_base)..1 loop
    v_suma := v_suma + substr(p_base, i, 1)::integer * v_peso;
    v_peso := case when v_peso = 7 then 2 else v_peso + 1 end;
  end loop;
  v_d := 11 - (v_suma % 11);
  return case when v_d = 11 then 0 when v_d = 10 then 1 else v_d end;
end;
$function$;

-- Devuelve el motivo si la clave no sirve (o null si está bien). `p_numero` (opcional) se cruza con la serie y el secuencial de la clave.
create function public.error_de_clave_acceso(p_clave text, p_numero text default null)
returns text
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_numero text := regexp_replace(coalesce(p_numero, ''), '[\s-]', '', 'g');
  v_propio text;
  v_fecha date;
begin
  if p_clave is null or p_clave !~ '^[0-9]{49}$' then
    return 'La clave de acceso debe tener 49 dígitos.';
  end if;
  if digito_verificador_clave(substr(p_clave, 1, 48)) <> substr(p_clave, 49, 1)::integer then
    return 'La clave de acceso no es válida: el dígito verificador debería ser ' || digito_verificador_clave(substr(p_clave, 1, 48)) || '.';
  end if;
  begin
    v_fecha := to_date(substr(p_clave, 1, 8), 'DDMMYYYY');
    if to_char(v_fecha, 'DDMMYYYY') <> substr(p_clave, 1, 8) or v_fecha < date '2000-01-01' then
      return 'La fecha dentro de la clave de acceso no es válida.';
    end if;
  exception when others then
    return 'La fecha dentro de la clave de acceso no es válida.';
  end;
  if substr(p_clave, 9, 2) <> '01' then
    return 'La clave de acceso no es de una factura (el tipo de comprobante debe ser 01).';
  end if;
  v_propio := substr(p_clave, 25, 6) || substr(p_clave, 31, 9);
  if v_numero ~ '^[0-9]{15}$' and v_numero <> v_propio then
    return 'La clave de acceso es de la factura ' || substr(v_propio, 1, 3) || '-' || substr(v_propio, 4, 3) || '-' || substr(v_propio, 7, 9) || ', no de la que escribiste.';
  end if;
  return null;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- 4. Registrar o corregir la factura electrónica de un comprobante (Ventas "editar")
--    Los archivos se suben antes al bucket (la política lo permite solo con "editar"); aquí se comprueba que existan y se registran.
-- ════════════════════════════════════════════════════════════════
create function public.guardar_factura_electronica(
  p_factura_id uuid,
  p_numero text,
  p_clave text default null,
  p_autorizada date default null,
  p_pdf_ruta text default null,
  p_pdf_bytes integer default null,
  p_xml_ruta text default null,
  p_xml_bytes integer default null
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_f record;
  v_numero text := nullif(btrim(p_numero), '');
  v_clave text := nullif(regexp_replace(coalesce(p_clave, ''), '[\s-]', '', 'g'), '');
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_error text;
  v_id uuid;
  v_nuevo boolean;
  v_prefijo text;
begin
  select * into v_f from facturas_venta where id = p_factura_id;
  if not found then raise exception 'La venta no existe.'; end if;
  if es_superadmin() then
    v_optica := v_f.optica_id;
  else
    v_optica := optica_de_vendedor('editar');
    if v_f.optica_id <> v_optica then raise exception 'La venta no existe.'; end if;
  end if;
  if v_f.estado = 'anulada' then raise exception 'La venta está anulada.'; end if;
  if v_numero is not null and char_length(v_numero) > 60 then raise exception 'El número de la factura electrónica es demasiado largo.'; end if;
  if v_numero is null and (v_clave is not null or p_pdf_ruta is not null or p_xml_ruta is not null or p_autorizada is not null) then
    raise exception 'Escribe el número de la factura electrónica.';
  end if;

  if v_clave is not null then
    v_error := error_de_clave_acceso(v_clave, v_numero);
    if v_error is not null then raise exception '%', v_error; end if;
  end if;
  if p_autorizada is not null then
    if p_autorizada > v_hoy then raise exception 'La fecha de autorización no puede ser futura.'; end if;
    if p_autorizada < (v_f.created_at at time zone 'America/Guayaquil')::date then raise exception 'La fecha de autorización no puede ser anterior a la de la venta.'; end if;
  end if;

  -- El número de la factura (el mismo campo de siempre; único entre las ventas vigentes de la óptica).
  begin
    update facturas_venta set factura_electronica = v_numero where id = p_factura_id;
  exception when unique_violation then
    raise exception 'Ese número de factura electrónica ya está registrado en otra venta.';
  end;

  if v_numero is null then
    return null; -- sin número no hay factura electrónica que guardar (se quitó)
  end if;

  v_prefijo := v_optica::text || '/' || p_factura_id::text || '/';
  select id into v_id from facturas_electronicas where factura_id = p_factura_id;
  v_nuevo := v_id is null;
  begin
    if v_nuevo then
      insert into facturas_electronicas (optica_id, factura_id, clave_acceso, autorizada_el, registrada_por)
      values (v_optica, p_factura_id, v_clave, p_autorizada, auth.uid()) returning id into v_id;
    else
      update facturas_electronicas set clave_acceso = v_clave, autorizada_el = p_autorizada, actualizada_en = now() where id = v_id;
    end if;
  exception when unique_violation then
    raise exception 'Esa clave de acceso ya está registrada en otra venta.';
  end;

  -- Archivos: cada uno debe estar ya en el bucket, dentro de la carpeta de esta venta; un reemplazo agrega una versión nueva.
  if p_pdf_ruta is not null then
    if left(p_pdf_ruta, length(v_prefijo)) <> v_prefijo or p_pdf_ruta !~* '\.pdf$' then raise exception 'La ruta del PDF no es válida.'; end if;
    if p_pdf_bytes is null or p_pdf_bytes <= 0 or p_pdf_bytes > 5242880 then raise exception 'El PDF (RIDE) debe pesar hasta 5 MB.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'facturas-electronicas' and o.name = p_pdf_ruta) then raise exception 'El PDF no se subió: vuelve a intentarlo.'; end if;
    insert into facturas_electronicas_archivos (optica_id, factura_id, tipo, ruta, bytes, subido_por) values (v_optica, p_factura_id, 'pdf', p_pdf_ruta, p_pdf_bytes, auth.uid());
    insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_perfil, detalle) values (v_optica, p_factura_id, 'registro', auth.uid(), 'PDF (RIDE)');
  end if;
  if p_xml_ruta is not null then
    if left(p_xml_ruta, length(v_prefijo)) <> v_prefijo or p_xml_ruta !~* '\.xml$' then raise exception 'La ruta del XML no es válida.'; end if;
    if p_xml_bytes is null or p_xml_bytes <= 0 or p_xml_bytes > 2097152 then raise exception 'El XML debe pesar hasta 2 MB.'; end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'facturas-electronicas' and o.name = p_xml_ruta) then raise exception 'El XML no se subió: vuelve a intentarlo.'; end if;
    insert into facturas_electronicas_archivos (optica_id, factura_id, tipo, ruta, bytes, subido_por) values (v_optica, p_factura_id, 'xml', p_xml_ruta, p_xml_bytes, auth.uid());
    insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_perfil, detalle) values (v_optica, p_factura_id, 'registro', auth.uid(), 'XML');
  end if;
  insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_perfil, detalle)
  values (v_optica, p_factura_id, case when v_nuevo then 'registro' else 'reemplazo' end, auth.uid(), case when v_nuevo then 'Registró el número y la clave de acceso' else 'Corrigió los datos' end);
  return v_id;
end;
$function$;
revoke all on function public.guardar_factura_electronica(uuid, text, text, date, text, integer, text, integer) from public, anon;
grant execute on function public.guardar_factura_electronica(uuid, text, text, date, text, integer, text, integer) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. Registrar un evento (descarga, impresión, envío) — Ventas "ver"
-- ════════════════════════════════════════════════════════════════
create function public.registrar_evento_factura_electronica(p_factura_id uuid, p_accion text, p_detalle text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('ver');
begin
  if p_accion not in ('descarga_pdf', 'descarga_xml', 'impresion', 'envio_correo') then raise exception 'Acción no válida.'; end if;
  if not exists (select 1 from facturas_venta f where f.id = p_factura_id and f.optica_id = v_optica) then raise exception 'La venta no existe.'; end if;
  -- Enviar por correo es una acción de "editar"; descargar e imprimir, de "ver".
  if p_accion = 'envio_correo' and not tiene_permiso('ventas', 'editar') then raise exception 'No tienes permiso para esta acción de ventas.'; end if;
  insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_perfil, detalle) values (v_optica, p_factura_id, p_accion, auth.uid(), left(p_detalle, 200));
end;
$function$;
revoke all on function public.registrar_evento_factura_electronica(uuid, text, text) from public, anon;
grant execute on function public.registrar_evento_factura_electronica(uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 6. Enlaces seguros de descarga (WhatsApp): vencen y se revocan. El código se devuelve UNA vez; en la base queda su hash.
-- ════════════════════════════════════════════════════════════════
create function public.crear_enlaces_factura(p_factura_id uuid, p_dias integer default 7)
returns table (tipo text, token text, expira_en timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_t text;
  v_codigo text;
  v_vence timestamptz;
begin
  if p_dias is null or p_dias < 1 or p_dias > 30 then raise exception 'El enlace puede durar de 1 a 30 días.'; end if;
  if not exists (select 1 from facturas_venta f where f.id = p_factura_id and f.optica_id = v_optica and f.estado <> 'anulada') then raise exception 'La venta no existe.'; end if;
  v_vence := now() + make_interval(days => p_dias);
  for v_t in select a.tipo from facturas_electronicas_archivos a where a.factura_id = p_factura_id group by a.tipo order by a.tipo loop
    v_codigo := encode(extensions.gen_random_bytes(24), 'hex');
    insert into enlaces_descarga (optica_id, factura_id, tipo, token_hash, expira_en, creado_por)
    values (v_optica, p_factura_id, v_t, encode(extensions.digest(v_codigo, 'sha256'), 'hex'), v_vence, auth.uid());
    tipo := v_t; token := v_codigo; expira_en := v_vence;
    return next;
  end loop;
  if not found then raise exception 'Adjunta primero el PDF o el XML de la factura.'; end if;
  insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_perfil, detalle) values (v_optica, p_factura_id, 'envio_whatsapp', auth.uid(), 'Enlace por ' || p_dias || ' días');
end;
$function$;
revoke all on function public.crear_enlaces_factura(uuid, integer) from public, anon;
grant execute on function public.crear_enlaces_factura(uuid, integer) to authenticated;

create function public.revocar_enlaces_factura(p_factura_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_n integer;
begin
  update enlaces_descarga set revocado_en = now() where factura_id = p_factura_id and optica_id = v_optica and revocado_en is null and expira_en > now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$;
revoke all on function public.revocar_enlaces_factura(uuid) from public, anon;
grant execute on function public.revocar_enlaces_factura(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 7. Para la Edge Function de entrega (solo ella, con la clave de servicio): no las puede llamar nadie más
-- ════════════════════════════════════════════════════════════════
-- Valida un enlace (existe, no venció, no se revocó), cuenta el uso y devuelve el archivo vigente de ese tipo.
create function public.resolver_enlace_descarga(p_token text)
returns table (ruta text, tipo text, numero text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_e record;
  v_ruta text;
begin
  select * into v_e from enlaces_descarga e where e.token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or v_e.revocado_en is not null or v_e.expira_en <= now() then return; end if;
  if not exists (select 1 from facturas_venta f where f.id = v_e.factura_id and f.estado <> 'anulada') then return; end if;
  select a.ruta into v_ruta from facturas_electronicas_archivos a where a.factura_id = v_e.factura_id and a.tipo = v_e.tipo order by a.subido_en desc limit 1;
  if v_ruta is null then return; end if;
  update enlaces_descarga set usos = usos + 1 where id = v_e.id;
  insert into facturas_electronicas_eventos (optica_id, factura_id, accion, detalle) values (v_e.optica_id, v_e.factura_id, 'descarga_enlace', upper(v_e.tipo));
  return query select v_ruta, v_e.tipo, (select f.factura_electronica from facturas_venta f where f.id = v_e.factura_id);
end;
$function$;
revoke all on function public.resolver_enlace_descarga(text) from public, anon, authenticated;
grant execute on function public.resolver_enlace_descarga(text) to service_role;

-- El paciente (con su sesión del portal) pide un archivo de SU compra: solo si la venta es suya y no está anulada.
create function public.autorizar_descarga_paciente(p_paciente_id uuid, p_token text, p_factura_id uuid, p_tipo text)
returns table (ruta text, numero text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_f record;
  v_ruta text;
begin
  if p_tipo not in ('pdf', 'xml') or not sesion_paciente_valida(p_paciente_id, p_token) then return; end if;
  select * into v_f from facturas_venta f where f.id = p_factura_id and f.paciente_id = p_paciente_id and f.estado <> 'anulada';
  if not found then return; end if;
  select a.ruta into v_ruta from facturas_electronicas_archivos a where a.factura_id = p_factura_id and a.tipo = p_tipo order by a.subido_en desc limit 1;
  if v_ruta is null then return; end if;
  insert into facturas_electronicas_eventos (optica_id, factura_id, accion, actor_paciente, detalle) values (v_f.optica_id, p_factura_id, 'descarga_paciente', p_paciente_id, upper(p_tipo));
  return query select v_ruta, v_f.factura_electronica;
end;
$function$;
revoke all on function public.autorizar_descarga_paciente(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.autorizar_descarga_paciente(uuid, text, uuid, text) to service_role;

-- ════════════════════════════════════════════════════════════════
-- 8. Portal del paciente: "Mis compras" (solo lo suyo, sin campos internos: nada de quién vendió, descuentos internos ni ids del personal)
-- ════════════════════════════════════════════════════════════════
create function public.mis_compras_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.fila order by x.fecha desc, x.numero desc), '[]'::jsonb)
  from (
    select f.created_at as fecha, f.numero,
      jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'fecha', f.created_at, 'total', f.monto_total, 'estado', f.estado,
        'abonado', case when f.estado = 'pagada' then f.monto_total else coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0) end,
        'saldo', case when f.estado = 'pendiente_pago' then greatest(0, f.monto_total - coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0)) else 0 end,
        'lineas', coalesce((select jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'cantidad', l.cantidad, 'subtotal', l.subtotal) order by l.created_at) from facturas_venta_lineas l where l.factura_id = f.id), '[]'::jsonb),
        'factura_electronica', case when f.factura_electronica is null then null else jsonb_build_object(
          'numero', f.factura_electronica,
          'autorizada_el', (select e.autorizada_el from facturas_electronicas e where e.factura_id = f.id),
          'pdf', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'pdf'),
          'xml', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'xml')
        ) end
      ) as fila
    from facturas_venta f
    where f.paciente_id = p_paciente_id and f.estado <> 'anulada' and sesion_paciente_valida(p_paciente_id, p_token)
  ) x;
$function$;
revoke all on function public.mis_compras_paciente(uuid, text) from public;
grant execute on function public.mis_compras_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop function public.mis_compras_paciente(uuid, text); drop function public.autorizar_descarga_paciente(uuid, text, uuid, text);
--   drop function public.resolver_enlace_descarga(text); drop function public.revocar_enlaces_factura(uuid); drop function public.crear_enlaces_factura(uuid, integer);
--   drop function public.registrar_evento_factura_electronica(uuid, text, text); drop function public.guardar_factura_electronica(uuid, text, text, date, text, integer, text, integer);
--   drop function public.error_de_clave_acceso(text, text); drop function public.digito_verificador_clave(text);
--   drop policy facturas_electronicas_lectura_staff on storage.objects; drop policy facturas_electronicas_escritura_staff on storage.objects;
--   (vaciar y) delete from storage.buckets where id = 'facturas-electronicas';
--   drop table public.enlaces_descarga, public.facturas_electronicas_eventos, public.facturas_electronicas_archivos, public.facturas_electronicas;
