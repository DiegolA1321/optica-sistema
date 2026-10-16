-- Comunicación interna por niveles (rama comunicacion-interna): avisos del administrador a su personal, consultas del personal a su administrador
-- (que las responde, las resuelve o las escala al superadmin) y documentos adjuntos (PDF, Word y Excel) además de imágenes.
--
-- QUÉ HACE
--   1. `soporte_consultas.destino`: 'admin' (consulta del personal a su administrador) o 'superadmin' (consulta de un administrador al soporte del sistema,
--      o una del personal que su administrador escaló). Las que ya existen quedan 'superadmin': siguen donde estaban.
--   2. Quién escribe a quién, en el servidor: `crear_consulta_soporte` pone 'superadmin' solo si quien llama es el administrador de su óptica; el resto del
--      personal escribe a 'admin'. Solo el administrador puede escalar (`escalar_consulta_soporte`) y solo una consulta que sigue abierta.
--   3. El superadmin solo ve (y solo responde) las de destino 'superadmin', con su conversación y sus archivos. Lo que se queda entre el personal y su
--      administrador no llega al superadmin. Cada persona ve las suyas; el administrador, las de toda su óptica; ninguna óptica ve las de otra.
--   4. Las respuestas del administrador a su personal se guardan con `de = 'admin'` (nuevo valor permitido).
--   5. Avisos internos (los recibe todo el personal destinatario, tenga o no el permiso de Soporte): `avisos_internos` (para todos, un rol o una persona; con vencimiento opcional) y `avisos_internos_leidos`. Solo el administrador los
--      publica y los retira; cada persona ve los dirigidos a ella, sin importar su permiso de Soporte (que no hayan vencido); el administrador ve "quién leyó" con `lecturas_avisos_internos`.
--   6. Adjuntos: PDF, Word (.docx) y Excel (.xlsx) además de PNG, JPG, WebP y GIF; hasta 10 MB cada uno. El servidor valida tipo y extensión al subir
--      (almacenamiento) y otra vez al enviar el mensaje; .docm, .xlsm y cualquier otro tipo se rechazan. El bucket sigue privado.
--
-- LO QUE NO CAMBIA
--   · Los permisos y los roles: Soporte "ver" y "crear" siguen siendo los de Optómetra, Recepción y Ventas; ahora significan escribir a su administrador
--     (el servidor ya no les deja escribir al superadmin). Los roles propios no se tocan. Se actualiza solo el texto de ayuda del permiso.
--   · La tabla `mensajes` y la versión publicada: las columnas nuevas tienen valor por defecto y las funciones mantienen su firma (create or replace, sin sobrecargas).
--
-- Ensayo: scripts/ensayo-0116.mjs (transacción que se revierte). Verificación con sesiones reales: scripts/verificar-0116.mjs.

-- ════════════════════════════════════════════════════════════════
-- 1. Consultas: destino, escalada y quién responde
-- ════════════════════════════════════════════════════════════════
alter table public.soporte_consultas
  add column destino text not null default 'superadmin' check (destino in ('admin', 'superadmin')),
  add column escalada_en timestamptz,
  add column escalada_por text;

alter table public.soporte_consultas drop constraint soporte_consultas_ultimo_mensaje_de_check;
alter table public.soporte_consultas add constraint soporte_consultas_ultimo_mensaje_de_check check (ultimo_mensaje_de in ('optica', 'admin', 'soporte'));
alter table public.soporte_mensajes drop constraint soporte_mensajes_de_check;
alter table public.soporte_mensajes add constraint soporte_mensajes_de_check check (de in ('optica', 'admin', 'soporte'));

create index soporte_consultas_destino_idx on public.soporte_consultas (destino, estado, urgencia, creada_en);

-- El superadmin solo ve lo que le llegó (las suyas o las escaladas).
drop policy soporte_consultas_superadmin on public.soporte_consultas;
create policy soporte_consultas_superadmin on public.soporte_consultas for select using (es_superadmin() and destino = 'superadmin');

drop policy soporte_mensajes_superadmin on public.soporte_mensajes;
create policy soporte_mensajes_superadmin on public.soporte_mensajes for select
  using (es_superadmin() and exists (select 1 from public.soporte_consultas c where c.id = consulta_id and c.destino = 'superadmin'));

-- ════════════════════════════════════════════════════════════════
-- 2. Adjuntos: PDF, Word y Excel además de imágenes (10 MB), validados en el servidor
-- ════════════════════════════════════════════════════════════════
update storage.buckets
   set file_size_limit = 10485760,
       allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
                                  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
 where id = 'soporte-adjuntos';

-- Extensión permitida (sin macros: .docm y .xlsm no están).
create function public._extension_adjunto_soporte_valida(p_nombre text)
returns boolean
language sql
immutable
as $$ select lower(coalesce(p_nombre, '')) ~ '\.(png|jpe?g|webp|gif|pdf|docx|xlsx)$' $$;

drop policy soporte_adjuntos_escritura_optica on storage.objects;
create policy soporte_adjuntos_escritura_optica on storage.objects for insert
  with check (bucket_id = 'soporte-adjuntos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and tiene_permiso('mensajes', 'crear') and _extension_adjunto_soporte_valida(name));
drop policy soporte_adjuntos_escritura_superadmin on storage.objects;
create policy soporte_adjuntos_escritura_superadmin on storage.objects for insert
  with check (bucket_id = 'soporte-adjuntos' and es_superadmin() and _extension_adjunto_soporte_valida(name));
-- El superadmin solo lee los archivos de consultas que le llegaron.
drop policy soporte_adjuntos_lectura_superadmin on storage.objects;
create policy soporte_adjuntos_lectura_superadmin on storage.objects for select
  using (bucket_id = 'soporte-adjuntos' and es_superadmin()
    and exists (select 1 from public.soporte_consultas c where c.id::text = (storage.foldername(name))[2]));

create or replace function public._validar_adjuntos_soporte(p_optica uuid, p_consulta uuid, p_adjuntos jsonb, p_interno boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a jsonb;
  v_ruta text;
  v_obj record;
  v_res jsonb := '[]'::jsonb;
  v_prefijo text := p_optica::text || '/' || p_consulta::text || '/' || case when p_interno then 'interno/' else '' end;
  v_tipos constant text[] := array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
begin
  if p_adjuntos is null or p_adjuntos = 'null'::jsonb then return v_res; end if;
  if jsonb_typeof(p_adjuntos) <> 'array' then raise exception 'Los adjuntos no son válidos.'; end if;
  if jsonb_array_length(p_adjuntos) > 3 then raise exception 'Puedes adjuntar hasta 3 archivos.'; end if;
  for v_a in select * from jsonb_array_elements(p_adjuntos) loop
    v_ruta := v_a ->> 'ruta';
    if v_ruta is null or left(v_ruta, char_length(v_prefijo)) <> v_prefijo or position('/' in substr(v_ruta, char_length(v_prefijo) + 1)) > 0 then
      raise exception 'Un archivo no está en el lugar correcto: vuelve a adjuntarlo.';
    end if;
    if not _extension_adjunto_soporte_valida(v_ruta) then
      raise exception 'Solo se aceptan imágenes, PDF, Word (.docx) y Excel (.xlsx). Los archivos con macros no se aceptan.';
    end if;
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes, o.metadata ->> 'mimetype' as tipo
      into v_obj from storage.objects o where o.bucket_id = 'soporte-adjuntos' and o.name = v_ruta;
    if not found then raise exception 'Un archivo no se subió: vuelve a adjuntarlo.'; end if;
    if v_obj.bytes > 10485760 then raise exception 'Cada archivo puede pesar hasta 10 MB.'; end if;
    if v_obj.tipo is null or not (v_obj.tipo = any (v_tipos)) then
      raise exception 'Solo se aceptan imágenes, PDF, Word (.docx) y Excel (.xlsx). Los archivos con macros no se aceptan.';
    end if;
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'ruta', v_ruta, 'nombre', left(coalesce(nullif(btrim(v_a ->> 'nombre'), ''), 'archivo'), 100), 'bytes', v_obj.bytes, 'tipo', v_obj.tipo));
  end loop;
  return v_res;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- 3. Funciones de consultas (misma firma que 0115: create or replace, sin sobrecargas)
-- ════════════════════════════════════════════════════════════════
-- El administrador escribe al soporte del sistema; el resto del personal, a su administrador.
create or replace function public.crear_consulta_soporte(
  p_id uuid, p_modulo text, p_tipo text, p_urgencia text, p_asunto text, p_descripcion text, p_contexto jsonb default '{}'::jsonb, p_adjuntos jsonb default '[]'::jsonb)
returns table (id uuid, numero integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_nombre text := _nombre_de_quien_llama();
  v_destino text := case when _es_admin_optica_actual() then 'superadmin' else 'admin' end;
  v_adj jsonb;
  v_n integer;
begin
  if p_id is null then raise exception 'Falta el identificador de la consulta.'; end if;
  if btrim(coalesce(p_asunto, '')) = '' or btrim(coalesce(p_descripcion, '')) = '' then raise exception 'Completa el asunto y la descripción.'; end if;
  if (select count(*) from soporte_consultas c where c.autor_id = auth.uid() and c.creada_en > now() - interval '1 hour') >= 20 then
    raise exception 'Enviaste muchas consultas seguidas. Espera un poco o responde en una de las que ya tienes abiertas.';
  end if;
  v_adj := _validar_adjuntos_soporte(v_optica, p_id, p_adjuntos, false);

  insert into soporte_consultas (id, optica_id, autor_id, autor_nombre, autor_rol, modulo, tipo, urgencia, asunto, descripcion, contexto, destino)
  values (p_id, v_optica, auth.uid(), v_nombre, _etiqueta_rol_soporte(auth.uid()), p_modulo, p_tipo, coalesce(p_urgencia, 'normal'),
          left(btrim(p_asunto), 120), left(btrim(p_descripcion), 4000), coalesce(p_contexto, '{}'::jsonb), v_destino)
  returning soporte_consultas.numero into v_n;

  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo, adjuntos)
  values (p_id, v_optica, auth.uid(), v_nombre, 'optica', left(btrim(p_descripcion), 4000), v_adj);

  return query select p_id, v_n;
end;
$function$;

-- El autor o el administrador agregan un mensaje. Cuando el administrador contesta a su personal (consulta que aún no se escaló) queda "Respondida" y
-- la persona recibe el aviso; cuando escribe el autor, la consulta vuelve a "En revisión".
create or replace function public.responder_consulta_soporte(p_consulta uuid, p_cuerpo text, p_adjuntos jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype := _consulta_visible_soporte(p_consulta, v_optica);
  v_adj jsonb;
  v_es_autor boolean := v_c.autor_id is not distinct from auth.uid();
  v_contesta_admin boolean := not v_es_autor and v_c.destino = 'admin';
begin
  if btrim(coalesce(p_cuerpo, '')) = '' then raise exception 'Escribe tu mensaje.'; end if;
  if v_c.estado = 'resuelta' then raise exception 'Esta consulta ya está resuelta. Si el problema sigue, reábrela.'; end if;
  v_adj := _validar_adjuntos_soporte(v_optica, p_consulta, p_adjuntos, false);
  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo, adjuntos)
  values (p_consulta, v_optica, auth.uid(), _nombre_de_quien_llama(), case when v_es_autor then 'optica' else 'admin' end, left(btrim(p_cuerpo), 4000), v_adj);
  if v_contesta_admin then
    update soporte_consultas set estado = 'respondida', ultimo_mensaje_de = 'admin', respuesta_sin_leer = true, actualizada_en = now() where id = p_consulta;
  else
    update soporte_consultas
       set estado = case when estado = 'respondida' then 'en_revision' else estado end,
           ultimo_mensaje_de = 'optica', actualizada_en = now()
     where id = p_consulta;
  end if;
end;
$function$;

-- El administrador pasa al soporte del sistema una consulta de su personal, con su conversación y sus archivos (siguen en la misma consulta).
create function public.escalar_consulta_soporte(p_consulta uuid, p_nota text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype;
  v_nombre text := _nombre_de_quien_llama();
begin
  if not _es_admin_optica_actual() then raise exception 'Solo el administrador puede escalar una consulta al soporte del sistema.'; end if;
  v_c := _consulta_visible_soporte(p_consulta, v_optica);
  if v_c.destino <> 'admin' then raise exception 'Esta consulta ya está con el soporte del sistema.'; end if;
  if v_c.estado = 'resuelta' then raise exception 'Esta consulta ya está resuelta. Si el problema sigue, reábrela.'; end if;
  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo)
  values (p_consulta, v_optica, auth.uid(), v_nombre, 'admin',
          left('Escalé esta consulta al soporte del sistema.' || case when btrim(coalesce(p_nota, '')) <> '' then E'\n' || btrim(p_nota) else '' end, 4000));
  update soporte_consultas
     set destino = 'superadmin', escalada_en = now(), escalada_por = v_nombre, estado = 'recibida', ultimo_mensaje_de = 'optica', actualizada_en = now()
   where id = p_consulta;
end;
$function$;
revoke all on function public.escalar_consulta_soporte(uuid, text) from public, anon;
grant execute on function public.escalar_consulta_soporte(uuid, text) to authenticated;

-- El superadmin solo atiende lo que le llegó.
create or replace function public.soporte_responder(p_consulta uuid, p_cuerpo text, p_interna boolean default false, p_estado text default null, p_adjuntos jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c soporte_consultas%rowtype;
  v_adj jsonb;
  v_estado text;
begin
  if not es_superadmin() then raise exception 'Solo el soporte puede responder.'; end if;
  select * into v_c from soporte_consultas where id = p_consulta and destino = 'superadmin';
  if not found then raise exception 'No encontramos esa consulta.'; end if;
  if btrim(coalesce(p_cuerpo, '')) = '' then raise exception 'Escribe tu respuesta.'; end if;
  if p_estado is not null and p_estado not in ('en_revision', 'respondida', 'resuelta') then raise exception 'Estado no válido.'; end if;
  v_adj := _validar_adjuntos_soporte(v_c.optica_id, p_consulta, p_adjuntos, coalesce(p_interna, false));

  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, interna, cuerpo, adjuntos)
  values (p_consulta, v_c.optica_id, auth.uid(), _nombre_de_quien_llama(), 'soporte', coalesce(p_interna, false), left(btrim(p_cuerpo), 4000), v_adj);

  if coalesce(p_interna, false) then
    update soporte_consultas set actualizada_en = now() where id = p_consulta;
    return;
  end if;

  v_estado := coalesce(p_estado, case when v_c.estado = 'resuelta' then 'resuelta' else 'respondida' end);
  update soporte_consultas
     set estado = v_estado, ultimo_mensaje_de = 'soporte', respuesta_sin_leer = true,
         primera_respuesta_en = coalesce(primera_respuesta_en, now()),
         resuelta_en = case when v_estado = 'resuelta' then coalesce(resuelta_en, now()) else resuelta_en end,
         actualizada_en = now()
   where id = p_consulta;

  if v_c.mensaje_origen is not null then
    perform set_config('soporte.sincronizando', '1', true);
    update mensajes set respuesta = left(btrim(p_cuerpo), 4000), respondido_at = now(), estado = case when v_estado = 'resuelta' then 'resuelto' else estado end
     where id = v_c.mensaje_origen;
  end if;
end;
$function$;

create or replace function public.soporte_cambiar_estado(p_consulta uuid, p_estado text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c soporte_consultas%rowtype;
begin
  if not es_superadmin() then raise exception 'Solo el soporte puede cambiar el estado.'; end if;
  if p_estado not in ('recibida', 'en_revision', 'respondida', 'resuelta') then raise exception 'Estado no válido.'; end if;
  select * into v_c from soporte_consultas where id = p_consulta and destino = 'superadmin';
  if not found then raise exception 'No encontramos esa consulta.'; end if;
  if p_estado = v_c.estado then return; end if;
  update soporte_consultas
     set estado = p_estado,
         resuelta_en = case when p_estado = 'resuelta' then coalesce(resuelta_en, now()) else null end,
         respuesta_sin_leer = case when p_estado = 'resuelta' then true else respuesta_sin_leer end,
         actualizada_en = now()
   where id = p_consulta;
  if v_c.mensaje_origen is not null then
    perform set_config('soporte.sincronizando', '1', true);
    update mensajes set estado = case when p_estado = 'resuelta' then 'resuelto' else 'abierto' end where id = v_c.mensaje_origen;
  end if;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- 4. Avisos internos (administrador → personal)
-- ════════════════════════════════════════════════════════════════
create table public.avisos_internos (
  id           uuid primary key default gen_random_uuid(),
  optica_id    uuid not null references public.opticas(id) on delete cascade,
  autor_id     uuid references public.perfiles(id) on delete set null,
  autor_nombre text not null,
  titulo       text not null check (char_length(titulo) between 3 and 120),
  cuerpo       text not null check (char_length(cuerpo) between 1 and 4000),
  para         text not null check (para in ('todos', 'rol', 'persona')),
  rol_id       uuid references public.roles(id) on delete cascade,
  perfil_id    uuid references public.perfiles(id) on delete cascade,
  vence_el     date,
  creado_en    timestamptz not null default now(),
  check ((para = 'todos' and rol_id is null and perfil_id is null)
      or (para = 'rol' and rol_id is not null and perfil_id is null)
      or (para = 'persona' and perfil_id is not null and rol_id is null))
);
create index avisos_internos_optica_idx on public.avisos_internos (optica_id, creado_en desc);

create table public.avisos_internos_leidos (
  perfil_id uuid not null references public.perfiles(id) on delete cascade,
  aviso_id  uuid not null references public.avisos_internos(id) on delete cascade,
  leido_en  timestamptz not null default now(),
  primary key (perfil_id, aviso_id)
);

alter table public.avisos_internos enable row level security;
alter table public.avisos_internos_leidos enable row level security;
revoke all on public.avisos_internos, public.avisos_internos_leidos from anon, authenticated;
grant select on public.avisos_internos, public.avisos_internos_leidos to authenticated;

-- ¿Este aviso va dirigido a quien llama? (sin recursión de políticas; "hoy" es el de Ecuador)
create function public._aviso_interno_para_mi(p_para text, p_rol uuid, p_perfil uuid, p_vence date)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select (p_vence is null or p_vence >= (now() at time zone 'America/Guayaquil')::date)
     and (p_para = 'todos'
          or (p_para = 'persona' and p_perfil = auth.uid())
          or (p_para = 'rol' and exists (select 1 from perfil_roles pr where pr.perfil_id = auth.uid() and pr.rol_id = p_rol)))
$$;
revoke all on function public._aviso_interno_para_mi(text, uuid, uuid, date) from public, anon;
grant execute on function public._aviso_interno_para_mi(text, uuid, uuid, date) to authenticated;

create policy avisos_internos_lectura on public.avisos_internos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and perfil_activo_actual()
    and (_es_admin_optica_actual() or _aviso_interno_para_mi(para, rol_id, perfil_id, vence_el)));
create policy avisos_internos_leidos_propios on public.avisos_internos_leidos for select using (perfil_id = auth.uid());

-- Publica un aviso (solo el administrador de la óptica).
create function public.publicar_aviso_interno(p_titulo text, p_cuerpo text, p_para text, p_rol uuid default null, p_perfil uuid default null, p_vence date default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_id uuid;
begin
  if not _es_admin_optica_actual() then raise exception 'Solo el administrador puede publicar avisos.'; end if;
  if btrim(coalesce(p_titulo, '')) = '' or btrim(coalesce(p_cuerpo, '')) = '' then raise exception 'Escribe el título y el mensaje del aviso.'; end if;
  if p_para not in ('todos', 'rol', 'persona') then raise exception 'Elige a quién va dirigido el aviso.'; end if;
  if p_para = 'rol' and not exists (select 1 from roles r where r.id = p_rol and r.optica_id = v_optica) then raise exception 'Ese rol no existe en tu óptica.'; end if;
  if p_para = 'persona' and not exists (select 1 from perfiles p where p.id = p_perfil and p.optica_id = v_optica and p.activo) then raise exception 'Esa persona no está en tu óptica.'; end if;
  if p_vence is not null and p_vence < (now() at time zone 'America/Guayaquil')::date then raise exception 'La fecha de vencimiento ya pasó.'; end if;
  insert into avisos_internos (optica_id, autor_id, autor_nombre, titulo, cuerpo, para, rol_id, perfil_id, vence_el)
  values (v_optica, auth.uid(), _nombre_de_quien_llama(), left(btrim(p_titulo), 120), left(btrim(p_cuerpo), 4000), p_para,
          case when p_para = 'rol' then p_rol end, case when p_para = 'persona' then p_perfil end, p_vence)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.publicar_aviso_interno(text, text, text, uuid, uuid, date) from public, anon;
grant execute on function public.publicar_aviso_interno(text, text, text, uuid, uuid, date) to authenticated;

-- Retira un aviso (solo el administrador, solo de su óptica).
create function public.retirar_aviso_interno(p_aviso uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
begin
  if not _es_admin_optica_actual() then raise exception 'Solo el administrador puede retirar avisos.'; end if;
  delete from avisos_internos where id = p_aviso and optica_id = v_optica;
  if not found then raise exception 'No encontramos ese aviso.'; end if;
end;
$function$;
revoke all on function public.retirar_aviso_interno(uuid) from public, anon;
grant execute on function public.retirar_aviso_interno(uuid) to authenticated;

-- Los avisos internos son comunicación de la óptica: los recibe todo el personal destinatario, tenga o no el permiso de Soporte.
-- Esta comprobación pide estar en una óptica activa con el segundo factor, pero no el permiso de Soporte.
create function public._optica_del_personal()
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() or not perfil_activo_actual() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  return v_optica;
end;
$function$;
revoke all on function public._optica_del_personal() from public, anon, authenticated;

-- Marca como leídos los avisos internos dirigidos a quien llama (sin lista: todos los suyos).
create function public.marcar_avisos_internos_leidos(p_avisos uuid[] default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_del_personal();
begin
  insert into avisos_internos_leidos (perfil_id, aviso_id)
  select auth.uid(), a.id from avisos_internos a
   where a.optica_id = v_optica and a.autor_id is distinct from auth.uid()
     and _aviso_interno_para_mi(a.para, a.rol_id, a.perfil_id, a.vence_el)
     and (p_avisos is null or a.id = any (p_avisos))
  on conflict do nothing;
end;
$function$;
revoke all on function public.marcar_avisos_internos_leidos(uuid[]) from public, anon;
grant execute on function public.marcar_avisos_internos_leidos(uuid[]) to authenticated;

-- "Leído por 3 de 5": para cada aviso de la óptica, a quién va dirigido (sin contar a quien lo publicó) y si ya lo leyó. Solo el administrador.
create function public.lecturas_avisos_internos()
returns table (aviso_id uuid, perfil_id uuid, nombre text, leido_en timestamptz)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('ver');
begin
  if not _es_admin_optica_actual() then raise exception 'Solo el administrador ve quién leyó cada aviso.'; end if;
  return query
  select a.id, p.id, p.nombre, l.leido_en
    from avisos_internos a
    join perfiles p on p.optica_id = a.optica_id and p.activo and p.id is distinct from a.autor_id
    left join avisos_internos_leidos l on l.aviso_id = a.id and l.perfil_id = p.id
   where a.optica_id = v_optica
     and (a.para = 'todos'
          or (a.para = 'persona' and a.perfil_id = p.id)
          or (a.para = 'rol' and exists (select 1 from perfil_roles pr where pr.perfil_id = p.id and pr.rol_id = a.rol_id)))
   order by a.creado_en desc, p.nombre;
end;
$function$;
revoke all on function public.lecturas_avisos_internos() from public, anon;
grant execute on function public.lecturas_avisos_internos() to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Para deshacer (solo si hiciera falta):
--   drop table public.avisos_internos_leidos, public.avisos_internos cascade;
--   drop function public.publicar_aviso_interno(text, text, text, uuid, uuid, date), public.retirar_aviso_interno(uuid),
--     public.marcar_avisos_internos_leidos(uuid[]), public.lecturas_avisos_internos(), public.escalar_consulta_soporte(uuid, text),
--     public._aviso_interno_para_mi(text, uuid, uuid, date), public._extension_adjunto_soporte_valida(text);
--   alter table public.soporte_consultas drop column destino, drop column escalada_en, drop column escalada_por;
--   (volver a aplicar las definiciones de 0115 de crear/responder_consulta_soporte, soporte_responder, soporte_cambiar_estado, _validar_adjuntos_soporte,
--    las políticas de soporte_consultas/soporte_mensajes del superadmin y las de storage.objects 'soporte_adjuntos_*', y el bucket: 5 MB e imágenes)
--   (los valores 'admin' de `de` y `ultimo_mensaje_de` se pasarían a 'optica' antes de volver a las restricciones anteriores)
-- ════════════════════════════════════════════════════════════════
