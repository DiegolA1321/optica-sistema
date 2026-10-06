-- Paso 3 del plan de prioridad 1 (reunión 29 sept., R12 y R18): quién es el
-- responsable de cada cita. Son dos datos distintos:
--   asignado_a   — quién debería atender la cita (opcional al agendar).
--   atendido_por — quién la atendió de verdad; se registra solo al abrir la
--                  ficha clínica de esa cita.
-- El administrador filtra por ambos para pedir cuentas sobre las no atendidas.
--
-- `citas` es una vista con triggers "instead of" sobre `citas_base` (0055), así
-- que una columna nueva hay que propagarla a la tabla, a la vista y a los dos
-- triggers de escritura. La vista y las funciones de abajo parten de las
-- definiciones que hay HOY en la base (extraídas con pg_get_viewdef y
-- pg_get_functiondef antes de escribir esto), que incluyen duracion_minutos y
-- cancelada_por. `create or replace view` conserva los permisos y los triggers
-- ya existentes porque las columnas nuevas van al final.
--
-- No se hace backfill: las 2 citas Atendida que existen hoy no se pueden
-- atribuir con certeza (su consulta guarda el nombre del profesional como
-- texto y no coincide con un único perfil). Quedan sin responsable y la
-- pantalla muestra "Sin asignar".
--
-- perfiles.id es el mismo uuid que auth.users.id. Si un usuario se elimina, sus
-- citas conservan todo y solo pierden la referencia (on delete set null).

alter table public.citas_base
  add column if not exists asignado_a uuid references public.perfiles(id) on delete set null,
  add column if not exists atendido_por uuid references public.perfiles(id) on delete set null;

create index if not exists citas_base_asignado_a_idx
  on public.citas_base (optica_id, asignado_a) where asignado_a is not null;
create index if not exists citas_base_atendido_por_idx
  on public.citas_base (optica_id, atendido_por) where atendido_por is not null;

-- ════════════════════════════════════════════════════════════════
-- Integridad: el responsable debe ser de la misma óptica, y "atendido por"
-- solo lo puede poner quien está atendiendo (no se atribuye a otra persona).
-- Corre antes de escribir en citas_base; no aplica a las llamadas sin sesión
-- (auth.uid() nulo: migraciones, cron, funciones del sistema).
-- ════════════════════════════════════════════════════════════════
create or replace function public.validar_responsables_cita()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.asignado_a is not null
     and (tg_op = 'INSERT' or new.asignado_a is distinct from old.asignado_a) then
    if not exists (select 1 from perfiles p where p.id = new.asignado_a and p.optica_id = new.optica_id) then
      raise exception 'La persona asignada no pertenece a esta óptica.';
    end if;
  end if;

  if new.atendido_por is not null
     and (tg_op = 'INSERT' or new.atendido_por is distinct from old.atendido_por) then
    if not exists (select 1 from perfiles p where p.id = new.atendido_por and p.optica_id = new.optica_id) then
      raise exception 'La persona que atendió no pertenece a esta óptica.';
    end if;
    if auth.uid() is not null and new.atendido_por <> auth.uid() and not es_superadmin() then
      raise exception 'Solo puedes registrarte a ti mismo como quien atiende.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists validar_responsables_cita_trigger on public.citas_base;
create trigger validar_responsables_cita_trigger
  before insert or update of asignado_a, atendido_por on public.citas_base
  for each row execute function public.validar_responsables_cita();

-- ════════════════════════════════════════════════════════════════
-- Vista y triggers "instead of" con las dos columnas nuevas (al final)
-- ════════════════════════════════════════════════════════════════
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
  cb.asignado_a, cb.atendido_por
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
    triage_enc, encuesta_enviada_at, codigo, origen, duracion_minutos, cancelada_por,
    asignado_a, atendido_por
  ) values (
    coalesce(new.id, gen_random_uuid()), new.optica_id, new.paciente_id, new.paciente, new.cedula, new.telefono, new.fecha, new.hora,
    new.motivo, new.motivo_publico, coalesce(new.estado, 'Pendiente'), new.correo, new.recordatorio_enviado_at, new.confirmada_at,
    cifrar_clinico(new.triage::text), new.encuesta_enviada_at, new.codigo, coalesce(new.origen, 'staff'), new.duracion_minutos, new.cancelada_por,
    new.asignado_a, new.atendido_por
  )
  returning id into v_id;

  select * into new from citas where id = v_id;
  return new;
end;
$$;

-- En el update, una columna que el cliente no menciona llega con su valor
-- anterior, así que `new.asignado_a` conserva lo guardado y, al mismo tiempo,
-- permite quitar la asignación enviando null de forma explícita.
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
    atendido_por = new.atendido_por
  where id = old.id;
  return new;
end;
$$;
