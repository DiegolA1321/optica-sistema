-- El ing probó el flujo de agendar-en-línea en vivo (transcripciones ING4-6,
-- ING9) y señaló un problema de fondo, no de interfaz: crear_cita_publica()
-- nunca vincula ni crea un registro en pacientes_base — la cita queda
-- "suelta" (paciente_id null) hasta que el personal la completa a mano desde
-- "Crear paciente" en Citas.jsx. Su razonamiento explícito: "todo paciente
-- que tiene su cita, es un paciente que ya existe en el registro" — el
-- sistema debe crear (o encontrar) ese registro en el momento de agendar, no
-- diferirlo a un paso manual del personal.
--
-- Sin cédula ni fecha de nacimiento no hay forma de deduplicar: "puede
-- pensarse que es otro, pero con la cédula... ya se verifica si tiene
-- previamente un registro". El ing revirtió ahí mismo su decisión anterior
-- de no pedir cédula (para no generar fricción) específicamente por este
-- riesgo de duplicados/spam — nombre + cédula + nacimiento pasan a ser
-- obligatorios; teléfono y correo siguen opcionales.
--
-- Esta migración:
--   a) Añade pacientes_base.origen y citas_base.origen ('paciente' | 'staff')
--      para poder distinguir y filtrar quién generó cada registro (ING5-6:
--      "una etiqueta... si fue creado manual o por sistema"), propagadas a
--      través de las vistas cifradas `pacientes`/`citas` (0055, extendidas
--      después por 0058 y 0065 — esta migración parte de esas versiones,
--      no de las originales de 0055, para no perder `codigo`/`referido_por_id`).
--   b) Valida la cédula ecuatoriana con el mismo algoritmo real que ya usa
--      el cliente (esCedulaValida en validaciones.js) pero del lado del
--      servidor — esta función es SECURITY DEFINER llamada por `anon`, así
--      que no puede confiar en la validación del navegador.
--   c) crear_cita_publica ahora exige cédula + fecha de nacimiento, busca un
--      paciente existente por (optica_id, cedula); si existe lo reusa (con
--      su nombre real ya registrado — no el que se acaba de teclear, para
--      evitar que un mismo paciente quede con nombres distintos según quién
--      agendó); si no existe, crea uno nuevo con origen='paciente'. La cita
--      siempre queda con paciente_id resuelto y origen='paciente'.
--
-- Las citas ya existentes con paciente_id null (agendadas antes de esta
-- migración) NO se tocan — Citas.jsx conserva su flujo de "Completar
-- registro" para esos casos legacy, simplemente deja de ser necesario para
-- cualquier cita nueva agendada desde hoy en adelante.

alter table pacientes_base add column if not exists origen text not null default 'staff' check (origen in ('paciente', 'staff'));
alter table citas_base add column if not exists origen text not null default 'staff' check (origen in ('paciente', 'staff'));

-- ════════════════════════════════════════════════════════════════
-- Propagar `origen` a través de las vistas cifradas (parte de 0065/0058)
-- ════════════════════════════════════════════════════════════════
create or replace view pacientes
with (security_invoker = true)
as
select
  pb.id, pb.optica_id, pb.nombre, pb.cedula, pb.telefono, pb.correo, pb.fecha_nacimiento,
  pb.ultima_consulta,
  descifrar_clinico(pb.estado_clinico_enc) as estado_clinico,
  pb.referido_por,
  descifrar_clinico(pb.evolucion_enc) as evolucion,
  descifrar_clinico(pb.estado_correccion_enc) as estado_correccion,
  pb.fecha_registro, pb.tiene_cuenta, pb.usuario, pb.clave_temporal,
  pb.created_at, pb.updated_at, pb.sesion_token, pb.ultimo_saludo_cumple_anio,
  pb.intentos_fallidos, pb.bloqueado_hasta, pb.referido_por_id, pb.origen
from pacientes_base pb;

create or replace function public.pacientes_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into pacientes_base (
    optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, ultima_consulta,
    estado_clinico_enc, referido_por, referido_por_id, evolucion_enc, estado_correccion_enc,
    fecha_registro, tiene_cuenta, usuario, clave_temporal,
    sesion_token, ultimo_saludo_cumple_anio, intentos_fallidos, bloqueado_hasta, origen
  ) values (
    new.optica_id, new.nombre, new.cedula, new.telefono, new.correo, new.fecha_nacimiento, new.ultima_consulta,
    cifrar_clinico(new.estado_clinico), new.referido_por, new.referido_por_id, cifrar_clinico(new.evolucion), cifrar_clinico(new.estado_correccion),
    coalesce(new.fecha_registro, current_date), coalesce(new.tiene_cuenta, false), new.usuario, new.clave_temporal,
    new.sesion_token, new.ultimo_saludo_cumple_anio, coalesce(new.intentos_fallidos, 0), new.bloqueado_hasta,
    coalesce(new.origen, 'staff')
  )
  returning id into v_id;

  select * into new from pacientes where id = v_id;
  return new;
end;
$$;

create or replace function public.pacientes_instead_update()
returns trigger
language plpgsql
set search_path = public
as $$
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
    origen = coalesce(new.origen, old.origen)
  where id = old.id;
  return new;
end;
$$;

create or replace view citas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.cedula, cb.telefono, cb.fecha, cb.hora,
  cb.motivo, cb.motivo_publico, cb.estado, cb.created_at, cb.updated_at, cb.correo,
  cb.recordatorio_enviado_at, cb.confirmada_at,
  descifrar_clinico(cb.triage_enc)::jsonb as triage,
  cb.encuesta_enviada_at,
  cb.codigo, cb.origen
from citas_base cb;

create or replace function public.citas_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into citas_base (
    id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora,
    motivo, motivo_publico, estado, correo, recordatorio_enviado_at, confirmada_at,
    triage_enc, encuesta_enviada_at, codigo, origen
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo, coalesce(new.origen, 'staff')
  )
  returning id into v_id;

  select * into new from citas where id = v_id;
  return new;
end;
$$;

create or replace function public.citas_instead_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update citas_base set
    optica_id = new.optica_id,
    paciente_id = new.paciente_id,
    paciente = new.paciente,
    cedula = new.cedula,
    telefono = new.telefono,
    fecha = new.fecha,
    hora = new.hora,
    motivo = new.motivo,
    motivo_publico = new.motivo_publico,
    estado = new.estado,
    updated_at = new.updated_at,
    correo = new.correo,
    recordatorio_enviado_at = new.recordatorio_enviado_at,
    confirmada_at = new.confirmada_at,
    triage_enc = cifrar_clinico(new.triage::text),
    encuesta_enviada_at = new.encuesta_enviada_at,
    codigo = new.codigo,
    origen = coalesce(new.origen, old.origen)
  where id = old.id;
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- Validación real de cédula ecuatoriana, del lado del servidor
-- (mismo algoritmo módulo 10 que esCedulaValida en validaciones.js)
-- ════════════════════════════════════════════════════════════════
create or replace function public.cedula_ecuatoriana_valida(p_cedula text)
returns boolean
language plpgsql
immutable
as $$
declare
  v_provincia int;
  v_tercer_digito int;
  v_coeficientes int[] := array[2,1,2,1,2,1,2,1,2];
  v_suma int := 0;
  v_valor_pos int;
  v_verificador int;
  i int;
begin
  if p_cedula is null or p_cedula !~ '^[0-9]{10}$' then
    return false;
  end if;

  v_provincia := substring(p_cedula from 1 for 2)::int;
  if v_provincia < 1 or v_provincia > 24 then
    return false;
  end if;

  v_tercer_digito := substring(p_cedula from 3 for 1)::int;
  if v_tercer_digito >= 6 then
    return false;
  end if;

  for i in 1..9 loop
    v_valor_pos := substring(p_cedula from i for 1)::int * v_coeficientes[i];
    if v_valor_pos >= 10 then
      v_valor_pos := v_valor_pos - 9;
    end if;
    v_suma := v_suma + v_valor_pos;
  end loop;

  v_verificador := (10 - (v_suma % 10)) % 10;
  return v_verificador = substring(p_cedula from 10 for 1)::int;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- crear_cita_publica: ahora resuelve/crea el paciente, no solo la cita
-- ════════════════════════════════════════════════════════════════
drop function if exists public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb);

create function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_cedula text,
  p_fecha_nacimiento date,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null,
  p_correo text default null,
  p_triage jsonb default null
) returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $$
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
  v_codigo := 'CIT-' || extract(year from p_fecha) || '-' || upper(substring(replace(v_id::text, '-', '') from 1 for 6));

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
$$;

revoke all on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb) to anon, authenticated;
