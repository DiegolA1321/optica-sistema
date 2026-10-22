-- 0136 — Ronda 3a (Pacientes y perfil): tipo de documento, citas «Presencial» y «Dejar de atender» de verdad.
--
--   1. pacientes_base.tipo_documento ('cedula' | 'pasaporte' | 'otro', por defecto 'cedula'): un paciente extranjero se registra con su pasaporte u otro documento y no pasa por el dígito
--      verificador de la cédula ecuatoriana (esa validación sigue en la pantalla y en crear_cita_publica, solo para cédulas). La columna `cedula` sigue guardando el número del documento
--      (es también el usuario del portal), así que nada de lo que ya lee `cedula` cambia. La vista `pacientes` y sus disparadores la llevan.
--   2. citas_base.origen admite 'presencial': la cita que se crea al pulsar «Atender ahora» (el paciente llegó sin cita). El seguimiento de la cita dice «Agendada · Presencial».
--   3. dejar_de_atender_cita(cita): lo que pasa al «Dejar de atender» una atención abierta, decidido en el servidor:
--        · el mismo día de la cita (o una cita de hoy o futura): vuelve a «En espera» (el paciente puede seguir ahí) y el borrador de la ficha se conserva;
--        · si el día ya pasó: queda «No efectuada» con el motivo «La atención se interrumpió» y pasa a «Contactar al paciente».
--      Ambos casos quedan en el seguimiento de la cita (nuevo evento 'volvio_en_espera'). Antes la pantalla hacía un UPDATE directo a «Pendiente» que, según el permiso de quien lo pulsaba,
--      la base podía rechazar sin avisar.
--
-- Revertir: dejar la columna sin uso (no se borra), volver la restricción de origen a ('paciente', 'staff') tras pasar las citas 'presencial' a 'staff', recrear los cuerpos anteriores de
--   pacientes_instead_insert/update (0114) y citas_registrar_eventos (0134) y `drop function public.dejar_de_atender_cita(uuid)`.

-- ═══════════════════════════════════════════════════════
-- 1. Tipo de documento
-- ═══════════════════════════════════════════════════════
alter table public.pacientes_base add column tipo_documento text not null default 'cedula' check (tipo_documento in ('cedula', 'pasaporte', 'otro'));

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
    consentimiento_actualizado_por,
    tipo_documento
   from public.pacientes_base pb
  where pb.anonimizado_en is null;

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
    confirmado_recepcion, medidas_solicitadas_en, acepta_recordatorios, acepta_promociones, tipo_documento
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta,
    coalesce(new.origen, 'staff'),
    coalesce(new.confirmado_recepcion, coalesce(new.origen, 'staff') = 'staff'),
    new.medidas_solicitadas_en,
    coalesce(new.acepta_recordatorios, true), coalesce(new.acepta_promociones, false), coalesce(new.tipo_documento, 'cedula')
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
    acepta_promociones = coalesce(new.acepta_promociones, old.acepta_promociones),
    tipo_documento = coalesce(new.tipo_documento, old.tipo_documento)
  where id = old.id;
  return new;
end;
$function$;

-- ═══════════════════════════════════════════════════════
-- 2. Citas «Presencial»
-- ═══════════════════════════════════════════════════════
alter table public.citas_base drop constraint citas_base_origen_check;
alter table public.citas_base add constraint citas_base_origen_check check (origen in ('paciente', 'staff', 'presencial'));

-- ═══════════════════════════════════════════════════════
-- 3. Dejar de atender
-- ═══════════════════════════════════════════════════════
alter table public.citas_eventos drop constraint citas_eventos_tipo_check;
alter table public.citas_eventos add constraint citas_eventos_tipo_check
  check (tipo in ('agendada', 'reagendada', 'llego', 'en_atencion', 'atendida', 'cancelada', 'no_efectuada', 'volvio_pendiente', 'volvio_en_espera', 'contactada', 'descartada', 'sin_seguimiento', 'correccion'));

-- Los mismos eventos de siempre; dos cambios: la cita «Presencial» se anota como tal, y volver a «En espera» al dejar de atender es su propio evento (no un «Llegó»).
create or replace function public.citas_registrar_eventos()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_extra jsonb := coalesce(nullif(current_setting('optica.evento_datos', true), '')::jsonb, '{}'::jsonb);
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    perform public._registrar_evento_cita(new.id, new.optica_id, 'agendada',
      jsonb_build_object('origen', case when new.origen = 'presencial' then 'presencial'
        else coalesce(nullif(current_setting('optica.canal', true), ''), case when auth.uid() is not null then 'recepcion' else 'web' end) end));
    return new;
  end if;

  if new.fecha is distinct from old.fecha or new.hora is distinct from old.hora then
    perform public._registrar_evento_cita(new.id, new.optica_id, 'reagendada',
      jsonb_build_object('fecha_anterior', old.fecha, 'hora_anterior', old.hora, 'fecha_nueva', new.fecha, 'hora_nueva', new.hora));
  end if;

  if new.estado is distinct from old.estado then
    v_tipo := case
      when v_extra ->> 'tipo' = 'correccion' then 'correccion'
      when v_extra ->> 'tipo' = 'volvio_en_espera' then 'volvio_en_espera'
      when new.estado = 'En Espera' then 'llego'
      when new.estado = 'En Atención' then 'en_atencion'
      when new.estado = 'Atendida' then 'atendida'
      when new.estado = 'Cancelada' then 'cancelada'
      when new.estado = 'No Asistió' then 'no_efectuada'
      else 'volvio_pendiente'
    end;
    perform public._registrar_evento_cita(new.id, new.optica_id, v_tipo, jsonb_build_object('de', old.estado, 'a', new.estado) || (v_extra - 'tipo'));
  end if;
  return new;
end;
$function$;

-- Devuelve el estado en que queda la cita: 'En Espera' o 'No Asistió' (que la pantalla llama «No efectuada»). Si la cita ya no estaba «En atención», no toca nada y devuelve su estado.
create or replace function public.dejar_de_atender_cita(p_cita_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_nombre text;
  v_cita record;
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_destino text;
begin
  select p.optica_id, p.nombre into v_optica, v_nombre from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not (tiene_permiso('citas', 'editar') or tiene_permiso('consultas', 'crear')) then raise exception 'No tienes permiso para dejar de atender esta cita.'; end if;

  select c.id, c.paciente, c.estado, c.fecha into v_cita from citas_base c where c.id = p_cita_id and c.optica_id = v_optica for update;
  if not found then raise exception 'La cita no existe.'; end if;
  if v_cita.estado <> 'En Atención' then return v_cita.estado; end if;

  if v_cita.fecha >= v_hoy then
    v_destino := 'En Espera';
    perform set_config('optica.evento_datos', jsonb_build_object('tipo', 'volvio_en_espera', 'motivo', 'Se dejó de atender; el paciente sigue en espera')::text, true);
    update citas_base set estado = 'En Espera', atendido_por = null, updated_at = now() where id = p_cita_id;
  else
    v_destino := 'No Asistió';
    perform set_config('optica.evento_datos', jsonb_build_object('motivo', 'La atención se interrumpió')::text, true);
    update citas_base set estado = 'No Asistió', updated_at = now() where id = p_cita_id;
  end if;
  perform set_config('optica.evento_datos', '', true);

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, 'citas', 'Dejó de atender una cita abierta', v_cita.paciente);
  return v_destino;
end;
$function$;
revoke all on function public.dejar_de_atender_cita(uuid) from public, anon;
grant execute on function public.dejar_de_atender_cita(uuid) to authenticated;
