-- Portabilidad y derecho al olvido para el paciente — el anteproyecto (marco
-- de seguridad, sección 6) pide "políticas de retención" y "manejo de
-- solicitudes de eliminación/portabilidad". Dos piezas:
--
-- 1) Exportar: de solo lectura, sin riesgo — se resuelve con un RPC que
--    arma un JSON con los propios datos del paciente (perfil, citas,
--    consultas ya descifradas por la vista `consultas`).
--
-- 2) Eliminar: NO se hace borrado automático e instantáneo desde el propio
--    paciente — un historial clínico puede tener obligaciones legales de
--    retención que el paciente no puede saltarse por su cuenta, y Pacientes.jsx
--    ya tiene un flujo de borrado real que usa el admin. En vez de duplicar
--    esa lógica o exponer un borrado público directo, el paciente deja una
--    SOLICITUD que el admin de la óptica ve y resuelve él mismo (con el
--    botón de eliminar paciente que ya existe).

create table solicitudes_eliminacion_paciente (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  motivo text,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'atendida')),
  created_at timestamptz not null default now(),
  atendida_at timestamptz
);
create index solicitudes_eliminacion_paciente_optica_id_idx on solicitudes_eliminacion_paciente(optica_id);

alter table solicitudes_eliminacion_paciente enable row level security;

create policy solicitudes_eliminacion_admin_select on solicitudes_eliminacion_paciente
  for select
  using (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy solicitudes_eliminacion_admin_update on solicitudes_eliminacion_paciente
  for update
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy solicitudes_eliminacion_superadmin_all on solicitudes_eliminacion_paciente
  for all using (es_superadmin()) with check (es_superadmin());

-- ── solicitar_eliminacion_paciente: el paciente la llama desde su portal.
--    Mismo patrón de token que cancelar_cita_publica/reagendar_cita_publica. ──
create or replace function public.solicitar_eliminacion_paciente(
  p_paciente_id uuid,
  p_token text,
  p_motivo text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica_id uuid;
begin
  select optica_id into v_optica_id from pacientes
  where id = p_paciente_id and sesion_token is not null and sesion_token = p_token;

  if v_optica_id is null then
    return false;
  end if;

  -- Idempotente: si ya hay una pendiente, no duplica.
  if exists (select 1 from solicitudes_eliminacion_paciente where paciente_id = p_paciente_id and estado = 'pendiente') then
    return true;
  end if;

  insert into solicitudes_eliminacion_paciente (optica_id, paciente_id, motivo)
  values (v_optica_id, p_paciente_id, left(nullif(trim(p_motivo), ''), 500));
  return true;
end;
$$;

revoke all on function public.solicitar_eliminacion_paciente(uuid, text, text) from public;
grant execute on function public.solicitar_eliminacion_paciente(uuid, text, text) to anon;

-- ── marcar_solicitud_eliminacion_atendida: el admin la marca resuelta
--    después de haber borrado (o no) al paciente por su cuenta. ──
create or replace function public.marcar_solicitud_eliminacion_atendida(
  p_solicitud_id uuid
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update solicitudes_eliminacion_paciente
  set estado = 'atendida', atendida_at = now()
  where id = p_solicitud_id
    and optica_id = (select optica_id from perfiles where id = auth.uid());
  return found;
end;
$$;

revoke all on function public.marcar_solicitud_eliminacion_atendida(uuid) from public;
grant execute on function public.marcar_solicitud_eliminacion_atendida(uuid) to authenticated;

-- ── exportar_mis_datos_paciente: portabilidad — un solo RPC de solo
--    lectura que arma el bulto completo (perfil + citas + consultas ya
--    descifradas, porque lee de la vista `consultas`, no de la base). ──
create or replace function public.exportar_mis_datos_paciente(
  p_paciente_id uuid,
  p_token text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not exists (
    select 1 from pacientes
    where id = p_paciente_id and sesion_token is not null and sesion_token = p_token
  ) then
    return null;
  end if;

  select jsonb_build_object(
    'perfil', (select to_jsonb(p) - 'clave_temporal' - 'sesion_token' from pacientes p where p.id = p_paciente_id),
    'citas', (select coalesce(jsonb_agg(c), '[]'::jsonb) from citas c where c.paciente_id = p_paciente_id),
    'consultas', (select coalesce(jsonb_agg(co), '[]'::jsonb) from consultas co where co.paciente_id = p_paciente_id),
    'exportado_en', now()
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.exportar_mis_datos_paciente(uuid, text) from public;
grant execute on function public.exportar_mis_datos_paciente(uuid, text) to anon;
