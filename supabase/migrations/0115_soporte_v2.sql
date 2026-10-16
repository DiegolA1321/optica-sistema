-- Soporte v2 (rama soporte-v2): consultas con número, módulo, urgencia y estado; conversación hasta resolverla; capturas en almacenamiento
-- privado; calificación y reapertura; notas internas del superadmin; respuestas guardadas; avisos del sistema con "leído".
--
-- QUÉ HACE
--   1. `soporte_consultas`: una consulta por fila, con su número (SOP-0007), módulo, tipo (problema, pregunta, sugerencia), urgencia (normal, urgente),
--      estado (recibida, en revisión, respondida, resuelta), el contexto que manda el sistema (quién, rol, pantalla, navegador), la calificación y
--      las marcas de tiempo que alimentan los indicadores (primera respuesta, resolución).
--   2. `soporte_mensajes`: la conversación de cada consulta. Las notas internas (interna = true) las escribe y las ve SOLO el superadmin.
--   3. `soporte_respuestas_guardadas`: textos para las preguntas comunes. Solo el superadmin.
--   4. `avisos_leidos`: qué avisos del sistema (tabla `mensajes`, tipo 'anuncio') ya leyó cada persona, para destacar los no leídos.
--   5. Bucket privado `soporte-adjuntos` (capturas: png, jpg, webp, gif; máximo 5 MB cada una).
--   6. Funciones (todas con sus propias comprobaciones; nadie escribe las tablas directamente): crear_consulta_soporte, responder_consulta_soporte,
--      reabrir_consulta_soporte, cerrar_consulta_soporte, calificar_consulta_soporte, marcar_consulta_soporte_leida, marcar_avisos_leidos,
--      soporte_responder, soporte_cambiar_estado.
--   7. Quién ve qué: cada persona ve SUS consultas; el administrador de la óptica ve las de toda su óptica; el superadmin ve todas; ninguna óptica ve
--      las de otra. Las notas internas y sus archivos solo los ve el superadmin.
--   8. `anonimizar_paciente` también limpia el nombre del paciente en estas tablas (igual que ya hace con `mensajes`).
--   9. Los roles predefinidos de las ópticas NUEVAS (Optómetra, Recepción, Ventas) reciben Soporte (ver y crear): cada persona ve solo lo suyo.
--
-- CÓMO NO ROMPE LO PUBLICADO
--   · No toca la tabla `mensajes` ni sus políticas: la pantalla publicada sigue escribiendo y leyendo ahí.
--   · Dos disparadores sobre `mensajes` copian a las tablas nuevas lo que haga la versión publicada (una consulta nueva y las respuestas que escriba el
--     superadmin publicado), y las funciones nuevas devuelven a `mensajes` la respuesta y el estado, para que quien aún usa la versión publicada la
--     siga viendo. Las consultas de hoy se copian una vez (idempotente: no duplica).
--
-- Ensayo: scripts/ensayo-0115.mjs (dentro de una transacción que se revierte). Verificación con sesiones reales: scripts/verificar-0115.mjs.

-- ════════════════════════════════════════════════════════════════
-- 1. Ayudas internas
-- ════════════════════════════════════════════════════════════════
-- ¿Quien llama es administrador de su óptica? (security definer: evita la recursión de las políticas de `perfiles`)
create function public._es_admin_optica_actual()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select p.rol = 'admin' from perfiles p where p.id = auth.uid()), false);
$function$;
revoke all on function public._es_admin_optica_actual() from public, anon;
grant execute on function public._es_admin_optica_actual() to authenticated;

-- Cómo se presenta una persona en una consulta: Administrador o el nombre de su rol.
create function public._etiqueta_rol_soporte(p_perfil uuid)
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(
    (select case when p.rol = 'admin' then 'Administrador' else nullif(btrim(p.etiqueta_rol), '') end from perfiles p where p.id = p_perfil),
    'Personal');
$function$;
revoke all on function public._etiqueta_rol_soporte(uuid) from public, anon, authenticated;

-- La comprobación común del lado de la óptica: devuelve su óptica o falla con un mensaje claro.
create function public._optica_de_soporte(p_nivel text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then
    raise exception 'No tienes acceso a esta óptica.';
  end if;
  if not optica_activa_actual() then
    raise exception 'La óptica está suspendida o tu cuenta está desactivada.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not tiene_permiso('mensajes', p_nivel) then
    raise exception 'No tienes permiso para esta acción de Soporte.';
  end if;
  return v_optica;
end;
$function$;
revoke all on function public._optica_de_soporte(text) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 2. Tablas
-- ════════════════════════════════════════════════════════════════
create sequence public.soporte_numero_seq;

create table public.soporte_consultas (
  id                   uuid primary key default gen_random_uuid(),
  numero               integer not null unique default nextval('public.soporte_numero_seq'),
  optica_id            uuid not null references public.opticas(id) on delete cascade,
  autor_id             uuid references public.perfiles(id) on delete set null,
  autor_nombre         text not null,
  autor_rol            text not null,
  modulo               text not null check (modulo in ('inicio', 'citas', 'pacientes', 'ventas', 'inventario', 'reportes', 'crm', 'horario', 'usuarios', 'configuracion', 'otro')),
  tipo                 text not null check (tipo in ('problema', 'pregunta', 'sugerencia')),
  urgencia             text not null default 'normal' check (urgencia in ('normal', 'urgente')),
  asunto               text not null check (char_length(asunto) between 3 and 120),
  descripcion          text not null check (char_length(descripcion) between 1 and 4000),
  estado               text not null default 'recibida' check (estado in ('recibida', 'en_revision', 'respondida', 'resuelta')),
  contexto             jsonb not null default '{}'::jsonb check (jsonb_typeof(contexto) = 'object' and char_length(contexto::text) <= 2000),
  ultimo_mensaje_de    text not null default 'optica' check (ultimo_mensaje_de in ('optica', 'soporte')),
  respuesta_sin_leer   boolean not null default false,
  calificacion         smallint check (calificacion between 1 and 5),
  calificacion_comentario text check (char_length(calificacion_comentario) <= 500),
  calificada_en        timestamptz,
  primera_respuesta_en timestamptz,
  resuelta_en          timestamptz,
  reabierta_veces      integer not null default 0,
  mensaje_origen       uuid unique references public.mensajes(id) on delete set null,
  creada_en            timestamptz not null default now(),
  actualizada_en       timestamptz not null default now()
);
create index soporte_consultas_optica_idx on public.soporte_consultas (optica_id, creada_en desc);
create index soporte_consultas_autor_idx on public.soporte_consultas (autor_id, creada_en desc);
create index soporte_consultas_estado_idx on public.soporte_consultas (estado, urgencia, creada_en);

create table public.soporte_mensajes (
  id            uuid primary key default gen_random_uuid(),
  consulta_id   uuid not null references public.soporte_consultas(id) on delete cascade,
  optica_id     uuid not null references public.opticas(id) on delete cascade,
  autor_id      uuid references public.perfiles(id) on delete set null,
  autor_nombre  text not null,
  de            text not null check (de in ('optica', 'soporte')),
  interna       boolean not null default false check (not interna or de = 'soporte'),
  cuerpo        text not null check (char_length(cuerpo) between 1 and 4000),
  adjuntos      jsonb not null default '[]'::jsonb check (jsonb_typeof(adjuntos) = 'array'),
  creado_en     timestamptz not null default now()
);
create index soporte_mensajes_consulta_idx on public.soporte_mensajes (consulta_id, creado_en);

create table public.soporte_respuestas_guardadas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (char_length(titulo) between 3 and 80),
  texto       text not null check (char_length(texto) between 3 and 2000),
  creada_en   timestamptz not null default now()
);

create table public.avisos_leidos (
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  mensaje_id uuid not null references public.mensajes(id) on delete cascade,
  leido_en   timestamptz not null default now(),
  primary key (perfil_id, mensaje_id)
);

alter table public.soporte_consultas enable row level security;
alter table public.soporte_mensajes enable row level security;
alter table public.soporte_respuestas_guardadas enable row level security;
alter table public.avisos_leidos enable row level security;

-- Lectura. La escritura es solo por las funciones de abajo (las tablas no dan permisos de escritura a quien inicia sesión),
-- salvo las respuestas guardadas, que el superadmin administra directamente.
revoke all on public.soporte_consultas, public.soporte_mensajes, public.soporte_respuestas_guardadas, public.avisos_leidos from anon, authenticated;
grant select on public.soporte_consultas, public.soporte_mensajes, public.avisos_leidos to authenticated;
grant select, insert, update, delete on public.soporte_respuestas_guardadas to authenticated;

create policy soporte_consultas_superadmin on public.soporte_consultas for select using (es_superadmin());
create policy soporte_consultas_propias on public.soporte_consultas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and tiene_permiso('mensajes', 'ver')
    and (autor_id = auth.uid() or _es_admin_optica_actual()));

create policy soporte_mensajes_superadmin on public.soporte_mensajes for select using (es_superadmin());
-- La conversación pública de una consulta que quien llama ya puede ver; las notas internas nunca.
create policy soporte_mensajes_propios on public.soporte_mensajes for select
  using (not interna and consulta_id in (select c.id from public.soporte_consultas c));

create policy soporte_respuestas_superadmin on public.soporte_respuestas_guardadas for all using (es_superadmin()) with check (es_superadmin());

create policy avisos_leidos_propios on public.avisos_leidos for select using (perfil_id = auth.uid());

-- ════════════════════════════════════════════════════════════════
-- 3. Almacenamiento privado de las capturas
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('soporte-adjuntos', 'soporte-adjuntos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

-- Ruta: {óptica}/{consulta}/{archivo}. Quien tiene Soporte "crear" sube a la carpeta de SU óptica; quien puede ver la consulta (la suya, o toda la óptica
-- si es administrador) baja sus archivos. Lo del superadmin en una subcarpeta "interno" no lo ve ninguna óptica. No hay actualizar ni borrar.
create policy soporte_adjuntos_lectura_optica on storage.objects for select
  using (bucket_id = 'soporte-adjuntos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and tiene_permiso('mensajes', 'ver')
    and exists (select 1 from public.soporte_consultas c where c.id::text = (storage.foldername(name))[2]));
create policy soporte_adjuntos_escritura_optica on storage.objects for insert
  with check (bucket_id = 'soporte-adjuntos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and tiene_permiso('mensajes', 'crear'));
create policy soporte_adjuntos_lectura_superadmin on storage.objects for select
  using (bucket_id = 'soporte-adjuntos' and es_superadmin());
create policy soporte_adjuntos_escritura_superadmin on storage.objects for insert
  with check (bucket_id = 'soporte-adjuntos' and es_superadmin());

-- Comprueba los adjuntos de un mensaje: hasta 3, cada uno ya subido a la carpeta de esta consulta (o a "interno" si es nota interna),
-- y devuelve la lista limpia (ruta, nombre, tamaño y tipo reales del almacenamiento).
create function public._validar_adjuntos_soporte(p_optica uuid, p_consulta uuid, p_adjuntos jsonb, p_interno boolean)
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
begin
  if p_adjuntos is null or p_adjuntos = 'null'::jsonb then return v_res; end if;
  if jsonb_typeof(p_adjuntos) <> 'array' then raise exception 'Los adjuntos no son válidos.'; end if;
  if jsonb_array_length(p_adjuntos) > 3 then raise exception 'Puedes adjuntar hasta 3 capturas.'; end if;
  for v_a in select * from jsonb_array_elements(p_adjuntos) loop
    v_ruta := v_a ->> 'ruta';
    if v_ruta is null or left(v_ruta, char_length(v_prefijo)) <> v_prefijo or position('/' in substr(v_ruta, char_length(v_prefijo) + 1)) > 0 then
      raise exception 'Una captura no está en el lugar correcto: vuelve a adjuntarla.';
    end if;
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes, o.metadata ->> 'mimetype' as tipo
      into v_obj from storage.objects o where o.bucket_id = 'soporte-adjuntos' and o.name = v_ruta;
    if not found then raise exception 'Una captura no se subió: vuelve a adjuntarla.'; end if;
    if v_obj.bytes > 5242880 then raise exception 'Cada captura puede pesar hasta 5 MB.'; end if;
    v_res := v_res || jsonb_build_array(jsonb_build_object(
      'ruta', v_ruta, 'nombre', left(coalesce(nullif(btrim(v_a ->> 'nombre'), ''), 'captura'), 100), 'bytes', v_obj.bytes, 'tipo', coalesce(v_obj.tipo, 'image/png')));
  end loop;
  return v_res;
end;
$function$;
revoke all on function public._validar_adjuntos_soporte(uuid, uuid, jsonb, boolean) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 4. Funciones del lado de la óptica
-- ════════════════════════════════════════════════════════════════
-- Crea una consulta. El id lo elige la pantalla (las capturas se suben antes, a la carpeta de esa consulta).
create function public.crear_consulta_soporte(
  p_id uuid, p_modulo text, p_tipo text, p_urgencia text, p_asunto text, p_descripcion text, p_contexto jsonb default '{}'::jsonb, p_adjuntos jsonb default '[]'::jsonb)
returns table (id uuid, numero integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_nombre text := _nombre_de_quien_llama();
  v_adj jsonb;
  v_n integer;
begin
  if p_id is null then raise exception 'Falta el identificador de la consulta.'; end if;
  if btrim(coalesce(p_asunto, '')) = '' or btrim(coalesce(p_descripcion, '')) = '' then raise exception 'Completa el asunto y la descripción.'; end if;
  if (select count(*) from soporte_consultas c where c.autor_id = auth.uid() and c.creada_en > now() - interval '1 hour') >= 20 then
    raise exception 'Enviaste muchas consultas seguidas. Espera un poco o responde en una de las que ya tienes abiertas.';
  end if;
  v_adj := _validar_adjuntos_soporte(v_optica, p_id, p_adjuntos, false);

  insert into soporte_consultas (id, optica_id, autor_id, autor_nombre, autor_rol, modulo, tipo, urgencia, asunto, descripcion, contexto)
  values (p_id, v_optica, auth.uid(), v_nombre, _etiqueta_rol_soporte(auth.uid()), p_modulo, p_tipo, coalesce(p_urgencia, 'normal'),
          left(btrim(p_asunto), 120), left(btrim(p_descripcion), 4000), coalesce(p_contexto, '{}'::jsonb))
  returning soporte_consultas.numero into v_n;

  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo, adjuntos)
  values (p_id, v_optica, auth.uid(), v_nombre, 'optica', left(btrim(p_descripcion), 4000), v_adj);

  return query select p_id, v_n;
end;
$function$;
revoke all on function public.crear_consulta_soporte(uuid, text, text, text, text, text, jsonb, jsonb) from public, anon;
grant execute on function public.crear_consulta_soporte(uuid, text, text, text, text, text, jsonb, jsonb) to authenticated;

-- La consulta de la que se habla, si quien llama puede verla (la suya, o cualquiera de su óptica si es administrador).
create function public._consulta_visible_soporte(p_consulta uuid, p_optica uuid, p_solo_autor boolean default false)
returns public.soporte_consultas
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c soporte_consultas%rowtype;
begin
  select * into v_c from soporte_consultas c where c.id = p_consulta and c.optica_id = p_optica;
  if not found then raise exception 'No encontramos esa consulta.'; end if;
  if v_c.autor_id is distinct from auth.uid() and (p_solo_autor or not _es_admin_optica_actual()) then
    raise exception 'No encontramos esa consulta.';
  end if;
  return v_c;
end;
$function$;
revoke all on function public._consulta_visible_soporte(uuid, uuid, boolean) from public, anon, authenticated;

-- El autor (o el administrador de la óptica) agrega un mensaje a la conversación. Si estaba respondida, vuelve a "en revisión".
create function public.responder_consulta_soporte(p_consulta uuid, p_cuerpo text, p_adjuntos jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype := _consulta_visible_soporte(p_consulta, v_optica);
  v_adj jsonb;
begin
  if btrim(coalesce(p_cuerpo, '')) = '' then raise exception 'Escribe tu mensaje.'; end if;
  if v_c.estado = 'resuelta' then raise exception 'Esta consulta ya está resuelta. Si el problema sigue, reábrela.'; end if;
  v_adj := _validar_adjuntos_soporte(v_optica, p_consulta, p_adjuntos, false);
  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo, adjuntos)
  values (p_consulta, v_optica, auth.uid(), _nombre_de_quien_llama(), 'optica', left(btrim(p_cuerpo), 4000), v_adj);
  update soporte_consultas
     set estado = case when estado = 'respondida' then 'en_revision' else estado end,
         ultimo_mensaje_de = 'optica', actualizada_en = now()
   where id = p_consulta;
end;
$function$;
revoke all on function public.responder_consulta_soporte(uuid, text, jsonb) from public, anon;
grant execute on function public.responder_consulta_soporte(uuid, text, jsonb) to authenticated;

-- "Ya está resuelto": el autor (o el administrador) cierra la consulta.
create function public.cerrar_consulta_soporte(p_consulta uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype := _consulta_visible_soporte(p_consulta, v_optica);
begin
  if v_c.estado = 'resuelta' then return; end if;
  update soporte_consultas set estado = 'resuelta', resuelta_en = now(), actualizada_en = now() where id = p_consulta;
  if v_c.mensaje_origen is not null then
    perform set_config('soporte.sincronizando', '1', true);
    update mensajes set estado = 'resuelto' where id = v_c.mensaje_origen;
  end if;
end;
$function$;
revoke all on function public.cerrar_consulta_soporte(uuid) from public, anon;
grant execute on function public.cerrar_consulta_soporte(uuid) to authenticated;

-- El problema sigue: se reabre con un motivo, que queda en la conversación.
create function public.reabrir_consulta_soporte(p_consulta uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype := _consulta_visible_soporte(p_consulta, v_optica);
begin
  if v_c.estado <> 'resuelta' then raise exception 'Solo se puede reabrir una consulta resuelta.'; end if;
  if btrim(coalesce(p_motivo, '')) = '' then raise exception 'Cuéntanos qué sigue pasando.'; end if;
  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo)
  values (p_consulta, v_optica, auth.uid(), _nombre_de_quien_llama(), 'optica', left(btrim(p_motivo), 4000));
  -- La calificación era de la atención anterior: al reabrir se vuelve a pedir cuando se resuelva de nuevo.
  update soporte_consultas
     set estado = 'en_revision', resuelta_en = null, calificacion = null, calificacion_comentario = null, calificada_en = null,
         reabierta_veces = reabierta_veces + 1, ultimo_mensaje_de = 'optica', actualizada_en = now()
   where id = p_consulta;
  if v_c.mensaje_origen is not null then
    perform set_config('soporte.sincronizando', '1', true);
    update mensajes set estado = 'abierto' where id = v_c.mensaje_origen;
  end if;
end;
$function$;
revoke all on function public.reabrir_consulta_soporte(uuid, text) from public, anon;
grant execute on function public.reabrir_consulta_soporte(uuid, text) to authenticated;

-- Califica la atención (1 a 5): solo quien escribió la consulta, una vez resuelta, una sola vez.
create function public.calificar_consulta_soporte(p_consulta uuid, p_nota integer, p_comentario text default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('crear');
  v_c soporte_consultas%rowtype := _consulta_visible_soporte(p_consulta, v_optica, true);
begin
  if v_c.estado <> 'resuelta' then raise exception 'Podrás calificar cuando la consulta esté resuelta.'; end if;
  if v_c.calificacion is not null then raise exception 'Ya calificaste esta consulta.'; end if;
  if p_nota is null or p_nota < 1 or p_nota > 5 then raise exception 'La calificación va de 1 a 5.'; end if;
  update soporte_consultas
     set calificacion = p_nota, calificacion_comentario = nullif(left(btrim(coalesce(p_comentario, '')), 500), ''), calificada_en = now(), actualizada_en = now()
   where id = p_consulta;
end;
$function$;
revoke all on function public.calificar_consulta_soporte(uuid, integer, text) from public, anon;
grant execute on function public.calificar_consulta_soporte(uuid, integer, text) to authenticated;

-- El autor abrió la conversación: la respuesta deja de estar "sin leer" (la campanita baja).
create function public.marcar_consulta_soporte_leida(p_consulta uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_soporte('ver');
begin
  update soporte_consultas set respuesta_sin_leer = false where id = p_consulta and optica_id = v_optica and autor_id = auth.uid() and respuesta_sin_leer;
end;
$function$;
revoke all on function public.marcar_consulta_soporte_leida(uuid) from public, anon;
grant execute on function public.marcar_consulta_soporte_leida(uuid) to authenticated;

-- Avisos del sistema: los generales y los dirigidos a su óptica. Sin lista: marca todos los visibles.
create function public.marcar_avisos_leidos(p_mensajes uuid[] default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not perfil_activo_actual() then raise exception 'Tu cuenta está desactivada.'; end if;
  insert into avisos_leidos (perfil_id, mensaje_id)
  select auth.uid(), m.id from mensajes m
   where m.tipo = 'anuncio'
     and (m.optica_id is null or m.optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()))
     and (p_mensajes is null or m.id = any (p_mensajes))
  on conflict do nothing;
end;
$function$;
revoke all on function public.marcar_avisos_leidos(uuid[]) from public, anon;
grant execute on function public.marcar_avisos_leidos(uuid[]) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. Funciones del superadmin
-- ════════════════════════════════════════════════════════════════
-- Responde (o agrega una nota interna). Una respuesta pública pasa la consulta a "respondida" salvo que se elija otro estado.
create function public.soporte_responder(p_consulta uuid, p_cuerpo text, p_interna boolean default false, p_estado text default null, p_adjuntos jsonb default '[]'::jsonb)
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
  select * into v_c from soporte_consultas where id = p_consulta;
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
revoke all on function public.soporte_responder(uuid, text, boolean, text, jsonb) from public, anon;
grant execute on function public.soporte_responder(uuid, text, boolean, text, jsonb) to authenticated;

-- Cambia el estado sin escribir (por ejemplo "en revisión" al empezar a mirarla, o "resuelta").
create function public.soporte_cambiar_estado(p_consulta uuid, p_estado text)
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
  select * into v_c from soporte_consultas where id = p_consulta;
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
revoke all on function public.soporte_cambiar_estado(uuid, text) from public, anon;
grant execute on function public.soporte_cambiar_estado(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 6. Lo que escribe la versión publicada en `mensajes` llega a las tablas nuevas
-- ════════════════════════════════════════════════════════════════
create function public._soporte_importar_mensaje(m public.mensajes)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_estado text;
begin
  if m.tipo <> 'consulta' or m.optica_id is null then return; end if;
  if exists (select 1 from soporte_consultas c where c.mensaje_origen = m.id) then return; end if;
  v_estado := case when m.estado = 'resuelto' then 'resuelta' when m.respuesta is not null then 'respondida' else 'recibida' end;
  insert into soporte_consultas (optica_id, autor_id, autor_nombre, autor_rol, modulo, tipo, urgencia, asunto, descripcion, estado, contexto,
                                 ultimo_mensaje_de, respuesta_sin_leer, primera_respuesta_en, resuelta_en, mensaje_origen, creada_en, actualizada_en)
  values (m.optica_id, m.remitente_id, m.remitente_nombre, case when m.remitente_id is null then 'Administrador' else _etiqueta_rol_soporte(m.remitente_id) end,
          'otro', 'pregunta', 'normal', left(btrim(m.asunto), 120), left(btrim(m.cuerpo), 4000), v_estado, '{}'::jsonb,
          case when m.respuesta is not null then 'soporte' else 'optica' end, false,
          m.respondido_at, case when m.estado = 'resuelto' then coalesce(m.respondido_at, m.created_at) else null end,
          m.id, m.created_at, coalesce(m.respondido_at, m.created_at))
  returning id into v_id;
  insert into soporte_mensajes (consulta_id, optica_id, autor_id, autor_nombre, de, cuerpo, creado_en)
  values (v_id, m.optica_id, m.remitente_id, m.remitente_nombre, 'optica', left(btrim(m.cuerpo), 4000), m.created_at);
  if m.respuesta is not null and btrim(m.respuesta) <> '' then
    insert into soporte_mensajes (consulta_id, optica_id, autor_nombre, de, cuerpo, creado_en)
    values (v_id, m.optica_id, 'Soporte', 'soporte', left(btrim(m.respuesta), 4000), coalesce(m.respondido_at, m.created_at));
  end if;
end;
$function$;
revoke all on function public._soporte_importar_mensaje(public.mensajes) from public, anon, authenticated;

create function public._soporte_desde_mensaje_nuevo()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform _soporte_importar_mensaje(new);
  return new;
end;
$function$;
revoke all on function public._soporte_desde_mensaje_nuevo() from public, anon, authenticated;
create trigger mensajes_a_soporte_insert after insert on public.mensajes
  for each row when (new.tipo = 'consulta') execute function public._soporte_desde_mensaje_nuevo();

-- El superadmin de la versión publicada responde editando `mensajes`: se refleja en la conversación nueva.
create function public._soporte_desde_mensaje_editado()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_c soporte_consultas%rowtype;
begin
  if coalesce(current_setting('soporte.sincronizando', true), '') = '1' then return new; end if;
  select * into v_c from soporte_consultas c where c.mensaje_origen = new.id;
  if not found then return new; end if;
  if new.respuesta is distinct from old.respuesta and new.respuesta is not null and btrim(new.respuesta) <> '' then
    insert into soporte_mensajes (consulta_id, optica_id, autor_nombre, de, cuerpo, creado_en)
    values (v_c.id, v_c.optica_id, 'Soporte', 'soporte', left(btrim(new.respuesta), 4000), coalesce(new.respondido_at, now()));
  end if;
  update soporte_consultas
     set estado = case when new.estado = 'resuelto' then 'resuelta' when new.respuesta is not null then 'respondida' else 'recibida' end,
         ultimo_mensaje_de = case when new.respuesta is distinct from old.respuesta then 'soporte' else ultimo_mensaje_de end,
         respuesta_sin_leer = case when new.respuesta is distinct from old.respuesta or new.estado is distinct from old.estado then true else respuesta_sin_leer end,
         primera_respuesta_en = case when new.respuesta is not null then coalesce(primera_respuesta_en, new.respondido_at, now()) else primera_respuesta_en end,
         resuelta_en = case when new.estado = 'resuelto' then coalesce(resuelta_en, now()) else null end,
         actualizada_en = now()
   where id = v_c.id;
  return new;
end;
$function$;
revoke all on function public._soporte_desde_mensaje_editado() from public, anon, authenticated;
create trigger mensajes_a_soporte_update after update on public.mensajes
  for each row when (new.tipo = 'consulta' and (new.respuesta is distinct from old.respuesta or new.estado is distinct from old.estado))
  execute function public._soporte_desde_mensaje_editado();

-- Las consultas que ya existen se copian una vez.
do $$
declare
  m mensajes%rowtype;
begin
  for m in select * from mensajes where tipo = 'consulta' and optica_id is not null order by created_at loop
    perform _soporte_importar_mensaje(m);
  end loop;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- 7. Anonimizar a un paciente también limpia sus datos en Soporte
-- ════════════════════════════════════════════════════════════════
do $$
declare
  v_def text;
  v_marca constant text := '  -- ── Quienes fueron referidos por esta persona dejan de mostrar su nombre';
  v_nuevo constant text :=
'  update soporte_consultas
     set asunto = _limpiar_datos_personales(asunto, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo),
         descripcion = _limpiar_datos_personales(descripcion, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica;
  update soporte_mensajes
     set cuerpo = _limpiar_datos_personales(cuerpo, v_p.nombre, v_p.cedula, v_p.telefono, v_p.correo)
   where optica_id = v_optica;

';
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'anonimizar_paciente';
  if (length(v_def) - length(replace(v_def, v_marca, ''))) / length(v_marca) <> 1 then
    raise exception 'anonimizar_paciente no tiene el punto de inserción esperado.';
  end if;
  execute replace(v_def, v_marca, v_nuevo || v_marca);
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- 8. Soporte en los roles predefinidos de las ópticas NUEVAS
-- ════════════════════════════════════════════════════════════════
-- Cada persona ve solo sus consultas, así que Soporte ya no da acceso a lo de toda la óptica: Optómetra, Recepción y Ventas lo reciben ("ver" y "crear").
-- Solo cambia la plantilla (misma firma que 0108, sin sobrecarga): las ópticas que ya existen conservan sus roles tal como están, salvo si el
-- administrador usa "Restaurar valores originales" en uno de ellos.
create or replace function public._plantilla_rol(p_clave text)
returns jsonb
language sql
immutable
as $$
  select case p_clave
    when 'optometra' then '{
      "nombre": "Optómetra", "atiende": true, "inicio": "optometra",
      "descripcion": "Atiende pacientes: su agenda, la ficha clínica y la receta. Ve el inventario y las ventas sin modificarlos.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver","crear","editar"],"citas":["ver","crear","editar"],
                   "inventario":["ver"],"ventas":["ver"],"crm":["ver"],"reportes":["ver"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {"citas":"propio","consultas":"propio","reportes":"propio"}}'::jsonb
    when 'recepcion' then '{
      "nombre": "Recepción", "atiende": false, "inicio": "recepcion",
      "descripcion": "Agenda citas, registra pacientes y cobra. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver","crear","editar"],"consultas":["ver"],"citas":["ver","crear","editar"],
                   "ventas":["ver","crear","editar"],"inventario":["ver"],"crm":["ver","crear","editar"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {}}'::jsonb
    when 'ventas' then '{
      "nombre": "Ventas", "atiende": false, "inicio": "ventas",
      "descripcion": "Vende, arma proformas, cobra abonos y gestiona las órdenes de laboratorio. Ve la ficha clínica sin editarla.",
      "permisos": {"pacientes":["ver"],"consultas":["ver"],"citas":["ver"],"ventas":["ver","crear","editar"],
                   "inventario":["ver","crear","editar"],"crm":["ver"],"horario":["ver"],"horario_optica":["ver"],"mensajes":["ver","crear"]},
      "alcance": {}}'::jsonb
  end;
$$;

-- ════════════════════════════════════════════════════════════════
-- Para deshacer (solo si hiciera falta; la plantilla de roles: volver a aplicar la de 0108; las consultas de las tablas nuevas se perderían, las de `mensajes` siguen):
--   drop trigger mensajes_a_soporte_insert on public.mensajes; drop trigger mensajes_a_soporte_update on public.mensajes;
--   drop table public.avisos_leidos, public.soporte_respuestas_guardadas, public.soporte_mensajes, public.soporte_consultas cascade;
--   drop sequence public.soporte_numero_seq;
--   (las funciones nuevas y las políticas de storage.objects 'soporte_adjuntos_*', y vaciar y borrar el bucket 'soporte-adjuntos')
--   (anonimizar_paciente: volver a aplicar la definición de 0091)
-- ════════════════════════════════════════════════════════════════
