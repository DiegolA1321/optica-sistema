-- 0134 · Citas: seguimiento (línea de tiempo), motivo de cancelación, reglas de tiempo de los estados y descarte de avisos
-- Pedido de Diego tras la reunión del 20 oct. 2026 (Ronda 2: puntos 6, 7, 8, 9, 13, 14, 16 y 17). ESCRITA Y ENSAYADA, SIN APLICAR: espera la aprobación de Diego.
--
-- Qué hace (en este orden):
--   1. citas_eventos — la línea de tiempo de cada cita: agendada (y por dónde: web, portal o recepción), reagendada (desde qué fecha y hora), llegó, en atención,
--      atendida, cancelada (con motivo y quién), no efectuada (con motivo), volvió a pendiente, contactada, descartada, sin seguimiento y estado corregido.
--      Se escribe SOLA, con un trigger sobre citas_base: cualquier camino que cambie una cita (recepción, portal, proceso automático) deja su evento, con quién lo hizo.
--      Nadie escribe directo en la tabla (solo lee el personal que ve esa cita).
--   2. Cancelar con motivo: cancelar_cita (personal) y cancelar_cita_publica (portal; cambia de firma: se borra la anterior) piden el motivo y quedan en el seguimiento.
--   3. crear_cita_publica recibe el canal (web o portal) para que el seguimiento diga por dónde se agendó (cambia de firma: se borra la anterior).
--   4. Reglas de tiempo en el SERVIDOR (marcar_no_asistio_automatico, cada 5 minutos, con la hora de Ecuador):
--        · Pendiente que nadie abrió → «No efectuada» al terminar su horario (hora de inicio + duración), motivo «El paciente no asistió».
--        · En espera o En atención NUNCA pasan solas durante su horario. Una atención iniciada y no terminada pasa a «No efectuada» al cierre de la jornada de ese
--          día (según el horario de la óptica), motivo «La atención se inició y no se terminó» (el borrador de la ficha se conserva en el navegador).
--          Un paciente que llegó (En espera) y nunca se atendió pasa igual al cierre de la jornada, con «El paciente llegó y no fue atendido».
--        · A los 30 días de una cita no efectuada o cancelada por el paciente sin que nadie la retome: evento «Sin seguimiento».
--      Una guarda (trigger) impide, desde una sesión de personal, marcar «No efectuada» antes de que termine el horario y corregir una cita ya resuelta si no se es administrador.
--   5. corregir_estado_cita: la excepción «Corregir estado», solo para el administrador; queda en el seguimiento (de qué estado a cuál).
--   6. Se quita la confirmación del paciente: se borran confirmar_asistencia_cita y confirmar_asistencia_paciente, el correo de recordatorio ya no trae el enlace
--      «Confirmar mi asistencia» y mis_citas_detalle_paciente deja de entregar confirmada_at. La columna citas_base.confirmada_at se conserva (historial).
--   7. avisos_descartados + descartar_aviso / restaurar_aviso — «Descartar» con motivo en «Requiere tu atención», con vigencia opcional; registrar_contacto_cita («Escribir por WhatsApp»).
--
-- Qué NO cambia: ningún dato existente. No se rellenan eventos del pasado (la pantalla arma lo que sabe de las citas anteriores con sus propios datos).
-- El valor guardado del estado sigue siendo «No Asistió» (solo cambia el nombre que se ve: «No efectuada»).

-- ═══════════════════════════════════════════════════════
-- 0. Ayudas de hora (America/Guayaquil, hora de 12 h «hh:mm AM/PM»)
-- ═══════════════════════════════════════════════════════
create or replace function public._hora_a_minutos(p_hora text)
returns int
language sql
immutable
as $function$
  select case when p_hora ~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$'
    then ((substr(p_hora, 1, 2)::int % 12) + case when substr(p_hora, 7, 2) = 'PM' then 12 else 0 end) * 60 + substr(p_hora, 4, 2)::int
  end;
$function$;

-- Cuándo termina el horario de una cita: hora de inicio + su duración (la propia de la cita o la de la óptica; 40 min si no hay ninguna).
create or replace function public._fin_de_cita(p_optica uuid, p_fecha date, p_hora text, p_duracion int)
returns timestamp
language sql
stable
security definer
set search_path = public
as $function$
  select case when public._hora_a_minutos(p_hora) is null then null
    else p_fecha::timestamp + make_interval(mins => public._hora_a_minutos(p_hora) + coalesce(p_duracion, (select d.duracion_cita from disponibilidad d where d.optica_id = p_optica), 40))
  end;
$function$;

-- Cuándo cierra la jornada de ese día según el horario de la óptica (la excepción de la fecha manda sobre el horario de la semana). Sin horario, a las 23:59.
create or replace function public._cierre_de_jornada(p_optica uuid, p_fecha date)
returns timestamp
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_dia jsonb;
  v_cierre int;
  v_clave text;
  v_sesion jsonb;
  v_fin text;
begin
  select coalesce(d.excepciones -> p_fecha::text, d.horario_semanal -> (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from p_fecha)::int + 1])
    into v_dia from disponibilidad d where d.optica_id = p_optica;
  foreach v_clave in array array['manana', 'tarde'] loop
    v_sesion := v_dia -> v_clave;
    v_fin := v_sesion ->> 'fin';
    if coalesce((v_sesion ->> 'activo')::boolean, false) and v_fin ~ '^[0-9]{1,2}:[0-9]{2}$' then
      v_cierre := greatest(coalesce(v_cierre, 0), split_part(v_fin, ':', 1)::int * 60 + split_part(v_fin, ':', 2)::int);
    end if;
  end loop;
  return p_fecha::timestamp + make_interval(mins => coalesce(v_cierre, 24 * 60 - 1));
end;
$function$;

-- ═══════════════════════════════════════════════════════
-- 1. La línea de tiempo de cada cita
-- ═══════════════════════════════════════════════════════
create table public.citas_eventos (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  cita_id uuid not null references public.citas_base(id) on delete cascade,
  tipo text not null check (tipo in ('agendada', 'reagendada', 'llego', 'en_atencion', 'atendida', 'cancelada', 'no_efectuada', 'volvio_pendiente', 'contactada', 'descartada', 'sin_seguimiento', 'correccion')),
  ocurrido_en timestamptz not null default clock_timestamp(),
  actor_id uuid references public.perfiles(id) on delete set null,
  actor_nombre text not null default '',
  actor_tipo text not null check (actor_tipo in ('personal', 'paciente', 'sistema')),
  datos jsonb not null default '{}'::jsonb
);
create index citas_eventos_cita_idx on public.citas_eventos (cita_id, ocurrido_en);
create index citas_eventos_optica_tipo_idx on public.citas_eventos (optica_id, tipo, ocurrido_en desc);

alter table public.citas_eventos enable row level security;
-- Ve los eventos de las citas que puede ver (la política de citas_base ya aplica permiso y alcance).
create policy citas_eventos_staff_select on public.citas_eventos for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and exists (select 1 from public.citas_base c where c.id = citas_eventos.cita_id)
  );
create policy citas_eventos_soporte on public.citas_eventos for all
  using (acceso_soporte(optica_id)) with check (acceso_soporte(optica_id));
create policy exige_aal2_si_mfa_activo on public.citas_eventos
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());
revoke all on public.citas_eventos from anon, authenticated;
grant select on public.citas_eventos to authenticated;

-- Quién hizo algo: la sesión de personal, el paciente (sus funciones del portal lo avisan con optica.actor = 'paciente') o el sistema (proceso automático).
create or replace function public._registrar_evento_cita(p_cita uuid, p_optica uuid, p_tipo text, p_datos jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_nombre text;
  v_tipo text;
  v_id uuid;
begin
  if v_uid is not null then
    select p.nombre into v_nombre from perfiles p where p.id = v_uid;
    v_tipo := 'personal';
    v_id := v_uid;
  elsif current_setting('optica.actor', true) = 'paciente' then
    v_nombre := coalesce(nullif(current_setting('optica.actor_nombre', true), ''), 'El paciente');
    v_tipo := 'paciente';
  else
    v_nombre := 'Sistema';
    v_tipo := 'sistema';
  end if;
  insert into citas_eventos (optica_id, cita_id, tipo, actor_id, actor_nombre, actor_tipo, datos)
  values (p_optica, p_cita, p_tipo, v_id, coalesce(v_nombre, ''), v_tipo, coalesce(p_datos, '{}'::jsonb));
end;
$function$;
revoke all on function public._registrar_evento_cita(uuid, uuid, text, jsonb) from public, anon, authenticated;

-- Las funciones que cambian una cita pasan el motivo con set_config('optica.evento_datos', json, true) justo antes del UPDATE (vale solo en esa transacción).
create or replace function public.citas_registrar_eventos()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_extra jsonb := coalesce(nullif(current_setting('optica.evento_datos', true), '')::jsonb, '{}'::jsonb);
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    perform public._registrar_evento_cita(new.id, new.optica_id, 'agendada',
      jsonb_build_object('origen', coalesce(nullif(current_setting('optica.canal', true), ''), case when auth.uid() is not null then 'recepcion' else 'web' end)));
    return new;
  end if;

  if new.fecha is distinct from old.fecha or new.hora is distinct from old.hora then
    perform public._registrar_evento_cita(new.id, new.optica_id, 'reagendada',
      jsonb_build_object('fecha_anterior', old.fecha, 'hora_anterior', old.hora, 'fecha_nueva', new.fecha, 'hora_nueva', new.hora));
  end if;

  if new.estado is distinct from old.estado then
    v_tipo := case
      when v_extra ->> 'tipo' = 'correccion' then 'correccion'
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
revoke all on function public.citas_registrar_eventos() from public, anon, authenticated;

create trigger citas_registrar_eventos_ins after insert on public.citas_base
  for each row execute function public.citas_registrar_eventos();
create trigger citas_registrar_eventos_upd after update on public.citas_base
  for each row execute function public.citas_registrar_eventos();

-- ═══════════════════════════════════════════════════════
-- 2. Guarda del estado (solo sesiones de personal; el proceso automático, las funciones del portal y los scripts del servidor no la sufren)
-- ═══════════════════════════════════════════════════════
create or replace function public.citas_guardia_de_estado()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ahora timestamp := now() at time zone 'America/Guayaquil';
  v_fin timestamp;
begin
  if new.estado is not distinct from old.estado then return new; end if;
  if auth.uid() is null then return new; end if;
  if current_setting('optica.correccion', true) = '1' then return new; end if;

  -- «No efectuada» a mano: solo cuando ya terminó el horario de la cita.
  if new.estado = 'No Asistió' then
    v_fin := public._fin_de_cita(new.optica_id, new.fecha, new.hora, new.duracion_minutos);
    if v_fin is null or v_fin > v_ahora then
      raise exception 'Una cita solo pasa a «No efectuada» cuando termina su horario.';
    end if;
  end if;

  -- Una cita ya resuelta (atendida, no efectuada o cancelada) solo la corrige el administrador. Excepción: quien la estaba atendiendo puede guardar su ficha aunque el
  -- sistema ya la hubiera pasado a «No efectuada» al cierre de la jornada.
  if old.estado in ('Atendida', 'No Asistió', 'Cancelada') then
    if not (old.estado = 'No Asistió' and new.estado = 'Atendida' and old.atendido_por = auth.uid()) then
      raise exception 'Solo el administrador puede corregir el estado de una cita ya resuelta.';
    end if;
  end if;
  return new;
end;
$function$;
revoke all on function public.citas_guardia_de_estado() from public, anon, authenticated;
create trigger citas_guardia_de_estado before update on public.citas_base
  for each row execute function public.citas_guardia_de_estado();

-- ═══════════════════════════════════════════════════════
-- 3. Cancelar con motivo
-- ═══════════════════════════════════════════════════════
create or replace function public._motivo_de_cancelacion(p_codigo text)
returns text
language sql
immutable
as $function$
  select case p_codigo
    when 'paciente_no_puede' then 'El paciente no puede asistir'
    when 'paciente_llamada' then 'El paciente lo pidió por llamada o WhatsApp'
    when 'optica_no_puede' then 'La óptica no puede atender'
    when 'paciente_ya_no_necesita' then 'Ya no necesita la cita'
    when 'otro' then 'Otro'
  end;
$function$;

-- Personal: cancela una cita pendiente o en espera. Motivo de la lista fija + detalle opcional.
create or replace function public.cancelar_cita(p_cita_id uuid, p_motivo text, p_detalle text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre text;
  v_cita record;
  v_detalle text := nullif(btrim(p_detalle), '');
begin
  select p.optica_id, p.nombre into v_optica, v_nombre from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso('citas', 'editar') then raise exception 'No tienes permiso para editar citas.'; end if;
  if public._motivo_de_cancelacion(p_motivo) is null or p_motivo = 'paciente_ya_no_necesita' then raise exception 'Elige el motivo de la cancelación.'; end if;
  if v_detalle is not null and length(v_detalle) > 300 then raise exception 'El detalle es demasiado largo.'; end if;

  select c.id, c.paciente, c.estado into v_cita from citas_base c where c.id = p_cita_id and c.optica_id = v_optica for update;
  if not found then raise exception 'La cita no existe.'; end if;
  if v_cita.estado not in ('Pendiente', 'En Espera') then return false; end if;

  perform set_config('optica.evento_datos', jsonb_build_object('motivo', public._motivo_de_cancelacion(p_motivo), 'codigo', p_motivo, 'detalle', v_detalle, 'cancelada_por', 'recepcion')::text, true);
  update citas_base set estado = 'Cancelada', cancelada_por = 'recepcion', updated_at = now() where id = p_cita_id;
  perform set_config('optica.evento_datos', '', true);

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, 'citas', 'Canceló una cita', v_cita.paciente || ' · ' || public._motivo_de_cancelacion(p_motivo));
  return true;
end;
$function$;
revoke all on function public.cancelar_cita(uuid, text, text) from public, anon;
grant execute on function public.cancelar_cita(uuid, text, text) to authenticated;

-- Portal: el paciente cancela su cita y dice por qué. La firma cambia (motivo y detalle): se borra la anterior para no dejar dos versiones.
drop function public.cancelar_cita_publica(uuid, uuid, text);
create or replace function public.cancelar_cita_publica(p_cita_id uuid, p_paciente_id uuid, p_token text default null, p_motivo text default null, p_detalle text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_nombre text;
  v_detalle text := nullif(btrim(p_detalle), '');
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;
  if public._motivo_de_cancelacion(p_motivo) is null or p_motivo in ('paciente_llamada', 'optica_no_puede') then
    raise exception 'Indica el motivo de la cancelación.';
  end if;
  if v_detalle is not null and length(v_detalle) > 300 then raise exception 'El detalle es demasiado largo.'; end if;

  -- Política de la óptica y anticipación mínima (0106), con la hora de Ecuador.
  perform public.validar_cambio_cita_portal(p_cita_id, p_paciente_id);

  select pa.nombre into v_nombre from pacientes_base pa where pa.id = p_paciente_id;
  perform set_config('optica.actor', 'paciente', true);
  perform set_config('optica.actor_nombre', coalesce(v_nombre, ''), true);
  perform set_config('optica.evento_datos', jsonb_build_object('motivo', public._motivo_de_cancelacion(p_motivo), 'codigo', p_motivo, 'detalle', v_detalle, 'cancelada_por', 'paciente')::text, true);

  update citas
  set estado = 'Cancelada', cancelada_por = 'paciente', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$function$;
revoke all on function public.cancelar_cita_publica(uuid, uuid, text, text, text) from public;
grant execute on function public.cancelar_cita_publica(uuid, uuid, text, text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════
-- 4. Por dónde se agendó (web o portal) + quien reagenda desde el portal queda como el paciente
-- ═══════════════════════════════════════════════════════
drop function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb);
create or replace function public.crear_cita_publica(
  p_optica_id uuid, p_paciente text, p_fecha date, p_hora text, p_cedula text, p_fecha_nacimiento date,
  p_telefono text default null, p_motivo text default null, p_motivo_publico text default null, p_correo text default null, p_triage jsonb default null,
  p_canal text default 'web'
)
returns table(id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
  v_codigo text;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
  v_correo text := nullif(trim(p_correo), '');
  v_cedula text := trim(p_cedula);
  v_paciente_id uuid;
  v_nombre_final text;
begin
  if not exists (select 1 from opticas where opticas.id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;
  if not public.cedula_ecuatoriana_valida(v_cedula) then
    raise exception 'La cédula no es válida.';
  end if;
  if p_fecha_nacimiento is null or p_fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento es obligatoria y no puede ser futura.';
  end if;
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  -- Horario de atención (0103): el día debe ser de atención, admitir reservas web y la hora caer dentro de una sesión activa.
  perform public.validar_horario_reserva_web(p_optica_id, p_fecha, v_hora);

  -- Dedupe: si ya existe un paciente con esta cédula en esta óptica, se reusa su registro (y su nombre YA registrado).
  select p.id, p.nombre into v_paciente_id, v_nombre_final
  from pacientes p
  where p.optica_id = p_optica_id and p.cedula = v_cedula
  limit 1;

  if v_paciente_id is null then
    v_nombre_final := left(v_paciente, 200);
    insert into pacientes (
      optica_id, nombre, cedula, telefono, correo, fecha_nacimiento,
      evolucion, ultima_consulta, fecha_registro, estado_clinico, origen
    ) values (
      p_optica_id, v_nombre_final, v_cedula,
      left(nullif(trim(p_telefono), ''), 30), v_correo, p_fecha_nacimiento,
      'Sin evaluación', 'Pendiente', current_date, 'Activo', 'paciente'
    )
    returning pacientes.id into v_paciente_id;
  end if;

  v_id := gen_random_uuid();
  v_codigo := generar_codigo_cita(v_id, p_fecha);

  -- Para el seguimiento: quién agenda es el paciente y lo hace por la web pública o desde su portal.
  perform set_config('optica.actor', 'paciente', true);
  perform set_config('optica.actor_nombre', v_nombre_final, true);
  perform set_config('optica.canal', case when p_canal = 'portal' then 'portal' else 'web' end, true);

  begin
    insert into citas (id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, triage, codigo, estado, origen)
    values (
      v_id, p_optica_id, v_paciente_id,
      v_nombre_final,
      v_cedula,
      left(nullif(trim(p_telefono), ''), 30),
      p_fecha,
      left(v_hora, 20),
      left(nullif(trim(p_motivo), ''), 300),
      left(nullif(trim(p_motivo_publico), ''), 300),
      left(v_correo, 200),
      p_triage,
      v_codigo,
      'Pendiente',
      'paciente'
    );
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;

  return query select v_id, v_codigo;
end;
$function$;
revoke all on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb, text) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb, text) to anon, authenticated;

create or replace function public.reagendar_cita_publica(p_cita_id uuid, p_paciente_id uuid, p_fecha date, p_hora text, p_token text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre text;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  -- Política de la óptica y anticipación mínima (0106), con la hora de Ecuador.
  perform public.validar_cambio_cita_portal(p_cita_id, p_paciente_id);

  -- Horario de atención (0103): la nueva fecha y hora deben cumplir las mismas reglas que una reserva nueva.
  select optica_id into v_optica from citas_base where id = p_cita_id and paciente_id = p_paciente_id;
  if v_optica is not null then
    perform public.validar_horario_reserva_web(v_optica, p_fecha, trim(p_hora));
  end if;

  select pa.nombre into v_nombre from pacientes_base pa where pa.id = p_paciente_id;
  perform set_config('optica.actor', 'paciente', true);
  perform set_config('optica.actor_nombre', coalesce(v_nombre, ''), true);

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
    where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  return found;
end;
$function$;

-- ═══════════════════════════════════════════════════════
-- 5. Reglas de tiempo de los estados (cada 5 minutos, hora de Ecuador)
-- ═══════════════════════════════════════════════════════
-- La firma gana un parámetro (la hora «de ahora», solo para ensayar los límites): se borra la anterior; el cron sigue llamándola sin parámetros.
drop function public.marcar_no_asistio_automatico();
create or replace function public.marcar_no_asistio_automatico(p_ahora timestamp default null)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_ahora timestamp := coalesce(p_ahora, now() at time zone 'America/Guayaquil');
  v_cita record;
  v_motivo text;
begin
  -- A. Una cita Pendiente que nadie abrió pasa a «No efectuada» al terminar su horario (inicio + duración). Una abierta (En espera / En atención) no es Pendiente: no entra aquí.
  -- B. Una atención iniciada y no terminada (o un paciente que llegó y nunca se atendió) pasa a «No efectuada» al cierre de la jornada de ese día, nunca antes.
  for v_cita in
    select c.id, c.optica_id, c.paciente, c.fecha, c.hora, c.estado, c.duracion_minutos
    from citas_base c
    where c.estado in ('Pendiente', 'En Espera', 'En Atención') and c.fecha <= v_ahora::date
  loop
    begin
      if public._hora_a_minutos(v_cita.hora) is null then
        -- Hora mal escrita: se salta y se avisa una sola vez por cita.
        if not exists (
          select 1 from logs_optica l
          where l.optica_id = v_cita.optica_id and l.accion = 'Cita con hora no válida' and l.detalle like '%' || v_cita.id::text || '%'
        ) then
          insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
          values (v_cita.optica_id, null, 'Sistema', 'citas', 'Cita con hora no válida',
                  format('%s · %s · hora «%s» · id %s: corrígela para que se marque "No efectuada" sola', v_cita.paciente, v_cita.fecha, v_cita.hora, v_cita.id));
        end if;
        continue;
      end if;

      v_motivo := null;
      if v_cita.estado = 'Pendiente' then
        if public._fin_de_cita(v_cita.optica_id, v_cita.fecha, v_cita.hora, v_cita.duracion_minutos) <= v_ahora then
          v_motivo := 'El paciente no asistió';
        end if;
      elsif public._cierre_de_jornada(v_cita.optica_id, v_cita.fecha) <= v_ahora then
        v_motivo := case v_cita.estado when 'En Atención' then 'La atención se inició y no se terminó' else 'El paciente llegó y no fue atendido' end;
      end if;

      if v_motivo is not null then
        perform set_config('optica.evento_datos', jsonb_build_object('motivo', v_motivo, 'automatico', true)::text, true);
        update citas_base set estado = 'No Asistió' where id = v_cita.id and estado = v_cita.estado;
        perform set_config('optica.evento_datos', '', true);
      end if;
    exception when others then
      -- Cualquier otro problema con esta cita no frena a las demás.
      perform set_config('optica.evento_datos', '', true);
      raise warning 'marcar_no_asistio_automatico: la cita % se omitió (%)', v_cita.id, sqlerrm;
    end;
  end loop;

  -- C. A los 30 días de una cita no efectuada (o cancelada por el paciente) que nadie retomó, queda «Sin seguimiento» en su historial. Nada se reagenda solo.
  insert into citas_eventos (optica_id, cita_id, tipo, actor_tipo, actor_nombre, datos)
  select c.optica_id, c.id, 'sin_seguimiento', 'sistema', 'Sistema', jsonb_build_object('dias', 30)
  from citas_base c
  where (c.estado = 'No Asistió' or (c.estado = 'Cancelada' and c.cancelada_por = 'paciente'))
    and c.fecha < v_ahora::date - 30
    and not exists (select 1 from citas_eventos e where e.cita_id = c.id and e.tipo in ('sin_seguimiento', 'descartada'))
    and not exists (
      select 1 from citas_base o
      where o.optica_id = c.optica_id and o.id <> c.id and o.fecha >= c.fecha
        and o.estado in ('Pendiente', 'En Espera', 'En Atención', 'Atendida')
        and ((c.paciente_id is not null and o.paciente_id = c.paciente_id) or (c.paciente_id is null and o.paciente = c.paciente))
    );
end;
$function$;
revoke all on function public.marcar_no_asistio_automatico(timestamp) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════
-- 6. «Corregir estado (excepción)»: solo el administrador, y queda en el seguimiento
-- ═══════════════════════════════════════════════════════
create or replace function public.corregir_estado_cita(p_cita_id uuid, p_estado text, p_nota text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre text;
  v_cita record;
begin
  select p.optica_id, p.nombre into v_optica, v_nombre from perfiles p where p.id = auth.uid() and p.rol = 'admin';
  if v_optica is null then raise exception 'Solo el administrador puede corregir el estado de una cita.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if p_estado not in ('Pendiente', 'En Espera', 'En Atención', 'Atendida', 'No Asistió') then raise exception 'Estado no válido.'; end if;

  select c.id, c.paciente, c.estado, c.fecha into v_cita from citas_base c where c.id = p_cita_id and c.optica_id = v_optica for update;
  if not found then raise exception 'La cita no existe.'; end if;
  if v_cita.estado = p_estado then return false; end if;
  -- Una cita de un día que todavía no llega no puede estar en atención, atendida ni no efectuada.
  if v_cita.fecha > (now() at time zone 'America/Guayaquil')::date and p_estado <> 'Pendiente' then raise exception 'Una cita futura solo puede estar pendiente.'; end if;

  perform set_config('optica.correccion', '1', true);
  perform set_config('optica.evento_datos', jsonb_build_object('tipo', 'correccion', 'nota', nullif(btrim(p_nota), ''))::text, true);
  update citas_base set estado = p_estado, updated_at = now() where id = p_cita_id;
  perform set_config('optica.evento_datos', '', true);
  perform set_config('optica.correccion', '', true);

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, 'citas', 'Corrigió el estado de una cita', v_cita.paciente || ' · de ' || v_cita.estado || ' a ' || p_estado);
  return true;
end;
$function$;
revoke all on function public.corregir_estado_cita(uuid, text, text) from public, anon;
grant execute on function public.corregir_estado_cita(uuid, text, text) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 7. Contactar al paciente: «Escribir por WhatsApp» queda en el seguimiento
-- ═══════════════════════════════════════════════════════
create or replace function public.registrar_contacto_cita(p_cita_id uuid, p_medio text default 'whatsapp')
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_cita record;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso('citas', 'ver') then raise exception 'No tienes permiso para ver citas.'; end if;
  if p_medio not in ('whatsapp', 'llamada', 'otro') then raise exception 'Medio no válido.'; end if;
  select c.id, c.optica_id into v_cita from citas_base c where c.id = p_cita_id and c.optica_id = v_optica;
  if not found then raise exception 'La cita no existe.'; end if;
  perform public._registrar_evento_cita(p_cita_id, v_optica, 'contactada', jsonb_build_object('medio', p_medio));
  return true;
end;
$function$;
revoke all on function public.registrar_contacto_cita(uuid, text) from public, anon;
grant execute on function public.registrar_contacto_cita(uuid, text) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 8. «Descartar» un aviso de «Requiere tu atención», con motivo (y vigencia opcional)
-- ═══════════════════════════════════════════════════════
create table public.avisos_descartados (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  tipo text not null check (tipo ~ '^(citas|pacientes|ventas|inventario|crm):[a-z_]+$'),
  clave text not null check (length(clave) between 1 and 120),
  motivo text not null check (length(btrim(motivo)) between 1 and 200),
  detalle text check (detalle is null or length(detalle) <= 300),
  vigente_hasta date,                       -- null: para siempre; con fecha: el aviso vuelve si sigue sin resolverse
  descartado_por uuid references public.perfiles(id) on delete set null,
  descartado_nombre text not null default '',
  descartado_en timestamptz not null default clock_timestamp(),
  unique (optica_id, tipo, clave)
);
create index avisos_descartados_optica_idx on public.avisos_descartados (optica_id, tipo);

alter table public.avisos_descartados enable row level security;
create policy avisos_descartados_staff_select on public.avisos_descartados for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual());
create policy avisos_descartados_soporte on public.avisos_descartados for all
  using (acceso_soporte(optica_id)) with check (acceso_soporte(optica_id));
create policy exige_aal2_si_mfa_activo on public.avisos_descartados
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());
revoke all on public.avisos_descartados from anon, authenticated;
grant select on public.avisos_descartados to authenticated;

create or replace function public.descartar_aviso(p_tipo text, p_clave text, p_motivo text, p_detalle text default null, p_dias int default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre text;
  v_modulo text := split_part(p_tipo, ':', 1);
  v_motivo text := nullif(btrim(p_motivo), '');
  v_hasta date := case when p_dias is null then null else (now() at time zone 'America/Guayaquil')::date + p_dias end;
begin
  select p.optica_id, p.nombre into v_optica, v_nombre from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if p_tipo !~ '^(citas|pacientes|ventas|inventario|crm):[a-z_]+$' then raise exception 'Aviso no válido.'; end if;
  if v_motivo is null then raise exception 'Escribe el motivo del descarte.'; end if;
  -- Quien ve el módulo del aviso puede descartarlo.
  if not tiene_permiso(v_modulo, 'ver') then raise exception 'No tienes permiso para descartar este aviso.'; end if;

  insert into avisos_descartados (optica_id, tipo, clave, motivo, detalle, vigente_hasta, descartado_por, descartado_nombre)
  values (v_optica, p_tipo, p_clave, left(v_motivo, 200), nullif(left(btrim(coalesce(p_detalle, '')), 300), ''), v_hasta, auth.uid(), v_nombre)
  on conflict (optica_id, tipo, clave) do update
    set motivo = excluded.motivo, detalle = excluded.detalle, vigente_hasta = excluded.vigente_hasta,
        descartado_por = excluded.descartado_por, descartado_nombre = excluded.descartado_nombre, descartado_en = clock_timestamp();

  -- Si el aviso es de una cita, queda también en su seguimiento.
  if p_tipo = 'citas:contactar_paciente' and p_clave ~ '^[0-9a-f-]{36}$' then
    if exists (select 1 from citas_base c where c.id = p_clave::uuid and c.optica_id = v_optica) then
      perform public._registrar_evento_cita(p_clave::uuid, v_optica, 'descartada', jsonb_build_object('motivo', v_motivo, 'detalle', nullif(btrim(coalesce(p_detalle, '')), '')));
    end if;
  end if;

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, v_modulo, 'Descartó un aviso', p_tipo || ' · ' || v_motivo);
  return true;
end;
$function$;
revoke all on function public.descartar_aviso(text, text, text, text, int) from public, anon;
grant execute on function public.descartar_aviso(text, text, text, text, int) to authenticated;

create or replace function public.restaurar_aviso(p_tipo text, p_clave text)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre text;
begin
  select p.optica_id, p.nombre into v_optica, v_nombre from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso(split_part(p_tipo, ':', 1), 'ver') then raise exception 'No tienes permiso para este aviso.'; end if;
  delete from avisos_descartados where optica_id = v_optica and tipo = p_tipo and clave = p_clave;
  if not found then return false; end if;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre, split_part(p_tipo, ':', 1), 'Volvió a mostrar un aviso descartado', p_tipo);
  return true;
end;
$function$;
revoke all on function public.restaurar_aviso(text, text) from public, anon;
grant execute on function public.restaurar_aviso(text, text) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 9. Se quita la confirmación de la cita por el paciente
-- ═══════════════════════════════════════════════════════
drop function public.confirmar_asistencia_cita(uuid);
drop function public.confirmar_asistencia_paciente(uuid, text, uuid);

-- El correo de recordatorio ya no trae «Confirmar mi asistencia»: dice que, si no puede venir, cancele o reagende.
create or replace function public.enviar_recordatorios_citas()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_api_key text;
  v_cita record;
  v_correo text;
  v_html text;
  v_request_id bigint;
begin
  select decrypted_secret into v_api_key from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if v_api_key is null then
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

    v_html :=
      '<div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#0f172a">'
      || '<h2 style="color:#0E2B33">Recordatorio de tu cita</h2>'
      || '<p>Hola ' || v_cita.paciente || ', te recordamos tu cita en <strong>' || v_cita.optica_nombre || '</strong>:</p>'
      || '<p style="font-size:18px"><strong>' || to_char(v_cita.fecha, 'DD/MM/YYYY') || ' a las ' || v_cita.hora || '</strong></p>'
      || case when coalesce(v_cita.motivo_publico, v_cita.motivo) is not null
           then '<p>Motivo: ' || coalesce(v_cita.motivo_publico, v_cita.motivo) || '</p>'
           else '' end
      || '<p>Te esperamos. No necesitas confirmar tu asistencia.</p>'
      || '<p style="color:#64748b;font-size:12px">Si no puedes asistir, cancela o reagenda tu cita desde tu portal o comunícate con la óptica.</p>'
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
revoke all on function public.enviar_recordatorios_citas() from public, anon, authenticated;

-- El portal ya no recibe confirmada_at (ni la cancelación ni los eventos: eso es del personal).
create or replace function public.mis_citas_detalle_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cita_id', c.id,
    'profesional', (select pe.nombre from perfiles pe where pe.id = coalesce(c.atendido_por, c.asignado_a)),
    'consulta_id', (select co.id from consultas_base co where co.cita_id = c.id order by co.created_at desc limit 1),
    'calificacion', (select jsonb_build_object('puntaje', r.puntaje, 'comentario', r.comentario) from respuestas_satisfaccion r where r.cita_id = c.id),
    'en_calendario_at', (select cb.agregada_calendario_at from citas_base cb where cb.id = c.id)
  ) order by c.fecha desc, c.hora desc), '[]'::jsonb)
  from citas c
  where c.paciente_id = p_paciente_id and sesion_paciente_valida(p_paciente_id, p_token);
$function$;

-- ═══════════════════════════════════════════════════════
-- Reversión (no se ejecuta; solo para tenerla a mano). Se hace con el respaldo previo a la aplicación (pg_dump) y estos pasos:
--   drop trigger citas_registrar_eventos_ins / citas_registrar_eventos_upd / citas_guardia_de_estado on citas_base;
--   drop table citas_eventos, avisos_descartados;
--   volver a crear las funciones con su cuerpo anterior (0092 marcar_no_asistio_automatico, 0036 cancelar_cita_publica, 0031 confirmar_asistencia_*, etc.).
-- ═══════════════════════════════════════════════════════
