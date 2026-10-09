-- Reasignar una cita (reunión del 7 oct., R18): además de "quién la tiene" (asignado_a) y "quién la atendió" (atendido_por),
-- se guarda quién la tenía ANTES de la primera reasignación (asignado_original). Con eso el detalle puede decir
-- "Reasignada de Paula" o "Atendida por Rosa (en lugar de Paula)". Si se devuelve a la persona original, el original queda
-- igual que el asignado y la cita deja de verse como reasignada (así funciona "Deshacer": otra llamada a la misma función).
--
-- `citas` es una vista con triggers "instead of" sobre `citas_base` (0055/0083): la columna nueva se propaga a la tabla,
-- a la vista (al final, para que `create or replace view` conserve permisos y triggers) y a los dos triggers de escritura.
-- La vista y las funciones parten de las definiciones que hay HOY en la base (pg_get_viewdef / pg_get_functiondef).
--
-- Quién lo registra: un TRIGGER de citas_base (registrar_asignado_original), no la función. Así queda igual si el profesional
-- se cambia con la función reasignar_cita, con el "Editar cita" de la versión publicada o a mano:
--   · de una persona a OTRA persona, con el original vacío  → el original pasa a ser la persona anterior;
--   · de vuelta a la persona original (p. ej. "Deshacer")    → el original vuelve a quedar vacío (la cita no cambió de manos);
--   · desde "sin asignar" (Tomar) o hacia "sin asignar"      → no se registra nada.
--
-- Compatibilidad con la versión publicada del front: no conoce la columna nueva. Sus inserts y updates nombran columnas
-- explícitas, así que `asignado_original` llega como null en un insert y, en un update, con el valor que ya tenía
-- (la vista lo devuelve al leer y el trigger de arriba lo ajusta si cambió el profesional). Un `select *` sobre la vista solo
-- trae una columna más.
--
-- La función reasignar_cita es la única vía para cambiar de profesional una cita ya creada: valida el permiso y el alcance
-- por PERMISO (no por el nombre del rol): editar citas con alcance "todo".

alter table public.citas_base
  add column if not exists asignado_original uuid references public.perfiles(id) on delete set null;

create or replace view public.citas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.cedula, cb.telefono, cb.fecha, cb.hora,
  cb.motivo, cb.motivo_publico, cb.estado, cb.created_at, cb.updated_at, cb.correo,
  cb.recordatorio_enviado_at, cb.confirmada_at,
  descifrar_clinico(cb.triage_enc)::jsonb as triage,
  cb.encuesta_enviada_at,
  cb.codigo, cb.origen, cb.duracion_minutos, cb.cancelada_por,
  cb.asignado_a, cb.atendido_por,
  cb.asignado_original
from citas_base cb;

alter view public.citas set (security_invoker = true);

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
    triage_enc, encuesta_enviada_at, codigo, origen, duracion_minutos, cancelada_por,
    asignado_a, atendido_por, asignado_original
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo, coalesce(new.origen, 'staff'), new.duracion_minutos, new.cancelada_por,
    new.asignado_a, new.atendido_por, new.asignado_original
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
    cancelada_por = coalesce(new.cancelada_por, old.cancelada_por),
    asignado_a = new.asignado_a,
    atendido_por = new.atendido_por,
    asignado_original = new.asignado_original
  where id = old.id;
  return new;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- Registro de asignado_original (trigger sobre la tabla, corre con cualquier vía de escritura)
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_asignado_original()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.asignado_a is not distinct from old.asignado_a then
    return new;
  end if;
  if new.asignado_a is not null and new.asignado_a is not distinct from old.asignado_original then
    -- volvió a la persona original: ya no figura como reasignada
    new.asignado_original := null;
  elsif old.asignado_a is not null and new.asignado_a is not null and new.asignado_original is null then
    new.asignado_original := old.asignado_a;
  end if;
  return new;
end;
$$;

drop trigger if exists registrar_asignado_original_trigger on public.citas_base;
create trigger registrar_asignado_original_trigger
  before update on public.citas_base
  for each row execute function public.registrar_asignado_original();

-- ════════════════════════════════════════════════════════════════
-- Reasignar una cita
-- ════════════════════════════════════════════════════════════════
create or replace function public.reasignar_cita(p_cita_id uuid, p_nuevo uuid)
returns table (nuevo_asignado uuid, nuevo_original uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_cita citas_base%rowtype;
  v_nombre text;
  v_destino text;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para reasignar citas.';
  end if;
  select optica_id, nombre into v_optica, v_nombre from perfiles where id = auth.uid();
  if v_optica is null or not optica_activa_actual() then
    raise exception 'Tu óptica no está activa.';
  end if;
  if not tiene_permiso('citas', 'editar') or alcance_efectivo('citas') <> 'todo' then
    raise exception 'No tienes permiso para reasignar citas.';
  end if;

  select * into v_cita from citas_base where id = p_cita_id and optica_id = v_optica for update;
  if not found then
    raise exception 'No se encontró la cita.';
  end if;
  if v_cita.estado not in ('Pendiente', 'En Espera') then
    raise exception 'Solo se puede reasignar una cita pendiente o en espera.';
  end if;

  if p_nuevo is not null then
    select nombre into v_destino from perfiles
     where id = p_nuevo and optica_id = v_optica and coalesce(activo, true);
    if not found then
      raise exception 'La persona elegida no está activa en esta óptica.';
    end if;
  end if;

  if p_nuevo is distinct from v_cita.asignado_a then
    -- asignado_original lo ajusta el trigger registrar_asignado_original
    update citas_base
       set asignado_a = p_nuevo
     where id = p_cita_id
    returning asignado_a, asignado_original into nuevo_asignado, nuevo_original;

    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_optica, auth.uid(), coalesce(v_nombre, 'Usuario'), 'citas', 'Reasignó una cita',
            v_cita.paciente || ' · ' || v_cita.fecha::text || ' ' || v_cita.hora || ' → ' || coalesce(v_destino, 'sin asignar'));
  else
    nuevo_asignado := v_cita.asignado_a;
    nuevo_original := v_cita.asignado_original;
  end if;
  return next;
end;
$$;

revoke all on function public.reasignar_cita(uuid, uuid) from public, anon;
grant execute on function public.reasignar_cita(uuid, uuid) to authenticated;
