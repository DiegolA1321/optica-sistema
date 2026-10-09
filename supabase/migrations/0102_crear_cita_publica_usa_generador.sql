-- El código de toda cita sale de un solo lugar: generar_codigo_cita (0101). crear_cita_publica ya no arma el suyo con los 6
-- primeros caracteres del id (que podía repetirse) sino que usa el mismo generador sin repetidos que las citas del personal.
-- Lo demás de la función es idéntico a la definición que hay hoy en la base (pg_get_functiondef). Misma firma: no hay overload.
--
-- Además, un ajuste de 0101: el generador y el trigger deben ver TODOS los códigos, no solo los de la óptica de quien inserta
-- (el índice único es global y la RLS limitaría la comprobación a una sola óptica), así que pasan a SECURITY DEFINER con
-- search_path fijo, y el generador ya no se puede llamar directamente desde fuera.

alter function public.generar_codigo_cita(uuid, date) security definer set search_path = public;
alter function public.poner_codigo_cita() security definer set search_path = public;
revoke all on function public.generar_codigo_cita(uuid, date) from public, anon, authenticated;
revoke all on function public.poner_codigo_cita() from public, anon, authenticated;

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
