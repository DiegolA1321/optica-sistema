-- La reserva web (y el reagendado del portal) ya no confían solo en la pantalla: crear_cita_publica y reagendar_cita_publica
-- rechazan una fecha u hora que la óptica no atiende. Hasta ahora el horario (y los días cerrados) solo se respetaban en la
-- página pública; una llamada directa a la función podía reservar cualquier día y hora. Reglas, en este orden, con el horario de
-- `disponibilidad` de esa óptica (la excepción de una fecha manda sobre el horario semanal):
--   1. El día debe tener la mañana o la tarde activa.
--   2. Un día abierto de forma excepcional (la fecha tiene una excepción abierta y su día de la semana está cerrado en el horario
--      habitual, p. ej. un domingo abierto a mano) es SOLO para el personal: no admite reservas en línea. Los días del horario
--      habitual —incluido el domingo, si la óptica lo atiende— siguen admitiéndolas, también con una excepción que solo cambia sus horas.
--   3. La hora de inicio debe caer dentro de una sesión activa: desde su inicio, antes de su fin.
-- Sin fila en `disponibilidad` (óptica que aún no configuró su horario) no se valida nada, como hasta ahora.
--
-- El resto de crear_cita_publica y de reagendar_cita_publica es idéntico a la definición que hay hoy en la base
-- (pg_get_functiondef, tras la 0102): misma firma, sin overload. La validación vive en una función aparte, que no se puede llamar
-- desde fuera.

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
end;
$$;

revoke all on function public.validar_horario_reserva_web(uuid, date, text) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.crear_cita_publica(p_optica_id uuid, p_paciente text, p_fecha date, p_hora text, p_cedula text, p_fecha_nacimiento date, p_telefono text DEFAULT NULL::text, p_motivo text DEFAULT NULL::text, p_motivo_publico text DEFAULT NULL::text, p_correo text DEFAULT NULL::text, p_triage jsonb DEFAULT NULL::jsonb)
 RETURNS TABLE(id uuid, codigo text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- Dedupe: si ya existe un paciente con esta cédula en esta óptica, se
  -- reusa su registro (y su nombre YA registrado, no el que se acaba de
  -- teclear — evita que la misma persona quede con nombres distintos según
  -- quién agendó la cita).
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

-- ════════════════════════════════════════════════════════════════
-- reagendar_cita_publica (portal del paciente): misma validación
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.reagendar_cita_publica(p_cita_id uuid, p_paciente_id uuid, p_fecha date, p_hora text, p_token text DEFAULT NULL::text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_optica uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  -- Horario de atención (0103): la nueva fecha y hora deben cumplir las mismas reglas que una reserva nueva.
  select optica_id into v_optica from citas_base where id = p_cita_id and paciente_id = p_paciente_id;
  if v_optica is not null then
    perform public.validar_horario_reserva_web(v_optica, p_fecha, trim(p_hora));
  end if;

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
    where id = p_cita_id and paciente_id = p_paciente_id;
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  return found;
end;
$function$;
