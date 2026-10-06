-- Paso 11 del plan de prioridad 1 (reunión 29 sept., R38): abonos libres.
-- Una venta (factura) se puede pagar de contado, con tarjeta, en cuotas o con
-- abonos de monto y fecha libres hasta completar el total. El saldo pendiente
-- es el total menos lo abonado.
--
-- Decisiones de diseño:
--   * Tabla `abonos_factura`: cada pago es una fila (monto, fecha, nota, quién
--     lo registró). El saldo se calcula (total - suma de abonos), no se guarda,
--     así nunca queda desincronizado.
--   * Las cuotas pasan a ser un caso de abonos: pagar una cuota registra un
--     abono por el valor de la cuota (la última cuota toma el saldo exacto, para
--     que el redondeo no deje centavos pendientes). Se mantiene `cuotas_pagadas`
--     para quien ya lo muestra. Las cuotas ya pagadas se migran como abonos.
--   * Método de pago nuevo 'abonos': la factura nace 'pendiente_pago' y se va
--     completando con abonos libres (no lleva número de cuotas).
--   * Directo y tarjeta nacen 'pagada' y no llevan abonos (saldo 0 por estado).
--   * Nadie escribe en `abonos_factura` directamente: solo se lee. Las
--     escrituras pasan por registrar_abono() y registrar_pago_cuota_venta().
--   * Las ventas sueltas antiguas (tabla `ventas`) conservan sus cuotas tal como
--     están: no se migran.
--
-- Permisos: igual que facturas y pases (inventario, pacientes o consultas),
-- con la verificación común optica_de_vendedor() (óptica activa, MFA).

-- ════════════════════════════════════════════════════════════════
-- Método de pago 'abonos' y estado pendiente también para abonos
-- ════════════════════════════════════════════════════════════════
alter table public.facturas_venta drop constraint facturas_venta_metodo_pago_check;
alter table public.facturas_venta add constraint facturas_venta_metodo_pago_check
  check (metodo_pago in ('directo', 'tarjeta', 'cuotas', 'abonos'));

alter table public.facturas_venta drop constraint facturas_venta_pendiente_pago_solo_si_cuotas;
alter table public.facturas_venta add constraint facturas_venta_pendiente_pago_solo_si_cuotas_o_abonos
  check (estado <> 'pendiente_pago' or metodo_pago in ('cuotas', 'abonos'));

-- ════════════════════════════════════════════════════════════════
-- Abonos
-- ════════════════════════════════════════════════════════════════
create table public.abonos_factura (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  monto numeric(10, 2) not null check (monto > 0),
  fecha date not null default current_date,
  nota text,
  registrado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index abonos_factura_factura_idx on public.abonos_factura (factura_id, fecha);
create index abonos_factura_optica_idx on public.abonos_factura (optica_id);

alter table public.abonos_factura enable row level security;

create policy abonos_factura_staff_select on public.abonos_factura for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  );
create policy abonos_factura_superadmin_all on public.abonos_factura for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.abonos_factura
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

-- Las cuotas que ya se habían pagado pasan a ser abonos (una fila por cuota,
-- con la fecha de la factura porque no se guardó cuándo se pagó cada una).
insert into public.abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por)
select f.optica_id, f.id,
       case when n = f.cuotas_totales then f.monto_total - round(f.monto_total / f.cuotas_totales, 2) * (f.cuotas_totales - 1)
            else round(f.monto_total / f.cuotas_totales, 2) end,
       f.created_at::date, 'Cuota ' || n || ' de ' || f.cuotas_totales || ' (migrada)', f.registrado_por
from public.facturas_venta f
cross join lateral generate_series(1, f.cuotas_pagadas) as n
where f.metodo_pago = 'cuotas' and f.cuotas_pagadas > 0 and f.monto_total > 0 and f.estado <> 'anulada';

-- ════════════════════════════════════════════════════════════════
-- registrar_abono(factura, monto, fecha, nota): registra un abono libre.
-- No se puede abonar más que el saldo, ni una factura pagada o anulada, ni con
-- fecha futura. Si el abono completa el total, la factura pasa a 'pagada'.
-- Devuelve el abono, el saldo que queda y el estado de la factura.
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_abono(
  p_factura_id uuid,
  p_monto numeric,
  p_fecha date default null,
  p_nota text default null
) returns table (abono_id uuid, saldo numeric, estado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_factura record;
  v_pagado numeric;
  v_saldo numeric;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_id uuid;
  v_estado text;
  -- Fechas en hora de Ecuador: el servidor trabaja en UTC y, de noche, "hoy" ya sería mañana.
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_fecha date;
begin
  if v_monto <= 0 then
    raise exception 'El abono debe ser mayor que cero.';
  end if;
  v_fecha := coalesce(p_fecha, v_hoy);
  if v_fecha > v_hoy then
    raise exception 'La fecha del abono no puede ser futura.';
  end if;

  select f.id, f.estado, f.metodo_pago, f.monto_total, f.cuotas_totales, f.created_at into v_factura
  from facturas_venta f
  where f.id = p_factura_id and f.optica_id = v_optica
  for update;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La venta está anulada.';
  end if;
  if v_factura.estado = 'pagada' then
    raise exception 'Esta venta ya está pagada.';
  end if;
  if v_fecha < (v_factura.created_at at time zone 'America/Guayaquil')::date then
    raise exception 'La fecha del abono no puede ser anterior a la de la venta.';
  end if;

  select coalesce(sum(a.monto), 0) into v_pagado from abonos_factura a where a.factura_id = p_factura_id;
  v_saldo := v_factura.monto_total - v_pagado;
  if v_monto > v_saldo then
    raise exception 'El abono ($%) supera el saldo pendiente ($%).', v_monto, v_saldo;
  end if;

  insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por)
  values (v_optica, p_factura_id, v_monto, v_fecha, nullif(btrim(p_nota), ''), auth.uid())
  returning id into v_id;

  v_saldo := v_saldo - v_monto;
  v_estado := case when v_saldo <= 0 then 'pagada' else 'pendiente_pago' end;
  update facturas_venta
     set estado = v_estado,
         cuotas_pagadas = case when v_estado = 'pagada' and metodo_pago = 'cuotas' then cuotas_totales else cuotas_pagadas end
   where id = p_factura_id;

  return query select v_id, v_saldo, v_estado;
end;
$$;

revoke all on function public.registrar_abono(uuid, numeric, date, text) from public, anon;
-- (La fecha por defecto es hoy en hora de Ecuador; la función la calcula, no el parámetro.)
grant execute on function public.registrar_abono(uuid, numeric, date, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Pagar una cuota = registrar un abono por el valor de la cuota (la última
-- toma el saldo exacto). Misma firma y mismo resultado que antes; ahora corre
-- con permisos de la función (la tabla de abonos no se escribe directo).
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_pago_cuota_venta(
  p_factura_id uuid
) returns table (cuotas_pagadas integer, estado text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_factura record;
  v_pagado numeric;
  v_saldo numeric;
  v_monto numeric;
  v_nuevas_cuotas integer;
  v_estado_nuevo text;
begin
  select * into v_factura from facturas_venta where facturas_venta.id = p_factura_id and facturas_venta.optica_id = v_optica for update;

  if not found then
    raise exception 'La factura no existe.';
  end if;
  if v_factura.metodo_pago != 'cuotas' then
    raise exception 'Esta factura no es de pago en cuotas.';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La factura está anulada.';
  end if;
  if v_factura.cuotas_pagadas >= v_factura.cuotas_totales or v_factura.estado = 'pagada' then
    raise exception 'Esta factura ya está totalmente pagada.';
  end if;

  select coalesce(sum(a.monto), 0) into v_pagado from abonos_factura a where a.factura_id = p_factura_id;
  v_saldo := v_factura.monto_total - v_pagado;
  v_nuevas_cuotas := v_factura.cuotas_pagadas + 1;
  v_monto := case when v_nuevas_cuotas >= v_factura.cuotas_totales then v_saldo
                  else least(v_saldo, round(v_factura.monto_total / v_factura.cuotas_totales, 2)) end;
  v_estado_nuevo := case when v_nuevas_cuotas >= v_factura.cuotas_totales or v_monto >= v_saldo then 'pagada' else 'pendiente_pago' end;

  if v_monto > 0 then
    insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por)
    values (v_optica, p_factura_id, v_monto, (now() at time zone 'America/Guayaquil')::date, 'Cuota ' || v_nuevas_cuotas || ' de ' || v_factura.cuotas_totales, auth.uid());
  end if;

  -- Si el pago completa la deuda antes de la última cuota (hubo abonos libres), todas cuentan como pagadas.
  if v_estado_nuevo = 'pagada' then v_nuevas_cuotas := v_factura.cuotas_totales; end if;
  update facturas_venta set cuotas_pagadas = v_nuevas_cuotas, estado = v_estado_nuevo where facturas_venta.id = p_factura_id;

  return query select v_nuevas_cuotas, v_estado_nuevo;
end;
$$;

revoke all on function public.registrar_pago_cuota_venta(uuid) from public, anon;
grant execute on function public.registrar_pago_cuota_venta(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- crear_factura_venta: la única diferencia con la 0072 es que 'abonos' también
-- nace 'pendiente_pago'. Misma firma (se reemplaza sin dejar una sobrecarga).
-- ════════════════════════════════════════════════════════════════
create or replace function public.crear_factura_venta(
  p_optica_id uuid,
  p_paciente_id uuid,
  p_metodo_pago text,
  p_lineas jsonb,
  p_cita_id uuid default null,
  p_consulta_id uuid default null,
  p_cuotas_totales integer default null,
  p_registrado_por uuid default null
) returns table (id uuid, monto_total numeric, estado text, created_at timestamptz)
language plpgsql
set search_path = public
as $$
declare
  v_linea jsonb;
  v_monto_total numeric := 0;
  v_estado text;
  v_factura_id uuid;
  v_created_at timestamptz;
  v_subtotal numeric;
  v_stock_restante integer;
begin
  if jsonb_array_length(p_lineas) = 0 then
    raise exception 'Una factura necesita al menos una línea.';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;
    v_monto_total := v_monto_total + v_subtotal;
  end loop;

  v_estado := case when p_metodo_pago in ('cuotas', 'abonos') and v_monto_total > 0 then 'pendiente_pago' else 'pagada' end;

  insert into facturas_venta (
    optica_id, paciente_id, cita_id, consulta_id, metodo_pago,
    cuotas_totales, monto_total, estado, registrado_por
  ) values (
    p_optica_id, p_paciente_id, p_cita_id, p_consulta_id, p_metodo_pago,
    p_cuotas_totales, v_monto_total, v_estado, p_registrado_por
  )
  returning facturas_venta.id, facturas_venta.created_at into v_factura_id, v_created_at;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;

    if (v_linea->>'tipo') = 'producto' and (v_linea->>'producto_id') is not null then
      update inventario
         set stock = inventario.stock - (v_linea->>'cantidad')::integer
       where inventario.id = (v_linea->>'producto_id')::uuid
         and inventario.optica_id = p_optica_id
         and inventario.stock >= (v_linea->>'cantidad')::integer
      returning inventario.stock into v_stock_restante;

      if not found then
        raise exception 'No hay suficiente stock para "%".', (v_linea->>'descripcion');
      end if;
    end if;

    insert into facturas_venta_lineas (
      factura_id, producto_id, tipo, descripcion, cantidad, precio_unitario, subtotal
    ) values (
      v_factura_id,
      (v_linea->>'producto_id')::uuid,
      v_linea->>'tipo',
      v_linea->>'descripcion',
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario')::numeric,
      v_subtotal
    );
  end loop;

  return query select v_factura_id, v_monto_total, v_estado, v_created_at;
end;
$$;

revoke all on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid) from public;
grant execute on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid) to authenticated;
