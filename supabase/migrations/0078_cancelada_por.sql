-- Reunión 29 sept., punto 2 del plan (docs/feedback-ing/plan-reunion-29sep.md):
-- el ingeniero pidió no eliminar citas sino reagendarlas. El estado
-- 'Cancelada' ya existe (CHECK de 0059) y ya se usa de punta a punta cuando
-- el paciente cancela desde el portal (cancelar_cita_publica, migración
-- 0036) — lo único que hacía un DELETE real era el lado de recepción
-- (Citas.jsx, "Eliminar cita"), que pasa a hacer un cambio de estado igual
-- que el paciente.
--
-- citas_base.cancelada_por distingue quién canceló, para no seguir
-- mostrando "Cancelada por el paciente" en una cita que canceló recepción.
--
-- Backfill: toda cita ya en estado Cancelada queda con cancelada_por =
-- 'paciente', porque hasta hoy solo el paciente podía cancelar (confirmado:
-- Citas.jsx nunca hizo un UPDATE a 'Cancelada', solo DELETE).
--
-- citas_base se edita a través de la vista `citas` con triggers "instead
-- of" (mismo patrón que pacientes_base, 0067/0077). La vista y los 3
-- triggers de abajo se extrajeron con pg_get_viewdef/pg_get_functiondef
-- directo de la base principal antes de escribir esta migración, para no
-- reconstruirlos de memoria.

alter table public.citas_base
  add column if not exists cancelada_por text
  check (cancelada_por in ('paciente', 'recepcion'));

update public.citas_base
   set cancelada_por = 'paciente'
 where estado = 'Cancelada'
   and cancelada_por is null;

create or replace view public.citas
with (security_invoker = true)
as
select
  id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo,
  motivo_publico, estado, created_at, updated_at, correo,
  recordatorio_enviado_at, confirmada_at,
  descifrar_clinico(triage_enc)::jsonb as triage,
  encuesta_enviada_at, codigo, origen, duracion_minutos, cancelada_por
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
    triage_enc, encuesta_enviada_at, codigo, origen, duracion_minutos, cancelada_por
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo, coalesce(new.origen, 'staff'), new.duracion_minutos, new.cancelada_por
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
    duracion_minutos = new.duracion_minutos,
    cancelada_por = coalesce(new.cancelada_por, old.cancelada_por)
  where id = old.id;
  return new;
end;
$$;

-- cancelar_cita_publica (0036) — misma firma (uuid, uuid, text), solo se
-- reemplaza el cuerpo para marcar cancelada_por = 'paciente'. Sin drop
-- previo: no cambia la firma, así que no hay riesgo de overload (I11).
create or replace function public.cancelar_cita_publica(
  p_cita_id uuid,
  p_paciente_id uuid,
  p_token text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from pacientes p
    where p.id = p_paciente_id and p.sesion_token is not null and p.sesion_token = p_token
  ) then
    return false;
  end if;

  update citas
  set estado = 'Cancelada', cancelada_por = 'paciente', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$$;
