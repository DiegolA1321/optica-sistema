-- CRM v2 (rama crm-v2): historial de contactos, consentimiento del paciente, campañas y plantillas.
--
-- QUÉ HACE
--   1. Consentimiento: cada paciente tiene dos permisos separados, `acepta_recordatorios` (salud: control y citas; sí por defecto) y
--      `acepta_promociones` (no por defecto), con quién y cuándo los cambió. Cada cambio queda en `consentimientos_historial` (inmutable),
--      lo escriba quien lo escriba (el personal desde el perfil o el CRM, o el propio paciente desde su portal): un disparador lo anota.
--   2. `crm_contactos`: el historial de contactos (qué paciente, por qué motivo, por qué canal, qué mensaje, qué pasó, cuándo volver a
--      intentar, quién lo hizo). Lo escriben solo las funciones de abajo, que ponen ellas mismas quién y cuándo.
--   3. `crm_campanas`: un mensaje preparado para un grupo; cada envío por WhatsApp es un contacto con el id de la campaña.
--   4. `crm_plantillas`: los mensajes editables por motivo (si no hay fila, vale el texto base de la pantalla).
--   5. Los dos correos automáticos de hoy (saludo de cumpleaños y recordatorio de la cita de mañana) dejan de salir para quien no acepta
--      'Recordatorios de salud' (mismas funciones, misma firma, una condición más).
--   6. Funciones: registrar_contacto_crm, registrar_resultado_contacto_crm, crear_campana_crm, guardar_plantilla_crm,
--      cambiar_consentimiento_paciente (personal) y actualizar_consentimiento_paciente / mis_permisos_mensajes (portal del paciente).
--
-- CÓMO NO ROMPE LO PUBLICADO
--   · Las columnas nuevas de `pacientes_base` tienen valor por defecto y se agregan al FINAL de la vista `pacientes`; la pantalla publicada
--     no las conoce y las ignora. Los dos disparadores de la vista (insertar y actualizar) conservan todo lo que hacen hoy: se tomaron en vivo
--     de la base y solo se les suman las dos columnas, que un cliente que no las envía deja como estaban.
--   · No cambia la firma de ninguna función existente.
--   · Lo que el servidor impide: escribirle por promociones a quien no las aceptó, o por salud a quien dijo que no quiere mensajes.
--
-- Ensayo: scripts/ensayo-0114.mjs (dentro de una transacción que se revierte).

-- ════════════════════════════════════════════════════════════════
-- 1. Consentimiento
-- ════════════════════════════════════════════════════════════════
alter table public.pacientes_base
  add column if not exists acepta_recordatorios boolean not null default true,
  add column if not exists acepta_promociones boolean not null default false,
  add column if not exists consentimiento_actualizado_en timestamptz,
  add column if not exists consentimiento_actualizado_por text;

create table public.consentimientos_historial (
  id                 uuid primary key default gen_random_uuid(),
  optica_id          uuid not null references public.opticas(id) on delete cascade,
  paciente_id        uuid not null references public.pacientes_base(id) on delete cascade,
  permiso            text not null check (permiso in ('recordatorios', 'promociones')),
  valor              boolean not null,
  origen             text not null check (origen in ('personal', 'crm', 'paciente', 'sistema')),
  cambiado_por       uuid,
  cambiado_por_nombre text not null,
  cambiado_en        timestamptz not null default now()
);
create index consentimientos_historial_paciente_idx on public.consentimientos_historial (paciente_id, cambiado_en desc);

alter table public.consentimientos_historial enable row level security;
create policy consentimientos_historial_select on public.consentimientos_historial for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('crm', 'ver')) or (select tiene_permiso('pacientes', 'ver')))
  );
create policy consentimientos_historial_superadmin_select on public.consentimientos_historial for select using (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.consentimientos_historial as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
revoke all on public.consentimientos_historial from public, anon, authenticated;
grant select on public.consentimientos_historial to authenticated;

create function public._historial_inmutable()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Este historial no se puede modificar.';
  end if;
  if exists (select 1 from public.opticas where id = old.optica_id) and exists (select 1 from public.pacientes_base where id = old.paciente_id) then
    raise exception 'Este historial no se puede borrar.';
  end if;
  return old;
end;
$function$;
create trigger consentimientos_historial_inmutable
  before update or delete on public.consentimientos_historial
  for each row execute function public._historial_inmutable();

-- Cada cambio de un permiso queda anotado con quién y cuándo. Quien lo hace lo dice con `app.origen_consentimiento` (lo fijan las funciones de
-- abajo); un cambio directo (otra vía) se anota como "personal" a nombre de quien tiene la sesión.
create function public._registrar_cambio_consentimiento()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_origen text := coalesce(nullif(current_setting('app.origen_consentimiento', true), ''), 'personal');
  v_uid uuid := auth.uid();
  v_quien text;
begin
  if new.acepta_recordatorios is not distinct from old.acepta_recordatorios and new.acepta_promociones is not distinct from old.acepta_promociones then
    return new;
  end if;
  if v_origen = 'paciente' then
    v_quien := old.nombre;
    v_uid := null;
  else
    select p.nombre into v_quien from perfiles p where p.id = v_uid;
    if v_quien is null then
      v_origen := 'sistema';
      v_quien := 'Sistema';
    end if;
  end if;
  new.consentimiento_actualizado_en := now();
  new.consentimiento_actualizado_por := v_quien;
  if new.acepta_recordatorios is distinct from old.acepta_recordatorios then
    insert into consentimientos_historial (optica_id, paciente_id, permiso, valor, origen, cambiado_por, cambiado_por_nombre)
    values (old.optica_id, old.id, 'recordatorios', new.acepta_recordatorios, v_origen, v_uid, v_quien);
  end if;
  if new.acepta_promociones is distinct from old.acepta_promociones then
    insert into consentimientos_historial (optica_id, paciente_id, permiso, valor, origen, cambiado_por, cambiado_por_nombre)
    values (old.optica_id, old.id, 'promociones', new.acepta_promociones, v_origen, v_uid, v_quien);
  end if;
  return new;
end;
$function$;
revoke all on function public._registrar_cambio_consentimiento() from public, anon, authenticated;
create trigger registrar_cambio_consentimiento
  before update of acepta_recordatorios, acepta_promociones on public.pacientes_base
  for each row execute function public._registrar_cambio_consentimiento();

-- La vista `pacientes`: mismas columnas y mismo orden, y las cuatro nuevas al final.
create or replace view public.pacientes with (security_invoker = true) as
 select id,
    optica_id,
    nombre,
    cedula,
    telefono,
    correo,
    fecha_nacimiento,
    ultima_consulta,
    descifrar_clinico(estado_clinico_enc) as estado_clinico,
    referido_por,
    descifrar_clinico(evolucion_enc) as evolucion,
    descifrar_clinico(estado_correccion_enc) as estado_correccion,
    fecha_registro,
    tiene_cuenta,
    usuario,
    clave_temporal,
    created_at,
    updated_at,
    sesion_token,
    ultimo_saludo_cumple_anio,
    intentos_fallidos,
    bloqueado_hasta,
    referido_por_id,
    origen,
    confirmado_recepcion,
    medidas_solicitadas_en,
    acepta_recordatorios,
    acepta_promociones,
    consentimiento_actualizado_en,
    consentimiento_actualizado_por
   from public.pacientes_base pb
  where pb.anonimizado_en is null;

-- Los disparadores de la vista, tal como están hoy en la base, más los dos permisos.
create or replace function public.pacientes_instead_insert()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_id uuid;
begin
  insert into pacientes_base (
    optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta,
    estado_clinico_enc, referido_por, referido_por_id, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta, origen,
    confirmado_recepcion, medidas_solicitadas_en, acepta_recordatorios, acepta_promociones
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta,
    coalesce(new.origen, 'staff'),
    coalesce(new.confirmado_recepcion, coalesce(new.origen, 'staff') = 'staff'),
    new.medidas_solicitadas_en,
    coalesce(new.acepta_recordatorios, true), coalesce(new.acepta_promociones, false)
  )
  returning id into v_id;

  select * into new from pacientes where id = v_id;
  return new;
end;
$function$;

create or replace function public.pacientes_instead_update()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  update pacientes_base set
    optica_id = new.optica_id,
    nombre = new.nombre,
    cedula = new.cedula,
    telefono = new.telefono,
    correo = new.correo,
    fecha_nacimiento = new.fecha_nacimiento,
    ultima_consulta = new.ultima_consulta,
    estado_clinico_enc = cifrar_clinico(new.estado_clinico),
    referido_por = new.referido_por,
    referido_por_id = new.referido_por_id,
    evolucion_enc = cifrar_clinico(new.evolucion),
    estado_correccion_enc = cifrar_clinico(new.estado_correccion),
    fecha_registro = new.fecha_registro,
    tiene_cuenta = new.tiene_cuenta,
    usuario = new.usuario,
    clave_temporal = new.clave_temporal,
    updated_at = new.updated_at,
    sesion_token = new.sesion_token,
    ultimo_saludo_cumple_anio = new.ultimo_saludo_cumple_anio,
    intentos_fallidos = new.intentos_fallidos,
    bloqueado_hasta = new.bloqueado_hasta,
    origen = coalesce(new.origen, old.origen),
    confirmado_recepcion = coalesce(new.confirmado_recepcion, old.confirmado_recepcion),
    medidas_solicitadas_en = new.medidas_solicitadas_en,
    acepta_recordatorios = coalesce(new.acepta_recordatorios, old.acepta_recordatorios),
    acepta_promociones = coalesce(new.acepta_promociones, old.acepta_promociones)
  where id = old.id;
  return new;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- 2. Contactos, campañas y plantillas
-- ════════════════════════════════════════════════════════════════
create table public.crm_campanas (
  id               uuid primary key default gen_random_uuid(),
  optica_id        uuid not null references public.opticas(id) on delete cascade,
  nombre           text not null check (char_length(btrim(nombre)) between 3 and 80),
  grupo            text not null check (grupo in ('control_vencido', 'sin_visitar', 'cumpleanos_mes', 'promociones')),
  mensaje          text not null check (char_length(btrim(mensaje)) between 10 and 500),
  creada_por       uuid,
  creada_por_nombre text not null,
  creada_en        timestamptz not null default now()
);
create index crm_campanas_optica_idx on public.crm_campanas (optica_id, creada_en desc);

create table public.crm_contactos (
  id                  uuid primary key default gen_random_uuid(),
  optica_id           uuid not null references public.opticas(id) on delete cascade,
  paciente_id         uuid not null references public.pacientes_base(id) on delete cascade,
  motivo              text not null check (motivo in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion')),
  canal               text not null default 'whatsapp' check (canal in ('whatsapp', 'llamada', 'presencial', 'correo')),
  mensaje             text check (mensaje is null or char_length(mensaje) <= 1000),
  campana_id          uuid references public.crm_campanas(id) on delete set null,
  resultado           text check (resultado in ('agendo', 'no_respondio', 'volver_a_contactar', 'no_le_interesa', 'no_desea_mensajes')),
  volver_el           date,
  resultado_en        timestamptz,
  resultado_por_nombre text,
  creado_por          uuid,
  creado_por_nombre   text not null,
  creado_en           timestamptz not null default now(),
  constraint crm_contactos_volver_valido check ((resultado = 'volver_a_contactar') = (volver_el is not null))
);
create index crm_contactos_optica_idx on public.crm_contactos (optica_id, creado_en desc);
create index crm_contactos_paciente_idx on public.crm_contactos (paciente_id, creado_en desc);
create index crm_contactos_campana_idx on public.crm_contactos (campana_id) where campana_id is not null;

create table public.crm_plantillas (
  optica_id            uuid not null references public.opticas(id) on delete cascade,
  motivo               text not null check (motivo in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion')),
  texto                text not null check (char_length(btrim(texto)) between 10 and 500),
  actualizada_por_nombre text not null,
  actualizada_en       timestamptz not null default now(),
  primary key (optica_id, motivo)
);

alter table public.crm_campanas enable row level security;
alter table public.crm_contactos enable row level security;
alter table public.crm_plantillas enable row level security;

-- Se leen con CRM "ver", en la óptica propia. Nadie escribe directo: solo las funciones (security definer).
create policy crm_campanas_select on public.crm_campanas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and (select tiene_permiso('crm', 'ver')));
create policy crm_contactos_select on public.crm_contactos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and (select tiene_permiso('crm', 'ver')));
create policy crm_plantillas_select on public.crm_plantillas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual() and (select tiene_permiso('crm', 'ver')));
create policy crm_campanas_superadmin_select on public.crm_campanas for select using (es_superadmin());
create policy crm_contactos_superadmin_select on public.crm_contactos for select using (es_superadmin());
create policy crm_plantillas_superadmin_select on public.crm_plantillas for select using (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.crm_campanas as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.crm_contactos as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
create policy exige_aal2_si_mfa_activo on public.crm_plantillas as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
revoke all on public.crm_campanas, public.crm_contactos, public.crm_plantillas from public, anon, authenticated;
grant select on public.crm_campanas, public.crm_contactos, public.crm_plantillas to authenticated;

-- El historial de contactos no se borra (si se borra la óptica o el paciente, se va con ellos). Solo se anota el resultado, que cambian las funciones.
create function public._crm_contactos_protegidos()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.optica_id is distinct from old.optica_id or new.paciente_id is distinct from old.paciente_id or new.motivo is distinct from old.motivo
       or new.canal is distinct from old.canal or new.mensaje is distinct from old.mensaje or new.creado_en is distinct from old.creado_en
       or new.creado_por_nombre is distinct from old.creado_por_nombre then
      raise exception 'Un contacto solo admite que se anote su resultado.';
    end if;
    return new;
  end if;
  if exists (select 1 from public.opticas where id = old.optica_id) and exists (select 1 from public.pacientes_base where id = old.paciente_id) then
    raise exception 'El historial de contactos no se puede borrar.';
  end if;
  return old;
end;
$function$;
create trigger crm_contactos_protegidos
  before update or delete on public.crm_contactos
  for each row execute function public._crm_contactos_protegidos();

-- ════════════════════════════════════════════════════════════════
-- 3. Funciones
-- ════════════════════════════════════════════════════════════════
-- La comprobación común: la óptica de quien llama, con su permiso del CRM.
create function public.optica_de_crm(p_nivel text default 'ver')
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
  if not tiene_permiso('crm', p_nivel) then
    raise exception 'No tienes permiso para esta acción del CRM.';
  end if;
  return v_optica;
end;
$function$;
revoke all on function public.optica_de_crm(text) from public, anon, authenticated;

create function public._nombre_de_quien_llama()
returns text
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce((select p.nombre from perfiles p where p.id = auth.uid()), 'Sistema');
$function$;
revoke all on function public._nombre_de_quien_llama() from public, anon, authenticated;

-- El permiso que un paciente da o quita, con su constancia en la actividad. origen: 'personal', 'crm' o 'paciente'.
create function public._poner_consentimiento(p_paciente_id uuid, p_recordatorios boolean, p_promociones boolean, p_origen text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_p pacientes_base%rowtype;
  v_texto text;
begin
  select * into v_p from pacientes_base where id = p_paciente_id and anonimizado_en is null for update;
  if not found then
    raise exception 'El paciente no existe.';
  end if;
  if (p_recordatorios is null or p_recordatorios = v_p.acepta_recordatorios) and (p_promociones is null or p_promociones = v_p.acepta_promociones) then
    return;
  end if;
  perform set_config('app.origen_consentimiento', p_origen, true);
  update pacientes_base
     set acepta_recordatorios = coalesce(p_recordatorios, acepta_recordatorios),
         acepta_promociones = coalesce(p_promociones, acepta_promociones)
   where id = p_paciente_id;
  perform set_config('app.origen_consentimiento', '', true);
  v_texto := concat_ws(' · ',
    case when p_recordatorios is not null and p_recordatorios <> v_p.acepta_recordatorios then 'Recordatorios de salud: ' || case when p_recordatorios then 'sí' else 'no' end end,
    case when p_promociones is not null and p_promociones <> v_p.acepta_promociones then 'Promociones: ' || case when p_promociones then 'sí' else 'no' end end);
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_p.optica_id, case when p_origen = 'paciente' then null else auth.uid() end,
          case when p_origen = 'paciente' then v_p.nombre else _nombre_de_quien_llama() end,
          'pacientes',
          case when p_origen = 'paciente' then 'El paciente cambió sus permisos de mensajes' else 'Cambió los permisos de mensajes de un paciente' end,
          v_p.nombre || ' · ' || v_texto);
end;
$function$;
revoke all on function public._poner_consentimiento(uuid, boolean, boolean, text) from public, anon, authenticated;

-- Personal: cambiar los permisos de un paciente (desde su perfil o desde el CRM). Pide CRM "crear" o Pacientes "editar".
create function public.cambiar_consentimiento_paciente(p_paciente_id uuid, p_recordatorios boolean default null, p_promociones boolean default null, p_origen text default 'personal')
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_p pacientes_base%rowtype;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null or not optica_activa_actual() then
    raise exception 'No tienes acceso a esta óptica.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not (tiene_permiso('crm', 'crear') or tiene_permiso('pacientes', 'editar')) then
    raise exception 'No tienes permiso para cambiar los permisos de mensajes.';
  end if;
  if p_origen not in ('personal', 'crm') then
    raise exception 'Origen no válido.';
  end if;
  if not exists (select 1 from pacientes_base where id = p_paciente_id and optica_id = v_optica and anonimizado_en is null) then
    raise exception 'El paciente no existe.';
  end if;
  perform _poner_consentimiento(p_paciente_id, p_recordatorios, p_promociones, p_origen);
  select * into v_p from pacientes_base where id = p_paciente_id;
  return jsonb_build_object('acepta_recordatorios', v_p.acepta_recordatorios, 'acepta_promociones', v_p.acepta_promociones,
                            'actualizado_en', v_p.consentimiento_actualizado_en, 'actualizado_por', v_p.consentimiento_actualizado_por);
end;
$function$;
revoke all on function public.cambiar_consentimiento_paciente(uuid, boolean, boolean, text) from public, anon;
grant execute on function public.cambiar_consentimiento_paciente(uuid, boolean, boolean, text) to authenticated;

-- Portal: lo que el paciente tiene dado hoy, y su cambio. Mismo patrón de sesión que las demás funciones del portal.
create function public.mis_permisos_mensajes(p_paciente_id uuid, p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_p pacientes_base%rowtype;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  select * into v_p from pacientes_base where id = p_paciente_id and anonimizado_en is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  return jsonb_build_object('ok', true, 'recordatorios', v_p.acepta_recordatorios, 'promociones', v_p.acepta_promociones, 'actualizado_en', v_p.consentimiento_actualizado_en);
end;
$function$;
revoke all on function public.mis_permisos_mensajes(uuid, text) from public;
grant execute on function public.mis_permisos_mensajes(uuid, text) to anon, authenticated;

create function public.actualizar_consentimiento_paciente(p_paciente_id uuid, p_token text, p_recordatorios boolean default null, p_promociones boolean default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_p pacientes_base%rowtype;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  if p_recordatorios is null and p_promociones is null then
    return jsonb_build_object('ok', false, 'error', 'Indica qué permiso quieres cambiar.');
  end if;
  perform _poner_consentimiento(p_paciente_id, p_recordatorios, p_promociones, 'paciente');
  select * into v_p from pacientes_base where id = p_paciente_id;
  return jsonb_build_object('ok', true, 'recordatorios', v_p.acepta_recordatorios, 'promociones', v_p.acepta_promociones, 'actualizado_en', v_p.consentimiento_actualizado_en);
end;
$function$;
revoke all on function public.actualizar_consentimiento_paciente(uuid, text, boolean, boolean) from public;
grant execute on function public.actualizar_consentimiento_paciente(uuid, text, boolean, boolean) to anon, authenticated;

-- Anota un contacto. Con campaña, el motivo sale del grupo de la campaña. Con resultado, lo anota de una vez (una llamada o una visita).
create function public.registrar_contacto_crm(
  p_paciente_id uuid, p_motivo text, p_canal text default 'whatsapp', p_mensaje text default null,
  p_campana_id uuid default null, p_resultado text default null, p_volver_el date default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('crear');
  v_p pacientes_base%rowtype;
  v_motivo text := p_motivo;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_id uuid;
  v_nombre text := _nombre_de_quien_llama();
begin
  select * into v_p from pacientes_base where id = p_paciente_id and optica_id = v_optica and anonimizado_en is null;
  if not found then
    raise exception 'El paciente no existe.';
  end if;
  if p_campana_id is not null then
    select case c.grupo when 'control_vencido' then 'control_vencido' when 'sin_visitar' then 'sin_visitar' when 'cumpleanos_mes' then 'cumpleanos' else 'promocion' end into v_motivo
      from crm_campanas c where c.id = p_campana_id and c.optica_id = v_optica;
    if v_motivo is null then
      raise exception 'La campaña no existe.';
    end if;
  end if;
  if v_motivo is null or v_motivo not in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion') then
    raise exception 'Motivo no válido.';
  end if;
  if p_canal not in ('whatsapp', 'llamada', 'presencial', 'correo') then
    raise exception 'Canal no válido.';
  end if;
  if p_resultado is not null and p_resultado not in ('agendo', 'no_respondio', 'volver_a_contactar', 'no_le_interesa', 'no_desea_mensajes') then
    raise exception 'Resultado no válido.';
  end if;
  if p_resultado = 'volver_a_contactar' and (p_volver_el is null or p_volver_el <= v_hoy or p_volver_el > v_hoy + 365) then
    raise exception 'Elige una fecha futura (dentro de un año) para volver a contactar.';
  end if;
  if p_resultado is distinct from 'volver_a_contactar' and p_volver_el is not null then
    raise exception 'La fecha de volver a contactar solo va con ese resultado.';
  end if;
  -- El servidor no deja escribirle a quien no dio ese permiso (salvo para anotar que ya no quiere mensajes).
  if p_resultado is distinct from 'no_desea_mensajes' then
    if v_motivo = 'promocion' and not v_p.acepta_promociones then
      raise exception 'Este paciente no aceptó recibir promociones.';
    elsif v_motivo <> 'promocion' and not v_p.acepta_recordatorios then
      raise exception 'Este paciente no desea recibir mensajes.';
    end if;
  end if;

  insert into crm_contactos (optica_id, paciente_id, motivo, canal, mensaje, campana_id, resultado, volver_el, resultado_en, resultado_por_nombre, creado_por, creado_por_nombre)
  values (v_optica, p_paciente_id, v_motivo, p_canal, nullif(btrim(p_mensaje), ''), p_campana_id, p_resultado, p_volver_el,
          case when p_resultado is not null then now() end, case when p_resultado is not null then v_nombre end, auth.uid(), v_nombre)
  returning id into v_id;

  if p_resultado = 'no_desea_mensajes' then
    perform _poner_consentimiento(p_paciente_id, false, false, 'crm');
  end if;
  return v_id;
end;
$function$;
revoke all on function public.registrar_contacto_crm(uuid, text, text, text, uuid, text, date) from public, anon;
grant execute on function public.registrar_contacto_crm(uuid, text, text, text, uuid, text, date) to authenticated;

-- Anota (o corrige) qué pasó en un contacto.
create function public.registrar_resultado_contacto_crm(p_contacto_id uuid, p_resultado text, p_volver_el date default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('crear');
  v_c crm_contactos%rowtype;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
begin
  select * into v_c from crm_contactos where id = p_contacto_id and optica_id = v_optica for update;
  if not found then
    raise exception 'El contacto no existe.';
  end if;
  if p_resultado is null or p_resultado not in ('agendo', 'no_respondio', 'volver_a_contactar', 'no_le_interesa', 'no_desea_mensajes') then
    raise exception 'Resultado no válido.';
  end if;
  if p_resultado = 'volver_a_contactar' and (p_volver_el is null or p_volver_el <= v_hoy or p_volver_el > v_hoy + 365) then
    raise exception 'Elige una fecha futura (dentro de un año) para volver a contactar.';
  end if;
  if p_resultado <> 'volver_a_contactar' and p_volver_el is not null then
    raise exception 'La fecha de volver a contactar solo va con ese resultado.';
  end if;
  update crm_contactos
     set resultado = p_resultado, volver_el = case when p_resultado = 'volver_a_contactar' then p_volver_el end,
         resultado_en = now(), resultado_por_nombre = _nombre_de_quien_llama()
   where id = p_contacto_id;
  if p_resultado = 'no_desea_mensajes' then
    perform _poner_consentimiento(v_c.paciente_id, false, false, 'crm');
  end if;
end;
$function$;
revoke all on function public.registrar_resultado_contacto_crm(uuid, text, date) from public, anon;
grant execute on function public.registrar_resultado_contacto_crm(uuid, text, date) to authenticated;

create function public.crear_campana_crm(p_nombre text, p_grupo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('crear');
  v_id uuid;
begin
  if p_grupo is null or p_grupo not in ('control_vencido', 'sin_visitar', 'cumpleanos_mes', 'promociones') then
    raise exception 'Grupo no válido.';
  end if;
  if char_length(btrim(coalesce(p_nombre, ''))) < 3 then
    raise exception 'Escribe un nombre para la campaña (mínimo 3 letras).';
  end if;
  if char_length(btrim(coalesce(p_mensaje, ''))) < 10 then
    raise exception 'Escribe el mensaje (mínimo 10 letras).';
  end if;
  if char_length(btrim(p_mensaje)) > 500 then
    raise exception 'El mensaje es demasiado largo (máximo 500 caracteres).';
  end if;
  insert into crm_campanas (optica_id, nombre, grupo, mensaje, creada_por, creada_por_nombre)
  values (v_optica, btrim(p_nombre), p_grupo, btrim(p_mensaje), auth.uid(), _nombre_de_quien_llama())
  returning id into v_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), _nombre_de_quien_llama(), 'crm', 'Creó una campaña', btrim(p_nombre));
  return v_id;
end;
$function$;
revoke all on function public.crear_campana_crm(text, text, text) from public, anon;
grant execute on function public.crear_campana_crm(text, text, text) to authenticated;

-- Guarda el mensaje de un motivo; con el texto vacío vuelve al mensaje base.
create function public.guardar_plantilla_crm(p_motivo text, p_texto text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_crm('editar');
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if p_motivo is null or p_motivo not in ('control_vencido', 'control_proximo', 'cumpleanos', 'sin_visitar', 'postventa', 'promocion') then
    raise exception 'Motivo no válido.';
  end if;
  if v_texto = '' then
    delete from crm_plantillas where optica_id = v_optica and motivo = p_motivo;
    return;
  end if;
  if char_length(v_texto) < 10 then
    raise exception 'El mensaje es muy corto (mínimo 10 letras).';
  end if;
  if char_length(v_texto) > 500 then
    raise exception 'El mensaje es demasiado largo (máximo 500 caracteres).';
  end if;
  insert into crm_plantillas (optica_id, motivo, texto, actualizada_por_nombre)
  values (v_optica, p_motivo, v_texto, _nombre_de_quien_llama())
  on conflict (optica_id, motivo) do update set texto = excluded.texto, actualizada_por_nombre = excluded.actualizada_por_nombre, actualizada_en = now();
end;
$function$;
revoke all on function public.guardar_plantilla_crm(text, text) from public, anon;
grant execute on function public.guardar_plantilla_crm(text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 4. Los envíos automáticos respetan "Recordatorios de salud"
-- ════════════════════════════════════════════════════════════════
-- El saludo de cumpleaños y el recordatorio de la cita de mañana (los dos por correo, todos los días) ya no salen para quien dijo que no
-- quiere mensajes. Son las mismas funciones de hoy (misma firma), tomadas en vivo de la base, con una sola condición más.
create or replace function public.enviar_saludos_cumpleanos()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_api_key text;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_anio int := extract(year from v_hoy)::int;
  v_paciente record;
  v_html text;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_api_key is null then
    return;
  end if;

  for v_paciente in
    select p.id, p.optica_id, p.nombre, p.correo, o.nombre as optica_nombre
    from pacientes p
    join opticas o on o.id = p.optica_id
    where p.fecha_nacimiento is not null
      and extract(month from p.fecha_nacimiento) = extract(month from v_hoy)
      and extract(day from p.fecha_nacimiento) = extract(day from v_hoy)
      and coalesce((o.settings->>'cumpleAuto')::boolean, false) = true
      and coalesce(p.ultimo_saludo_cumple_anio, 0) < v_anio
      and p.acepta_recordatorios
      and p.correo is not null and p.correo <> '' and p.correo <> 'Sin Correo'
      and p.correo ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  loop
    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">¡Feliz cumpleaños, ' || v_paciente.nombre || '!</h2>'
      || '<p>Todo el equipo de <strong>' || v_paciente.optica_nombre || '</strong> te desea un año lleno de buena salud visual y buenos momentos. 🎉</p>'
      || '<p>Como agradecimiento por tu confianza, ¡pásate a vernos pronto, tenemos algo especial para ti!</p>'
      || '</div>';

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_paciente.correo),
        'subject', '¡Feliz cumpleaños de parte de ' || v_paciente.optica_nombre || '!',
        'html', v_html
      )
    ) into v_request_id;

    insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
    values (v_paciente.optica_id, 'cumpleanos', v_paciente.correo, v_paciente.id, v_request_id);

    update pacientes set ultimo_saludo_cumple_anio = v_anio where id = v_paciente.id;
  end loop;
end;
$function$;

create or replace function public.enviar_recordatorios_citas()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_api_key text;
  v_base_url text;
  v_cita record;
  v_correo text;
  v_link text;
  v_html text;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  select decrypted_secret into v_base_url from vault.decrypted_secrets where name = 'app_base_url' limit 1;
  if v_api_key is null or v_base_url is null then
    return;
  end if;

  for v_cita in
    select
      c.id, c.optica_id, c.paciente, c.fecha, c.hora, c.motivo_publico, c.motivo,
      coalesce(nullif(c.correo, ''), nullif(p.correo, ''), nullif(p.correo, 'Sin Correo')) as correo_resuelto,
      o.nombre as optica_nombre
    from citas c
    join opticas o on o.id = c.optica_id
    left join pacientes p on p.id = c.paciente_id
    where c.estado = 'Pendiente'
      and c.recordatorio_enviado_at is null
      and c.fecha = ((now() at time zone 'America/Guayaquil')::date + 1)
      and coalesce((o.settings->>'recordatoriosCitaActivo')::boolean, true)
      and coalesce(p.acepta_recordatorios, true)
  loop
    v_correo := v_cita.correo_resuelto;

    if v_correo is null or v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      update citas set recordatorio_enviado_at = now() where id = v_cita.id;
      continue;
    end if;

    v_link := v_base_url || '/?confirmar_cita=' || v_cita.id;
    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">Recordatorio de tu cita</h2>'
      || '<p>Hola ' || v_cita.paciente || ', te recordamos tu cita en <strong>' || v_cita.optica_nombre || '</strong>:</p>'
      || '<p style="font-size:18px"><strong>' || to_char(v_cita.fecha, 'DD/MM/YYYY') || ' a las ' || v_cita.hora || '</strong></p>'
      || case when coalesce(v_cita.motivo_publico, v_cita.motivo) is not null
           then '<p>Motivo: ' || coalesce(v_cita.motivo_publico, v_cita.motivo) || '</p>'
           else '' end
      || '<p><a href="' || v_link || '" style="display:inline-block;padding:10px 20px;background:#2563EB;color:#fff;text-decoration:none;border-radius:8px">Confirmar mi asistencia</a></p>'
      || '<p style="color:#64748b;font-size:12px">Si no puedes asistir, comunícate con la óptica para reagendar.</p>'
      || '</div>';

    select net.http_post(
      url := 'https://api.resend.com/emails',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_api_key, 'Content-Type', 'application/json'),
      body := jsonb_build_object(
        'from', 'Recordatorios <onboarding@resend.dev>',
        'to', jsonb_build_array(v_correo),
        'subject', 'Recordatorio: tu cita mañana en ' || v_cita.optica_nombre,
        'html', v_html
      )
    ) into v_request_id;

    insert into notificaciones_enviadas (optica_id, tipo, destinatario, referencia_id, request_id)
    values (v_cita.optica_id, 'recordatorio_cita', v_correo, v_cita.id, v_request_id);

    update citas set recordatorio_enviado_at = now() where id = v_cita.id;
  end loop;
end;
$function$;
