-- Hallazgo E5 de la auditoría 2026-09-09: el "código de cita" que
-- AgendarCitaPublica.jsx le pide guardar al paciente ("guarda tu código de
-- seguimiento") se generaba 100% en el navegador con Math.random() y nunca
-- se enviaba al servidor — era decorativo, no había forma de usarlo para
-- nada. Se corrige generándolo y guardándolo en el servidor, y dándole un
-- uso real: el personal ahora puede encontrar la cita de un paciente que
-- llama y da su código, buscándolo en Citas.jsx igual que buscan por
-- nombre.
--
-- Nota sobre I11 (bug ya documentado en este proyecto): esta función SÍ
-- cambia de tipo de retorno (de uuid a una tabla), así que un simple
-- "create or replace" lo hubiera rechazado con error (Postgres no permite
-- cambiar el tipo de retorno vía replace) -- se hace explícito con drop
-- primero de todas formas, siguiendo la misma disciplina.

alter table citas_base add column if not exists codigo text;
create unique index if not exists citas_codigo_idx on citas_base (codigo) where codigo is not null;

-- La vista `citas` (migración 0055) tiene una lista fija de columnas —
-- agregar `codigo` a citas_base no la hace visible ahí solo por eso.
-- Postgres permite agregar columnas al FINAL de una vista vía
-- "create or replace view" sin tener que tocar los triggers de
-- insert/delete (que no listan columnas explícitas), pero el trigger de
-- UPDATE sí las lista una por una, así que se actualiza también para que
-- `codigo` pueda seguir modificándose a través de la vista si hiciera falta.
create or replace view citas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.cedula, cb.telefono, cb.fecha, cb.hora,
  cb.motivo, cb.motivo_publico, cb.estado, cb.created_at, cb.updated_at, cb.correo,
  cb.recordatorio_enviado_at, cb.confirmada_at,
  descifrar_clinico(cb.triage_enc)::jsonb as triage,
  cb.encuesta_enviada_at,
  cb.codigo
from citas_base cb;

-- El trigger de insert también necesita conocer `codigo` (para que no se
-- pierda silenciosamente al pasar por la vista) y aceptar un `id` explícito
-- cuando el llamador ya lo trae (como crear_cita_publica, que necesita
-- saber el id ANTES del insert para derivar el código de él) — coalesce
-- con gen_random_uuid() mantiene igual el comportamiento para el resto de
-- los llamadores, que nunca especifican id y siguen recibiendo uno nuevo.
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
    triage_enc, encuesta_enviada_at, codigo
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo
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
    codigo = new.codigo
  where id = old.id;
  return new;
end;
$$;

drop function if exists public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb);

create function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
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
begin
  -- "opticas.id" calificado a propósito: como esta función ahora hace
  -- RETURNS TABLE (id uuid, codigo text), el nombre "id" también existe
  -- como variable de salida en todo el cuerpo de la función, y una
  -- referencia sin calificar acá sería ambigua (falla real, detectada al
  -- probar esta migración antes de darla por buena).
  if not exists (select 1 from opticas where opticas.id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  v_id := gen_random_uuid();
  -- Legible para decirlo por teléfono, único de verdad (deriva del id real
  -- que ya se está generando, sin necesidad de una secuencia aparte ni de
  -- reintentar por choques como pasaría con un sufijo aleatorio corto).
  v_codigo := 'CIT-' || extract(year from p_fecha) || '-' || upper(substring(replace(v_id::text, '-', '') from 1 for 6));

  insert into citas (id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, triage, codigo, estado)
  values (
    v_id, p_optica_id, p_paciente_id,
    left(v_paciente, 200),
    left(nullif(trim(p_cedula), ''), 30),
    left(nullif(trim(p_telefono), ''), 30),
    p_fecha,
    left(v_hora, 20),
    left(nullif(trim(p_motivo), ''), 300),
    left(nullif(trim(p_motivo_publico), ''), 300),
    left(v_correo, 200),
    p_triage,
    v_codigo,
    'Pendiente'
  );
  return query select v_id, v_codigo;
end;
$$;

revoke all on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb) to anon, authenticated;
