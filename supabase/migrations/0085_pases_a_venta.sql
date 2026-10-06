-- Paso 8 del plan de prioridad 1 (reunión 29 sept., R33-R35): "Pasar a la
-- óptica". El optómetra cierra la atención con la receta y deja al paciente
-- "Listo para venta"; la vendedora ve esa cola, toma los datos del diagnóstico
-- y arma la venta (paso 9).
--
-- Por qué una tabla aparte y no una columna en `consultas`:
--   * `consultas` es una vista cifrada sin trigger de UPDATE a propósito: una
--     ficha clínica guardada no se edita desde el cliente. Agregar un UPDATE
--     para marcar "listo para venta" abriría la puerta a editar datos
--     clínicos; una tabla propia deja la ficha intacta.
--   * El pase tiene su propio ciclo (listo, vendido, descartado) y quién lo
--     pasó y cuándo, que además alimenta después el embudo de R40 (quién
--     consultó, quién pasó a ventas y quién compró).
--
-- Estados: 'listo' (esperando a la vendedora), 'vendido' (se facturó esa
-- consulta; lo marca solo un trigger) y 'descartado' (el paciente no compró;
-- lo marcará la vendedora en el paso 9, no se conserva en silencio).
--
-- Permisos: no existe un permiso "ventas". Se sigue el criterio de
-- facturas_venta (0072): inventario, pacientes o consultas. El Bloque D lo
-- refinará con los roles.
--
-- Nadie escribe en la tabla directamente: solo se lee. Las escrituras pasan
-- por la función pasar_a_optica() (y, más abajo, por el trigger de facturas).

create table public.pases_a_venta (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  consulta_id uuid not null unique references public.consultas_base(id) on delete cascade,
  paciente_id uuid references public.pacientes_base(id) on delete set null,
  cita_id uuid references public.citas_base(id) on delete set null,
  estado text not null default 'listo' check (estado in ('listo', 'vendido', 'descartado')),
  pasada_por uuid references public.perfiles(id) on delete set null,
  pasada_en timestamptz not null default now(),
  factura_id uuid references public.facturas_venta(id) on delete set null,
  cerrada_por uuid references public.perfiles(id) on delete set null,
  cerrada_en timestamptz
);

create index pases_a_venta_cola_idx on public.pases_a_venta (optica_id, estado, pasada_en desc);
create index pases_a_venta_paciente_idx on public.pases_a_venta (paciente_id) where paciente_id is not null;

alter table public.pases_a_venta enable row level security;

create policy pases_a_venta_staff_select on public.pases_a_venta for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  );

create policy pases_a_venta_superadmin_all on public.pases_a_venta for all
  using (es_superadmin()) with check (es_superadmin());

-- Mismo candado que las tablas clínicas (0057): con MFA activo, solo con aal2.
create policy exige_aal2_si_mfa_activo on public.pases_a_venta
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

-- ════════════════════════════════════════════════════════════════
-- pasar_a_optica(consulta): deja al paciente "Listo para venta".
-- Es idempotente: si la consulta ya tiene pase, devuelve el que existe sin
-- cambiarlo (no reabre uno vendido ni descartado).
-- ════════════════════════════════════════════════════════════════
create or replace function public.pasar_a_optica(p_consulta_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_consulta record;
  v_id uuid;
begin
  select p.optica_id into v_optica
  from perfiles p
  where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then
    raise exception 'No tienes acceso a esta óptica.';
  end if;
  if not optica_activa_actual() then
    raise exception 'La óptica está suspendida.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) then
    raise exception 'No tienes permiso para pasar un paciente a la óptica.';
  end if;

  select cb.optica_id, cb.paciente_id, cb.cita_id into v_consulta
  from consultas_base cb
  where cb.id = p_consulta_id;
  if not found or v_consulta.optica_id <> v_optica then
    raise exception 'La consulta no existe.';
  end if;

  insert into pases_a_venta (optica_id, consulta_id, paciente_id, cita_id, pasada_por)
  values (v_optica, p_consulta_id, v_consulta.paciente_id, v_consulta.cita_id, auth.uid())
  on conflict (consulta_id) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from pases_a_venta where consulta_id = p_consulta_id;
  end if;
  return v_id;
end;
$$;

revoke all on function public.pasar_a_optica(uuid) from public, anon;
grant execute on function public.pasar_a_optica(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Al facturar la consulta, el pase pasa solo a 'vendido'. Si esa factura se
-- anula: si la misma consulta tiene otra factura vigente (no anulada), el pase
-- sigue 'vendido' y apunta a esa; si era la única, el paciente vuelve a la
-- cola ('listo').
-- ════════════════════════════════════════════════════════════════
create or replace function public.sincronizar_pase_con_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otra uuid;
begin
  if tg_op = 'INSERT' then
    if new.consulta_id is not null and new.estado <> 'anulada' then
      update pases_a_venta
         set estado = 'vendido', factura_id = new.id, cerrada_en = now(), cerrada_por = new.registrado_por
       where consulta_id = new.consulta_id and estado = 'listo';
    end if;
  elsif tg_op = 'UPDATE' and new.estado = 'anulada' and old.estado <> 'anulada' then
    if new.consulta_id is not null then
      select f.id into v_otra
      from facturas_venta f
      where f.consulta_id = new.consulta_id and f.id <> new.id and f.estado <> 'anulada'
      order by f.created_at
      limit 1;
    end if;
    if v_otra is not null then
      update pases_a_venta set factura_id = v_otra
       where factura_id = new.id and estado = 'vendido';
    else
      update pases_a_venta
         set estado = 'listo', factura_id = null, cerrada_en = null, cerrada_por = null
       where factura_id = new.id and estado = 'vendido';
    end if;
  end if;
  return new;
end;
$$;

create trigger sincronizar_pase_con_factura_trigger
  after insert or update of estado on public.facturas_venta
  for each row execute function public.sincronizar_pase_con_factura();
