-- El ing probó agendar un walk-in fuera de la grilla de horarios fijos en
-- vivo (transcripción ING2-3): "¿qué pasa si te atiendo a las 3:40?" — el
-- sistema solo generaba slots de duración fija (40 min por defecto) y
-- detectaba choques comparando el string de hora exacto, así que no había
-- forma de registrar una hora real distinta ni de que una cita más larga que
-- su slot bloqueara el siguiente. `duracion_minutos` (nullable — null =
-- usa la duración estándar de la óptica) es lo único que faltaba en el
-- esquema; toda la lógica de solapamiento nueva vive en disponibilidad.js
-- (finCitaMinutos/haySolapamiento/conflictoHorarioPersonalizado), esto solo
-- persiste el dato.
--
-- Misma disciplina que 0067: `citas` es una vista cifrada (0055, extendida
-- por 0058/0065/0067) con triggers INSTEAD OF — se parte de su estado ACTUAL
-- (con codigo, referido_por_id, origen) para no perder nada de eso.

alter table citas_base add column if not exists duracion_minutos integer;

create or replace view citas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.cedula, cb.telefono, cb.fecha, cb.hora,
  cb.motivo, cb.motivo_publico, cb.estado, cb.created_at, cb.updated_at, cb.correo,
  cb.recordatorio_enviado_at, cb.confirmada_at,
  descifrar_clinico(cb.triage_enc)::jsonb as triage,
  cb.encuesta_enviada_at,
  cb.codigo, cb.origen, cb.duracion_minutos
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
    triage_enc, encuesta_enviada_at, codigo, origen, duracion_minutos
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo, coalesce(new.origen, 'staff'), new.duracion_minutos
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
    origen = coalesce(new.origen, old.origen),
    duracion_minutos = new.duracion_minutos
  where id = old.id;
  return new;
end;
$$;
