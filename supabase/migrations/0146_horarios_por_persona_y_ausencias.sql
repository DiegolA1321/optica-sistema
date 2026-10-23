-- 0146 — Horarios por persona y ausencias con documento de respaldo (Ronda 5, puntos 1 a 4: Horario).
--
-- Hasta hoy cada persona escribía su propio «Mi horario» (sin efecto en la agenda) y avisaba «No podré asistir» (un rango de horas que bloqueaba a TODA la óptica). Ahora:
--
--   1. HORARIO POR PERSONA. Lo asigna la administración: horarios_usuario gana `usa_horario_optica` (por defecto sí: cada persona usa el horario de la óptica). Quien lo cambia es el administrador,
--      con guardar_horario_persona(persona, usa_optica, horario), que exige que cada turno quede DENTRO del horario de la óptica de ese día. La persona solo lo lee (se quita la política que le dejaba
--      escribirlo). Ninguna fila existente cambia de efecto: todas pasan a «usa el horario de la óptica».
--   2. AUSENCIAS. Tabla ausencias_personal (tipo, día o días, todo el día / mañana / tarde, motivo, documento de respaldo opcional, estado pendiente/aprobada/rechazada/cancelada) y sus funciones:
--        solicitar_ausencia (cualquier persona del personal), resolver_ausencia (solo el administrador; al responder la persona recibe un aviso interno), retirar_ausencia (la persona su solicitud
--        pendiente; el administrador una pendiente o aprobada).
--      Solo la persona y el administrador de su óptica leen la fila. El superadmin no tiene política: no la ve.
--   3. DOCUMENTO DE RESPALDO. Bucket PRIVADO `ausencias-documentos` (PDF o foto, hasta 5 MB), ruta {óptica}/{persona}/archivo: lo sube la persona a su carpeta, y lo leen la persona y el administrador de
--      esa óptica. Ningún otro empleado ni el superadmin (las políticas no los incluyen).
--   4. AGENDA Y WEB. agenda_profesionales(óptica) entrega, de quienes atienden pacientes, su horario efectivo y sus ausencias APROBADAS (solo fechas y franja: nunca el motivo, el tipo ni el documento).
--      La pantalla calcula con eso la agenda de cada profesional y las horas que ofrece la web; validar_horario_reserva_web (que usan crear_cita_publica y reagendar_cita_publica) exige lo mismo en el
--      servidor: una hora solo se ofrece si algún profesional trabaja y no está ausente. Una óptica sin profesionales marcados (o sin horario propio ni ausencias) se comporta exactamente como hasta hoy.
--
-- Qué NO cambia: ningún dato existente se borra ni cambia de efecto; registrar_ausencia / quitar_ausencia (el «No podré asistir» de antes) siguen en la base sin usarse y las ausencias que ya
-- estaban guardadas en el horario general se siguen respetando. Una óptica nueva no necesita nada (todos usan el horario de la óptica hasta que el administrador lo cambie).
--
-- Revertir: drop table public.ausencias_personal cascade; las funciones nuevas (guardar_horario_persona, solicitar_ausencia, resolver_ausencia, retirar_ausencia, agenda_profesionales,
--   _profesional_disponible); volver validar_horario_reserva_web a su cuerpo de 0103; recrear la política horarios_usuario_propio de 0050; alter table horarios_usuario drop column usa_horario_optica;
--   vaciar y borrar el bucket 'ausencias-documentos' con sus políticas.

-- ════════════════════════════════════════════════════════════════
-- 1. Horario por persona
-- ════════════════════════════════════════════════════════════════
alter table public.horarios_usuario
  add column if not exists usa_horario_optica boolean not null default true;

drop policy if exists horarios_usuario_propio on public.horarios_usuario;
create policy horarios_usuario_propio_lee on public.horarios_usuario for select
  using (usuario_id = auth.uid() and optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual());
-- Se escribe solo con guardar_horario_persona (el administrador).
revoke insert, update, delete on public.horarios_usuario from authenticated;

-- ¿Este horario semanal de una persona cabe en el de la óptica? Devuelve el primer problema («lunes, mañana») o null.
create or replace function public._horario_persona_problema(p_optica uuid, p_horario jsonb)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  v_semanal jsonb;
  v_dia text;
  v_turno text;
  v_t jsonb;
  v_o jsonb;
  v_ini int;
  v_fin int;
  v_cabe boolean;
  v_s text;
  v_nombres text[] := array['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
begin
  if p_horario is null or jsonb_typeof(p_horario) <> 'object' then return 'El horario no es válido.'; end if;
  select horario_semanal into v_semanal from disponibilidad where optica_id = p_optica;
  foreach v_dia in array v_nombres loop
    foreach v_turno in array array['manana', 'tarde'] loop
      v_t := p_horario -> v_dia -> v_turno;
      if v_t is null or coalesce((v_t ->> 'activo')::boolean, false) = false then continue; end if;
      if (v_t ->> 'inicio') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or (v_t ->> 'fin') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then return v_dia || ', ' || v_turno || ': la hora no es válida.'; end if;
      v_ini := split_part(v_t ->> 'inicio', ':', 1)::int * 60 + split_part(v_t ->> 'inicio', ':', 2)::int;
      v_fin := split_part(v_t ->> 'fin', ':', 1)::int * 60 + split_part(v_t ->> 'fin', ':', 2)::int;
      if v_fin <= v_ini then return v_dia || ', ' || v_turno || ': el fin debe ser después del inicio.'; end if;
      if v_semanal is null then continue; end if; -- óptica sin horario configurado: no se valida (como la reserva web)
      v_cabe := false;
      foreach v_s in array array['manana', 'tarde'] loop
        v_o := v_semanal -> v_dia -> v_s;
        if coalesce((v_o ->> 'activo')::boolean, false)
           and v_ini >= split_part(v_o ->> 'inicio', ':', 1)::int * 60 + split_part(v_o ->> 'inicio', ':', 2)::int
           and v_fin <= split_part(v_o ->> 'fin', ':', 1)::int * 60 + split_part(v_o ->> 'fin', ':', 2)::int then
          v_cabe := true;
        end if;
      end loop;
      if not v_cabe then return v_dia || ', ' || v_turno || ': queda fuera del horario de la óptica.'; end if;
    end loop;
  end loop;
  return null;
end;
$$;
revoke all on function public._horario_persona_problema(uuid, jsonb) from public, anon, authenticated;

create or replace function public.guardar_horario_persona(p_usuario uuid, p_usa_optica boolean, p_horario jsonb default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_id_admin_actual();
  v_persona perfiles%rowtype;
  v_problema text;
begin
  if v_optica is null or not optica_activa_actual() or not mfa_satisfecho() then raise exception 'Solo el administrador puede asignar los horarios del personal.'; end if;
  select * into v_persona from perfiles where id = p_usuario and optica_id = v_optica and rol in ('admin', 'asistente') and activo;
  if not found then raise exception 'La persona no está activa en tu óptica.'; end if;
  if coalesce(p_usa_optica, true) then
    insert into horarios_usuario (usuario_id, optica_id, horario_semanal, usa_horario_optica, updated_at)
    values (p_usuario, v_optica, '{}'::jsonb, true, now())
    on conflict (usuario_id) do update set horario_semanal = '{}'::jsonb, usa_horario_optica = true, updated_at = now();
  else
    v_problema := _horario_persona_problema(v_optica, p_horario);
    if v_problema is not null then raise exception '%', 'El horario debe estar dentro del de la óptica. ' || v_problema; end if;
    insert into horarios_usuario (usuario_id, optica_id, horario_semanal, usa_horario_optica, updated_at)
    values (p_usuario, v_optica, p_horario, false, now())
    on conflict (usuario_id) do update set horario_semanal = excluded.horario_semanal, usa_horario_optica = false, updated_at = now();
  end if;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), _nombre_de_quien_llama(), 'horario', 'Cambió el horario de una persona', v_persona.nombre || case when coalesce(p_usa_optica, true) then ' · usa el horario de la óptica' else '' end);
end;
$function$;
revoke all on function public.guardar_horario_persona(uuid, boolean, jsonb) from public, anon;
grant execute on function public.guardar_horario_persona(uuid, boolean, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 2. Ausencias
-- ════════════════════════════════════════════════════════════════
create table public.ausencias_personal (
  id                uuid primary key default gen_random_uuid(),
  optica_id         uuid not null references public.opticas(id) on delete cascade,
  usuario_id        uuid not null references public.perfiles(id) on delete cascade,
  usuario_nombre    text not null,
  tipo              text not null check (tipo in ('cita_medica', 'vacaciones', 'permiso_personal', 'calamidad', 'otro')),
  fecha_desde       date not null,
  fecha_hasta       date not null,
  franja            text not null default 'todo' check (franja in ('todo', 'manana', 'tarde')),
  motivo            text check (motivo is null or char_length(motivo) <= 300),
  documento_ruta    text,
  documento_nombre  text,
  estado            text not null default 'pendiente' check (estado in ('pendiente', 'aprobada', 'rechazada', 'cancelada')),
  motivo_rechazo    text,
  resuelto_por      uuid references public.perfiles(id) on delete set null,
  resuelto_por_nombre text,
  resuelto_en       timestamptz,
  creada_en         timestamptz not null default now(),
  check (fecha_hasta >= fecha_desde),
  check (franja = 'todo' or fecha_desde = fecha_hasta)
);
create index ausencias_personal_optica_idx on public.ausencias_personal (optica_id, estado, fecha_desde);
create index ausencias_personal_usuario_idx on public.ausencias_personal (usuario_id, fecha_desde);

alter table public.ausencias_personal enable row level security;
revoke all on public.ausencias_personal from public, anon, authenticated;
grant select on public.ausencias_personal to authenticated;
-- La persona ve las suyas; el administrador, las de su óptica. Nadie más (tampoco el superadmin: no hay política para él).
create policy ausencias_personal_propias on public.ausencias_personal for select
  using (usuario_id = auth.uid() and optica_activa_actual());
create policy ausencias_personal_del_administrador on public.ausencias_personal for select
  using (optica_id = optica_id_admin_actual() and optica_activa_actual());
create policy exige_aal2_si_mfa_activo on public.ausencias_personal as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());

create or replace function public.solicitar_ausencia(
  p_tipo text, p_desde date, p_hasta date, p_franja text default 'todo', p_motivo text default null, p_doc_ruta text default null, p_doc_nombre text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_yo perfiles%rowtype;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_id uuid;
  v_obj record;
begin
  select * into v_yo from perfiles where id = auth.uid() and rol in ('admin', 'asistente') and activo;
  if not found then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() or not mfa_satisfecho() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if p_tipo not in ('cita_medica', 'vacaciones', 'permiso_personal', 'calamidad', 'otro') then raise exception 'Elige el tipo de ausencia.'; end if;
  if coalesce(p_franja, 'todo') not in ('todo', 'manana', 'tarde') then raise exception 'Elige si es todo el día, la mañana o la tarde.'; end if;
  if p_desde is null or p_hasta is null then raise exception 'Indica el día de la ausencia.'; end if;
  if p_desde < v_hoy then raise exception 'La ausencia no puede empezar en un día que ya pasó.'; end if;
  if p_hasta < p_desde then raise exception 'El último día no puede ser antes del primero.'; end if;
  if p_hasta - p_desde > 120 then raise exception 'Una ausencia puede durar hasta 120 días.'; end if;
  if coalesce(p_franja, 'todo') <> 'todo' and p_desde <> p_hasta then raise exception 'La mañana o la tarde se piden para un solo día.'; end if;
  if char_length(coalesce(p_motivo, '')) > 300 then raise exception 'El motivo puede tener hasta 300 letras.'; end if;
  if exists (
    select 1 from ausencias_personal a
     where a.usuario_id = v_yo.id and a.estado in ('pendiente', 'aprobada')
       and a.fecha_desde <= p_hasta and a.fecha_hasta >= p_desde
       and (a.franja = 'todo' or coalesce(p_franja, 'todo') = 'todo' or a.franja = p_franja)
  ) then raise exception 'Ya tienes una ausencia pendiente o aprobada en esos días.'; end if;

  if p_doc_ruta is not null then
    if left(p_doc_ruta, char_length(v_yo.optica_id::text || '/' || v_yo.id::text || '/')) <> v_yo.optica_id::text || '/' || v_yo.id::text || '/'
       or position('/' in substr(p_doc_ruta, char_length(v_yo.optica_id::text || '/' || v_yo.id::text || '/') + 1)) > 0 then
      raise exception 'El documento no está en el lugar correcto: vuelve a adjuntarlo.';
    end if;
    select o.name, coalesce((o.metadata ->> 'size')::bigint, 0) as bytes, o.metadata ->> 'mimetype' as tipo
      into v_obj from storage.objects o where o.bucket_id = 'ausencias-documentos' and o.name = p_doc_ruta;
    if not found then raise exception 'El documento no se subió: vuelve a adjuntarlo.'; end if;
    if v_obj.bytes > 5242880 then raise exception 'El documento puede pesar hasta 5 MB.'; end if;
    if v_obj.tipo is null or v_obj.tipo not in ('application/pdf', 'image/png', 'image/jpeg', 'image/webp') then raise exception 'El documento debe ser un PDF o una foto.'; end if;
  end if;

  insert into ausencias_personal (optica_id, usuario_id, usuario_nombre, tipo, fecha_desde, fecha_hasta, franja, motivo, documento_ruta, documento_nombre)
  values (v_yo.optica_id, v_yo.id, v_yo.nombre, p_tipo, p_desde, p_hasta, coalesce(p_franja, 'todo'), nullif(btrim(p_motivo), ''), p_doc_ruta, case when p_doc_ruta is null then null else left(coalesce(nullif(btrim(p_doc_nombre), ''), 'documento'), 120) end)
  returning id into v_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_yo.optica_id, v_yo.id, v_yo.nombre, 'horario', 'Solicitó una ausencia', p_desde::text || case when p_hasta <> p_desde then ' al ' || p_hasta::text else '' end);
  return v_id;
end;
$function$;
revoke all on function public.solicitar_ausencia(text, date, date, text, text, text, text) from public, anon;
grant execute on function public.solicitar_ausencia(text, date, date, text, text, text, text) to authenticated;

create or replace function public.resolver_ausencia(p_id uuid, p_aprobar boolean, p_motivo text default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_id_admin_actual();
  v_a ausencias_personal%rowtype;
  v_nombre text := _nombre_de_quien_llama();
  v_cuando text;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
begin
  if v_optica is null or not optica_activa_actual() or not mfa_satisfecho() then raise exception 'Solo el administrador puede aprobar o rechazar ausencias.'; end if;
  select * into v_a from ausencias_personal where id = p_id and optica_id = v_optica for update;
  if not found then raise exception 'No se encontró la ausencia.'; end if;
  if v_a.estado <> 'pendiente' then raise exception 'Esta ausencia ya fue respondida.'; end if;
  if not coalesce(p_aprobar, false) and char_length(btrim(coalesce(p_motivo, ''))) < 3 then raise exception 'Escribe el motivo del rechazo.'; end if;
  update ausencias_personal
     set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         motivo_rechazo = case when p_aprobar then null else left(btrim(p_motivo), 300) end,
         resuelto_por = auth.uid(), resuelto_por_nombre = v_nombre, resuelto_en = now()
   where id = p_id;
  v_cuando := to_char(v_a.fecha_desde, 'DD/MM/YYYY') || case when v_a.fecha_hasta <> v_a.fecha_desde then ' al ' || to_char(v_a.fecha_hasta, 'DD/MM/YYYY') else '' end
              || case v_a.franja when 'manana' then ' (mañana)' when 'tarde' then ' (tarde)' else '' end;
  -- La persona recibe la respuesta como un aviso interno (campanita, Inicio y Soporte → Avisos).
  insert into avisos_internos (optica_id, autor_id, autor_nombre, titulo, cuerpo, para, perfil_id, vence_el)
  values (v_optica, auth.uid(), v_nombre,
          case when p_aprobar then 'Tu ausencia fue aprobada' else 'Tu ausencia fue rechazada' end,
          'Tu solicitud de ausencia del ' || v_cuando || ' fue ' || case when p_aprobar then 'aprobada. Ese tiempo queda bloqueado en tu agenda.' else 'rechazada. Motivo: ' || left(btrim(p_motivo), 300) end,
          'persona', v_a.usuario_id, v_hoy + 30);
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, 'horario', case when p_aprobar then 'Aprobó una ausencia' else 'Rechazó una ausencia' end, v_a.usuario_nombre || ' · ' || v_cuando);
  return jsonb_build_object('estado', case when p_aprobar then 'aprobada' else 'rechazada' end);
end;
$function$;
revoke all on function public.resolver_ausencia(uuid, boolean, text) from public, anon;
grant execute on function public.resolver_ausencia(uuid, boolean, text) to authenticated;

create or replace function public.retirar_ausencia(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_a ausencias_personal%rowtype;
  v_admin uuid := optica_id_admin_actual();
begin
  select * into v_a from ausencias_personal where id = p_id;
  if not found then raise exception 'No se encontró la ausencia.'; end if;
  if not optica_activa_actual() or not mfa_satisfecho() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if v_a.usuario_id = auth.uid() and v_a.estado = 'pendiente' then null; -- la persona retira su solicitud mientras nadie la responda
  elsif v_admin is not null and v_a.optica_id = v_admin and v_a.estado in ('pendiente', 'aprobada') then null; -- el administrador devuelve ese tiempo a la agenda
  else raise exception 'No puedes retirar esta ausencia.'; end if;
  update ausencias_personal set estado = 'cancelada', resuelto_en = coalesce(resuelto_en, now()) where id = p_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_a.optica_id, auth.uid(), _nombre_de_quien_llama(), 'horario', 'Retiró una ausencia', v_a.usuario_nombre || ' · ' || v_a.fecha_desde::text);
  return true;
end;
$function$;
revoke all on function public.retirar_ausencia(uuid) from public, anon;
grant execute on function public.retirar_ausencia(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 3. Documento de respaldo (privado)
-- ════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ausencias-documentos', 'ausencias-documentos', false, 5242880, array['application/pdf', 'image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy ausencias_documentos_subida_propia on storage.objects for insert to authenticated
  with check (bucket_id = 'ausencias-documentos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid() and perfiles.activo)
    and (storage.foldername(name))[2] = auth.uid()::text);
create policy ausencias_documentos_lectura on storage.objects for select to authenticated
  using (bucket_id = 'ausencias-documentos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid() and perfiles.activo)
    and ((storage.foldername(name))[2] = auth.uid()::text or (storage.foldername(name))[1] = (select public.optica_id_admin_actual())::text));
create policy ausencias_documentos_borrado_propio on storage.objects for delete to authenticated
  using (bucket_id = 'ausencias-documentos' and array_length(storage.foldername(name), 1) = 2
    and (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid() and perfiles.activo)
    and (storage.foldername(name))[2] = auth.uid()::text);

-- ════════════════════════════════════════════════════════════════
-- 4. Agenda de los profesionales y horas de la web
-- ════════════════════════════════════════════════════════════════
-- Quienes atienden pacientes: su horario efectivo (null = el de la óptica) y sus ausencias aprobadas (solo fechas y franja).
create or replace function public.agenda_profesionales(p_optica_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'usaOptica', coalesce(h.usa_horario_optica, true),
    'horario', case when coalesce(h.usa_horario_optica, true) then null else h.horario_semanal end,
    'ausencias', coalesce((
      select jsonb_agg(jsonb_build_object('desde', a.fecha_desde, 'hasta', a.fecha_hasta, 'franja', a.franja) order by a.fecha_desde)
        from ausencias_personal a
       where a.usuario_id = p.id and a.estado = 'aprobada' and a.fecha_hasta >= (now() at time zone 'America/Guayaquil')::date), '[]'::jsonb))
    order by p.nombre), '[]'::jsonb)
  from perfiles p
  left join horarios_usuario h on h.usuario_id = p.id
  where p.optica_id = p_optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false)
    and exists (select 1 from opticas o where o.id = p_optica_id and o.activa);
$$;
revoke all on function public.agenda_profesionales(uuid) from public;
grant execute on function public.agenda_profesionales(uuid) to anon, authenticated;

-- ¿Algún profesional trabaja a esa hora y no está ausente? Sin profesionales marcados, sí (la óptica atiende como siempre).
create or replace function public._profesional_disponible(p_optica uuid, p_fecha date, p_min int, p_dia_optica jsonb)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pros jsonb := agenda_profesionales(p_optica);
  v_p jsonb;
  v_dia jsonb;
  v_turno text;
  v_s jsonb;
  v_a jsonb;
  v_trabaja boolean;
  v_ausente boolean;
  v_nombres text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  v_ini int;
  v_fin int;
begin
  if jsonb_array_length(v_pros) = 0 then return true; end if;
  for v_p in select * from jsonb_array_elements(v_pros) loop
    v_dia := case when (v_p ->> 'usaOptica')::boolean then p_dia_optica else v_p -> 'horario' -> v_nombres[extract(dow from p_fecha)::int + 1] end;
    v_trabaja := false;
    if v_dia is not null then
      foreach v_turno in array array['manana', 'tarde'] loop
        v_s := v_dia -> v_turno;
        if coalesce((v_s ->> 'activo')::boolean, false)
           and p_min >= split_part(v_s ->> 'inicio', ':', 1)::int * 60 + split_part(v_s ->> 'inicio', ':', 2)::int
           and p_min <  split_part(v_s ->> 'fin', ':', 1)::int * 60 + split_part(v_s ->> 'fin', ':', 2)::int then
          v_trabaja := true;
        end if;
      end loop;
    end if;
    if not v_trabaja then continue; end if;
    v_ausente := false;
    for v_a in select * from jsonb_array_elements(v_p -> 'ausencias') loop
      if p_fecha >= (v_a ->> 'desde')::date and p_fecha <= (v_a ->> 'hasta')::date then
        if v_a ->> 'franja' = 'todo' then v_ausente := true;
        else
          -- mañana o tarde = esa sesión del horario de la óptica de ese día
          v_s := p_dia_optica -> (v_a ->> 'franja');
          v_ini := split_part(v_s ->> 'inicio', ':', 1)::int * 60 + split_part(v_s ->> 'inicio', ':', 2)::int;
          v_fin := split_part(v_s ->> 'fin', ':', 1)::int * 60 + split_part(v_s ->> 'fin', ':', 2)::int;
          if coalesce((v_s ->> 'activo')::boolean, false) and p_min >= v_ini and p_min < v_fin then v_ausente := true; end if;
        end if;
      end if;
    end loop;
    if not v_ausente then return true; end if;
  end loop;
  return false;
end;
$$;
revoke all on function public._profesional_disponible(uuid, date, int, jsonb) from public, anon, authenticated;

-- La validación de la reserva web de 0103, con una regla más al final: que algún profesional atienda a esa hora. El resto es idéntico.
create or replace function public.validar_horario_reserva_web(p_optica_id uuid, p_fecha date, p_hora text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_semanal jsonb;
  v_excs jsonb;
  v_exc jsonb;
  v_base jsonb;
  v_dia jsonb;
  v_partes text[];
  v_min int;
  v_clave text;
  v_sesion jsonb;
  v_ok boolean := false;
begin
  select horario_semanal, excepciones into v_semanal, v_excs from disponibilidad where optica_id = p_optica_id;
  if not found then
    return;
  end if;

  v_exc := v_excs -> p_fecha::text;
  v_base := v_semanal -> (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from p_fecha)::int + 1];
  v_dia := coalesce(v_exc, v_base);

  if v_dia is null
     or not (coalesce((v_dia -> 'manana' ->> 'activo')::boolean, false) or coalesce((v_dia -> 'tarde' ->> 'activo')::boolean, false)) then
    raise exception 'Ese día la óptica no atiende. Elige otro.';
  end if;

  -- Abierto por excepción en un día que el horario habitual tiene cerrado: solo para el personal.
  if v_exc is not null
     and not (coalesce((v_base -> 'manana' ->> 'activo')::boolean, false) or coalesce((v_base -> 'tarde' ->> 'activo')::boolean, false)) then
    raise exception 'Ese día no admite reservas en línea. Elige otro.';
  end if;

  v_partes := regexp_match(trim(coalesce(p_hora, '')), '^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$', 'i');
  if v_partes is null then
    raise exception 'La hora no es válida.';
  end if;
  v_min := ((v_partes[1]::int % 12) + case when upper(v_partes[3]) = 'PM' then 12 else 0 end) * 60 + v_partes[2]::int;

  foreach v_clave in array array['manana', 'tarde'] loop
    v_sesion := v_dia -> v_clave;
    if coalesce((v_sesion ->> 'activo')::boolean, false)
       and v_sesion ->> 'inicio' is not null and v_sesion ->> 'fin' is not null
       and v_min >= split_part(v_sesion ->> 'inicio', ':', 1)::int * 60 + split_part(v_sesion ->> 'inicio', ':', 2)::int
       and v_min <  split_part(v_sesion ->> 'fin', ':', 1)::int * 60 + split_part(v_sesion ->> 'fin', ':', 2)::int then
      v_ok := true;
    end if;
  end loop;
  if not v_ok then
    raise exception 'Esa hora está fuera del horario de atención. Elige otra.';
  end if;

  -- (0146) El horario y las ausencias de quienes atienden: la hora se ofrece si al menos un profesional trabaja y no está ausente.
  if not _profesional_disponible(p_optica_id, p_fecha, v_min, v_dia) then
    raise exception 'Esa hora ya no está disponible. Elige otra.';
  end if;
end;
$$;
revoke all on function public.validar_horario_reserva_web(uuid, date, text) from public, anon, authenticated;
