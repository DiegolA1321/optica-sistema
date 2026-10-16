-- Privacidad del panel del superadmin (ley de protección de datos): la óptica es la responsable de sus datos y el superadmin es el encargado.
-- Regla (docs/principios-diseno.md, 44): el superadmin ve lo necesario para operar el sistema, nunca los datos del negocio ni de los pacientes
-- de una óptica, salvo con autorización de la óptica.
--
-- Qué hace (todo en el servidor):
--   1. `accesos_soporte`: la autorización que da el administrador de la óptica ("Permitir acceso del soporte") por un tiempo limitado
--      (1 a 168 horas; 24 por defecto), desde Configuración o desde una consulta de soporte. Se puede revocar.
--   2. `entradas_soporte`: cada entrada del superadmin como administrador (quién, qué óptica, motivo, cuándo, hasta cuándo, salida).
--   3. `acceso_soporte(óptica)`: verdadero solo si es superadmin Y (la óptica es un entorno de prueba O tiene una entrada abierta y vigente).
--      Las políticas de TODAS las tablas con datos del negocio o de pacientes (y los archivos de fichas, facturas y fotos de productos) que
--      dejaban pasar a es_superadmin() ahora exigen esto. Las tablas de la plataforma (ópticas, perfiles, roles, soporte, mensajes, auditoría)
--      no cambian. Las funciones que actuaban por el superadmin sobre otra óptica (ventas, abonos, factura electrónica, inventario,
--      clave del paciente, compras, notificaciones) también lo exigen.
--   4. `permitir_acceso_soporte`, `revocar_acceso_soporte`, `mi_acceso_soporte` (administrador de la óptica) y `entrar_como_optica`,
--      `salir_de_optica` (superadmin). Al entrar se exige el motivo, queda en la actividad de la propia óptica y en la del superadmin, y el
--      administrador recibe un aviso con la fecha y el motivo. En entornos de prueba no hace falta autorización.
--   5. `datos_negocio_superadmin()` ya no entrega volúmenes (citas, consultas, ventas, pacientes): solo personas activas y, por módulo,
--      la última vez que se usó.
--   6. "Optica Karla V" (karla-vision) es un entorno de prueba.

-- 1 y 2. Tablas -------------------------------------------------------------------------------------------------------------
create table if not exists public.accesos_soporte (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  concedido_por uuid references public.perfiles(id) on delete set null,
  concedido_nombre text,
  origen text not null default 'configuracion' check (origen in ('configuracion', 'consulta')),
  consulta_id uuid,
  creado_en timestamptz not null default now(),
  vence_en timestamptz not null,
  revocado_en timestamptz
);
create index if not exists accesos_soporte_optica_idx on public.accesos_soporte (optica_id, vence_en desc);

create table if not exists public.entradas_soporte (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  superadmin_id uuid not null references public.perfiles(id) on delete cascade,
  superadmin_nombre text not null,
  motivo text,
  entrada_en timestamptz not null default now(),
  vence_en timestamptz not null,
  salida_en timestamptz
);
create index if not exists entradas_soporte_optica_idx on public.entradas_soporte (optica_id, entrada_en desc);
create index if not exists entradas_soporte_vigente_idx on public.entradas_soporte (superadmin_id, optica_id) where salida_en is null;

alter table public.accesos_soporte enable row level security;
alter table public.entradas_soporte enable row level security;
revoke insert, update, delete on public.accesos_soporte, public.entradas_soporte from anon, authenticated;
revoke all on public.accesos_soporte, public.entradas_soporte from anon;

create policy accesos_soporte_admin_select on public.accesos_soporte for select
  using (optica_id = (select optica_id from public.perfiles where id = auth.uid() and rol = 'admin'));
create policy accesos_soporte_superadmin_select on public.accesos_soporte for select using (es_superadmin());
create policy entradas_soporte_admin_select on public.entradas_soporte for select
  using (optica_id = (select optica_id from public.perfiles where id = auth.uid() and rol = 'admin'));
create policy entradas_soporte_superadmin_select on public.entradas_soporte for select using (es_superadmin() and superadmin_id = auth.uid());
create policy exige_aal2_si_mfa_activo on public.accesos_soporte as restrictive for all using (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.entradas_soporte as restrictive for all using (mfa_satisfecho());

-- 3. ¿Puede el superadmin ver los datos de esta óptica ahora? ---------------------------------------------------------------
create or replace function public.acceso_soporte(p_optica uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(es_superadmin(), false) and p_optica is not null and (
    exists (select 1 from opticas o where o.id = p_optica and o.es_de_prueba)
    or exists (select 1 from entradas_soporte e
                where e.optica_id = p_optica and e.superadmin_id = auth.uid() and e.salida_en is null and e.vence_en > now())
  );
$$;
revoke all on function public.acceso_soporte(uuid) from public, anon;
grant execute on function public.acceso_soporte(uuid) to authenticated;

create or replace function public.exigir_acceso_soporte(p_optica uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not acceso_soporte(p_optica) then
    raise exception 'La óptica no ha autorizado el acceso: su administrador debe activar «Permitir acceso del soporte».';
  end if;
end;
$$;
revoke all on function public.exigir_acceso_soporte(uuid) from public, anon;
grant execute on function public.exigir_acceso_soporte(uuid) to authenticated;

-- La carpeta de un archivo es el id de la óptica ("<optica>/...").
create or replace function public.acceso_soporte_ruta(p_nombre text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select acceso_soporte(case when split_part(p_nombre, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then split_part(p_nombre, '/', 1)::uuid end);
$$;
revoke all on function public.acceso_soporte_ruta(text) from public, anon;
grant execute on function public.acceso_soporte_ruta(text) to authenticated;

-- Políticas de las tablas con datos del negocio y de pacientes: de es_superadmin() a acceso_soporte(óptica).
do $$
declare
  r record;
  v_expr text;
  v_n int := 0;
begin
  for r in
    select tablename, policyname, qual, with_check
      from pg_policies
     where schemaname = 'public'
       and tablename in ('abonos_correcciones', 'abonos_factura', 'citas_base', 'consentimientos_historial', 'consultas_base', 'conteos_inventario',
                         'crm_campanas', 'crm_contactos', 'crm_plantillas', 'disponibilidad', 'facturas_electronicas', 'facturas_electronicas_archivos',
                         'facturas_electronicas_eventos', 'facturas_venta', 'facturas_venta_lineas', 'horarios_usuario', 'inventario', 'inventario_costos',
                         'logs_optica', 'movimientos_inventario', 'notificaciones_enviadas', 'ordenes_laboratorio', 'ordenes_laboratorio_historial',
                         'pacientes_base', 'pases_a_venta', 'respuestas_satisfaccion', 'solicitudes_eliminacion_paciente', 'ventas')
       and (qual ilike '%es_superadmin()%' or with_check ilike '%es_superadmin()%')
  loop
    v_expr := case r.tablename
      when 'facturas_venta_lineas' then 'acceso_soporte((select f.optica_id from facturas_venta f where f.id = factura_id))'
      when 'ordenes_laboratorio_historial' then 'acceso_soporte((select o.optica_id from ordenes_laboratorio o where o.id = orden_id))'
      else 'acceso_soporte(optica_id)'
    end;
    execute format('alter policy %I on public.%I %s %s', r.policyname, r.tablename,
      case when r.qual is not null then 'using (' || replace(r.qual, 'es_superadmin()', v_expr) || ')' else '' end,
      case when r.with_check is not null then 'with check (' || replace(r.with_check, 'es_superadmin()', v_expr) || ')' else '' end);
    v_n := v_n + 1;
  end loop;
  if v_n < 28 then raise exception 'Se esperaban al menos 28 políticas de tablas y se cambiaron %', v_n; end if;
end;
$$;

-- Archivos de fichas, facturas electrónicas y fotos de productos.
do $$
declare
  r record;
  v_n int := 0;
begin
  for r in
    select policyname, qual, with_check
      from pg_policies
     where schemaname = 'storage' and tablename = 'objects'
       and policyname in ('facturas_electronicas_lectura_staff', 'facturas_electronicas_escritura_staff', 'consultas_adjuntos_lectura_staff',
                          'consultas_adjuntos_escritura_staff', 'consultas_adjuntos_borrado_staff', 'productos_escritura_staff_optica',
                          'productos_actualizacion_staff_optica', 'productos_borrado_staff_optica')
  loop
    execute format('alter policy %I on storage.objects %s %s', r.policyname,
      case when r.qual is not null then 'using (' || replace(r.qual, 'es_superadmin()', 'acceso_soporte_ruta(name)') || ')' else '' end,
      case when r.with_check is not null then 'with check (' || replace(r.with_check, 'es_superadmin()', 'acceso_soporte_ruta(name)') || ')' else '' end);
    v_n := v_n + 1;
  end loop;
  if v_n <> 8 then raise exception 'Se esperaban 8 políticas de archivos y se cambiaron %', v_n; end if;
end;
$$;

-- Funciones que dejaban actuar al superadmin sobre cualquier óptica: ahora exigen la autorización.
create or replace function public._parchear_funcion(p_nombre text, p_patron text, p_reemplazo text)
returns void
language plpgsql
as $$
declare
  v_def text;
  v_nuevo text;
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = p_nombre;
  if v_def is null then raise exception 'No existe la función %', p_nombre; end if;
  v_nuevo := regexp_replace(v_def, p_patron, p_reemplazo);
  if v_nuevo = v_def then raise exception 'No se pudo parchear la función % (no se encontró el patrón)', p_nombre; end if;
  execute v_nuevo;
end;
$$;

select public._parchear_funcion('anular_abono', '(select a[.]optica_id into v_optica from abonos_factura a where a[.]id = p_abono_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('corregir_abono', '(select a[.]optica_id into v_optica from abonos_factura a where a[.]id = p_abono_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('anular_factura_venta', '(select f[.]optica_id into v_optica from facturas_venta f where f[.]id = p_factura_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('registrar_factura_electronica', '(select f[.]optica_id into v_optica from facturas_venta f where f[.]id = p_factura_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('registrar_movimiento_inventario', '(select i[.]optica_id into v_optica from inventario i where i[.]id = p_producto_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('crear_factura_venta', '(v_optica := p_optica_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('guardar_factura_electronica', '(v_optica := v_f[.]optica_id;)', E'\\1\n    perform exigir_acceso_soporte(v_optica);');
select public._parchear_funcion('compras_de_paciente', '(\n  if not es_superadmin\(\) then)', E'\n  if es_superadmin() then\n    perform exigir_acceso_soporte(v_optica);\n  end if;\\1');
select public._parchear_funcion('establecer_clave_paciente', 'select es_superadmin\(\) into v_es_superadmin;', 'select es_superadmin() and acceso_soporte(v_optica_id) into v_es_superadmin;');
select public._parchear_funcion('mis_notificaciones_recientes', 'where v_optica_id is null or n[.]optica_id = v_optica_id', 'where (v_optica_id is null and acceso_soporte(n.optica_id)) or n.optica_id = v_optica_id');
drop function public._parchear_funcion(text, text, text);

-- 4. Autorización de la óptica y entrada del superadmin ------------------------------------------------------------------------
create or replace function public.permitir_acceso_soporte(p_horas integer default 24, p_consulta uuid default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
  v_vence timestamptz;
begin
  select * into v_perfil from perfiles where id = auth.uid() and rol = 'admin' and coalesce(activo, true);
  if not found or v_perfil.optica_id is null then
    raise exception 'Solo el administrador de la óptica puede permitir el acceso del soporte.';
  end if;
  if p_horas is null or p_horas < 1 or p_horas > 168 then
    raise exception 'El acceso se permite por entre 1 y 168 horas.';
  end if;
  if p_consulta is not null and not exists (select 1 from soporte_consultas c where c.id = p_consulta and c.optica_id = v_perfil.optica_id) then
    raise exception 'La consulta no es de tu óptica.';
  end if;
  update accesos_soporte set revocado_en = now() where optica_id = v_perfil.optica_id and revocado_en is null and vence_en > now();
  v_vence := now() + make_interval(hours => p_horas);
  insert into accesos_soporte (optica_id, concedido_por, concedido_nombre, origen, consulta_id, vence_en)
  values (v_perfil.optica_id, v_perfil.id, v_perfil.nombre, case when p_consulta is null then 'configuracion' else 'consulta' end, p_consulta, v_vence);
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_perfil.optica_id, v_perfil.id, v_perfil.nombre, 'configuracion', 'Permitió el acceso del soporte del sistema', 'Por ' || p_horas || ' hora' || case when p_horas = 1 then '' else 's' end);
  return v_vence;
end;
$$;
revoke all on function public.permitir_acceso_soporte(integer, uuid) from public, anon;
grant execute on function public.permitir_acceso_soporte(integer, uuid) to authenticated;

create or replace function public.revocar_acceso_soporte()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil perfiles%rowtype;
begin
  select * into v_perfil from perfiles where id = auth.uid() and rol = 'admin' and coalesce(activo, true);
  if not found or v_perfil.optica_id is null then
    raise exception 'Solo el administrador de la óptica puede revocar el acceso del soporte.';
  end if;
  update accesos_soporte set revocado_en = now() where optica_id = v_perfil.optica_id and revocado_en is null and vence_en > now();
  update entradas_soporte set salida_en = now() where optica_id = v_perfil.optica_id and salida_en is null;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_perfil.optica_id, v_perfil.id, v_perfil.nombre, 'configuracion', 'Retiró el acceso del soporte del sistema', null);
end;
$$;
revoke all on function public.revocar_acceso_soporte() from public, anon;
grant execute on function public.revocar_acceso_soporte() to authenticated;

-- Lo que ve el administrador: si hay un permiso vigente y las últimas entradas del soporte.
create or replace function public.mi_acceso_soporte()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_acceso accesos_soporte%rowtype;
begin
  select optica_id into v_optica from perfiles where id = auth.uid() and rol = 'admin';
  if v_optica is null then return jsonb_build_object('activo', false, 'entradas', '[]'::jsonb); end if;
  select * into v_acceso from accesos_soporte where optica_id = v_optica and revocado_en is null and vence_en > now() order by vence_en desc limit 1;
  return jsonb_build_object(
    'activo', found,
    'vence_en', case when found then v_acceso.vence_en end,
    'origen', case when found then v_acceso.origen end,
    'entradas', coalesce((select jsonb_agg(jsonb_build_object('quien', e.superadmin_nombre, 'motivo', e.motivo, 'entrada_en', e.entrada_en, 'salida_en', e.salida_en) order by e.entrada_en desc)
                            from (select * from entradas_soporte where optica_id = v_optica order by entrada_en desc limit 5) e), '[]'::jsonb));
end;
$$;
revoke all on function public.mi_acceso_soporte() from public, anon;
grant execute on function public.mi_acceso_soporte() to authenticated;

create or replace function public.entrar_como_optica(p_optica uuid, p_motivo text default null)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica opticas%rowtype;
  v_nombre text;
  v_grant timestamptz;
  v_vence timestamptz;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_ahora timestamp := now() at time zone 'America/Guayaquil';
  v_fecha text;
begin
  if not es_superadmin() then raise exception 'Solo el superadministrador puede entrar a una óptica.'; end if;
  select * into v_optica from opticas where id = p_optica;
  if not found then raise exception 'La óptica no existe.'; end if;
  if not v_optica.activa then raise exception 'No puedes entrar a una óptica suspendida.'; end if;
  select nombre into v_nombre from perfiles where id = auth.uid();

  if v_optica.es_de_prueba then
    v_vence := now() + interval '8 hours';
  else
    select max(vence_en) into v_grant from accesos_soporte where optica_id = p_optica and revocado_en is null and vence_en > now();
    if v_grant is null then
      raise exception 'La óptica no ha autorizado el acceso: su administrador debe activar «Permitir acceso del soporte» en Configuración o desde una consulta de soporte.';
    end if;
    if v_motivo is null or char_length(v_motivo) < 5 then raise exception 'Indica el motivo de la entrada (al menos 5 letras).'; end if;
    v_vence := least(v_grant, now() + interval '8 hours');
  end if;

  update entradas_soporte set salida_en = now() where superadmin_id = auth.uid() and optica_id = p_optica and salida_en is null;
  insert into entradas_soporte (optica_id, superadmin_id, superadmin_nombre, motivo, vence_en)
  values (p_optica, auth.uid(), coalesce(v_nombre, 'Soporte del sistema'), v_motivo, v_vence);

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (p_optica, auth.uid(), coalesce(v_nombre, 'Soporte del sistema') || ' (soporte del sistema)', 'usuarios', 'Entró como administrador', v_motivo);
  insert into auditoria (actor_id, actor_nombre, accion, optica_id, optica_nombre, detalle)
  values (auth.uid(), coalesce(v_nombre, 'Superadmin'), 'entrar_como_optica', p_optica, v_optica.nombre, v_motivo);

  if not v_optica.es_de_prueba then
    v_fecha := extract(day from v_ahora)::int || ' ' || (array['ene','feb','mar','abr','may','jun','jul','ago','sept','oct','nov','dic'])[extract(month from v_ahora)::int]
            || ' ' || extract(year from v_ahora)::int || ', ' || to_char(v_ahora, 'HH12:MI AM');
    insert into mensajes (tipo, optica_id, remitente_id, remitente_nombre, asunto, cuerpo, estado)
    values ('anuncio', p_optica, auth.uid(), coalesce(v_nombre, 'Soporte del sistema'), 'El soporte del sistema entró a tu óptica',
            coalesce(v_nombre, 'El soporte del sistema') || ' entró como administrador el ' || v_fecha || '. Motivo: ' || v_motivo || '.', 'resuelto');
  end if;
  return v_vence;
end;
$$;
revoke all on function public.entrar_como_optica(uuid, text) from public, anon;
grant execute on function public.entrar_como_optica(uuid, text) to authenticated;

create or replace function public.salir_de_optica(p_optica uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nombre text;
  v_optica_nombre text;
begin
  if not es_superadmin() then raise exception 'Solo el superadministrador puede salir de una óptica.'; end if;
  select nombre into v_optica_nombre from opticas where id = p_optica;
  select nombre into v_nombre from perfiles where id = auth.uid();
  update entradas_soporte set salida_en = now() where superadmin_id = auth.uid() and optica_id = p_optica and salida_en is null;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (p_optica, auth.uid(), coalesce(v_nombre, 'Soporte del sistema') || ' (soporte del sistema)', 'usuarios', 'Salió del panel de la óptica como administrador', nullif(btrim(coalesce(p_nota, '')), ''));
  insert into auditoria (actor_id, actor_nombre, accion, optica_id, optica_nombre, detalle)
  values (auth.uid(), coalesce(v_nombre, 'Superadmin'), 'salir_de_optica', p_optica, coalesce(v_optica_nombre, 'Óptica'), nullif(btrim(coalesce(p_nota, '')), ''));
end;
$$;
revoke all on function public.salir_de_optica(uuid, text) from public, anon;
grant execute on function public.salir_de_optica(uuid, text) to authenticated;

-- 5. El panel ya no recibe volúmenes del negocio: personas activas y la última vez que se usó cada módulo ---------------------------
create or replace function public.datos_negocio_superadmin()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_desde timestamptz := now() - interval '30 days';
  v_antes timestamptz := now() - interval '60 days';
  v_personas jsonb;
  v_opticas jsonb;
begin
  if not es_superadmin() then
    raise exception 'Solo el superadministrador puede ver esto.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'perfil_id', p.id, 'optica_id', p.optica_id, 'rol', p.rol, 'nombre', p.nombre, 'activo', coalesce(p.activo, true),
           'ultimo_ingreso', u.last_sign_in_at) order by p.nombre), '[]'::jsonb)
    into v_personas
    from perfiles p
    left join auth.users u on u.id = p.id
   where p.rol in ('admin', 'asistente');

  select coalesce(jsonb_agg(jsonb_build_object(
           'optica_id', o.id,
           'personas_activas', (select count(distinct l.usuario_id) from logs_optica l where l.optica_id = o.id and l.created_at >= v_desde),
           'previo', jsonb_build_object(
             'personas_activas', (select count(distinct l.usuario_id) from logs_optica l where l.optica_id = o.id and l.created_at >= v_antes and l.created_at < v_desde),
             'modulos_en_uso', (select count(distinct l.modulo) from logs_optica l where l.optica_id = o.id and l.created_at >= v_antes and l.created_at < v_desde)),
           'modulos', coalesce((select jsonb_object_agg(m.modulo, m.ultima)
                                  from (select l.modulo, max(l.created_at) ultima from logs_optica l
                                         where l.optica_id = o.id and l.created_at >= v_desde group by l.modulo) m), '{}'::jsonb)
         ) order by o.nombre), '[]'::jsonb)
    into v_opticas
    from opticas o;

  return jsonb_build_object('generado', now(), 'desde', v_desde, 'personas', v_personas, 'opticas', v_opticas);
end;
$$;

-- 6. Entornos de prueba ----------------------------------------------------------------------------------------------------------
-- El disparador que protege las columnas reservadas pide a un superadmin; la migración corre sin sesión, así que se apaga un instante.
alter table public.opticas disable trigger opticas_restringe_columnas;
update public.opticas set es_de_prueba = true where slug = 'karla-vision' and es_de_prueba is distinct from true;
alter table public.opticas enable trigger opticas_restringe_columnas;
