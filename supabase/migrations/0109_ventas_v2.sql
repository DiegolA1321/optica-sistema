-- Ventas v2 (rama ventas-v2): pagos divididos, descuentos por línea, y corregir o anular un abono mal registrado.
-- BORRADOR: se muestra a Diego antes de aplicarse (protocolo de siempre: respaldo con pg_dump, ensayo en transacción con
-- scripts/ensayo-0109.mjs, verificación con una sesión real).
--
-- Qué hace
--   1. Pagos divididos. Un cobro (la venta pagada al contado o un abono) puede repartirse entre varios métodos
--      (efectivo, tarjeta, transferencia). Se guarda como una lista `pagos` = [{"metodo":"efectivo","monto":30}, ...]
--      en `facturas_venta` (lo pagado al contado en la venta) y en `abonos_factura` (cada abono). La suma de la lista
--      siempre es igual al monto cobrado: lo comprueba el servidor. Sin lista (todo lo anterior) el método queda "sin indicar".
--   2. Descuentos por línea (en monto o en porcentaje) con motivo obligatorio. Se guardan en la línea: el subtotal ya es lo
--      que se cobra y el comprobante muestra el descuento. Solo con el nivel "editar" de Ventas (validado aquí).
--   3. Corregir o anular un abono: nuevas funciones corregir_abono y anular_abono (nivel "editar" de Ventas, motivo
--      obligatorio). Recalculan el saldo y el estado de la venta, y dejan una fila en `abonos_correcciones` con lo anterior,
--      lo nuevo, el motivo, quién y cuándo. Un abono anulado se quita de `abonos_factura` (así la pantalla publicada, que
--      calcula el saldo con esa tabla, sigue dando el saldo correcto) y queda en `abonos_correcciones`.
--   4. Las funciones registrar_abono, registrar_pago_cuota_venta y crear_factura_venta ganan un parámetro AL FINAL con valor
--      por defecto (p_pagos). Se hace `drop function` de la firma anterior antes de crear la nueva (sin sobrecarga silenciosa).
--
-- COMPATIBLE CON LA VERSIÓN PUBLICADA (main): las tres funciones se siguen llamando con los mismos nombres de parámetros
-- y el mismo resultado; los parámetros y columnas nuevos son opcionales. Las columnas nuevas de las tablas tienen valor por
-- defecto o aceptan nulo, y la pantalla publicada no las lee. Ninguna fila existente cambia.
--
-- Lo que NO toca: ningún dato clínico, ninguna venta ni abono existente, ninguna política de las tablas ya existentes.

-- ════════════════════════════════════════════════════════════════
-- 1. Pagos por método
-- ════════════════════════════════════════════════════════════════
alter table public.abonos_factura add column pagos jsonb;
alter table public.abonos_factura
  add constraint abonos_factura_pagos_lista check (pagos is null or (jsonb_typeof(pagos) = 'array' and jsonb_array_length(pagos) between 1 and 4));

alter table public.facturas_venta add column pagos jsonb;
alter table public.facturas_venta
  add constraint facturas_venta_pagos_lista check (pagos is null or (jsonb_typeof(pagos) = 'array' and jsonb_array_length(pagos) between 1 and 4));

-- Valida y normaliza una lista de pagos: de 1 a 4 filas, método permitido, monto mayor que cero, y que la suma sea el total.
-- Devuelve la lista con los montos a dos decimales.
create function public.normalizar_pagos(p_pagos jsonb, p_total numeric)
returns jsonb
language plpgsql
immutable
set search_path to 'public'
as $function$
declare
  v_fila jsonb;
  v_suma numeric := 0;
  v_monto numeric;
  v_salida jsonb := '[]'::jsonb;
begin
  if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'Indica cómo se pagó.';
  end if;
  if jsonb_array_length(p_pagos) > 4 then
    raise exception 'Un cobro admite hasta 4 formas de pago.';
  end if;
  for v_fila in select * from jsonb_array_elements(p_pagos) loop
    if jsonb_typeof(v_fila) <> 'object' or (v_fila->>'metodo') is null or (v_fila->>'metodo') not in ('efectivo', 'tarjeta', 'transferencia') then
      raise exception 'Forma de pago no válida.';
    end if;
    begin
      v_monto := round((v_fila->>'monto')::numeric, 2);
    exception when others then
      raise exception 'El monto de una forma de pago no es válido.';
    end;
    if v_monto is null or v_monto <= 0 then
      raise exception 'Cada forma de pago debe tener un monto mayor que cero.';
    end if;
    v_suma := v_suma + v_monto;
    v_salida := v_salida || jsonb_build_array(jsonb_build_object('metodo', v_fila->>'metodo', 'monto', v_monto));
  end loop;
  if v_suma <> round(p_total, 2) then
    raise exception 'Las formas de pago suman $% y el monto es $%.', v_suma, round(p_total, 2);
  end if;
  return v_salida;
end;
$function$;
revoke all on function public.normalizar_pagos(jsonb, numeric) from public, anon;
grant execute on function public.normalizar_pagos(jsonb, numeric) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 2. Descuentos por línea
-- ════════════════════════════════════════════════════════════════
alter table public.facturas_venta_lineas
  add column descuento_tipo text,
  add column descuento_valor numeric,
  add column descuento_monto numeric not null default 0,
  add column descuento_motivo text;
alter table public.facturas_venta_lineas
  add constraint facturas_venta_lineas_descuento_valido check (
    (descuento_tipo is null and descuento_valor is null and descuento_monto = 0 and descuento_motivo is null)
    or (descuento_tipo in ('monto', 'porcentaje') and descuento_valor > 0 and descuento_monto > 0
        and char_length(btrim(descuento_motivo)) between 3 and 200)
  );

-- ════════════════════════════════════════════════════════════════
-- 3. Qué se corrigió o anuló de un abono
-- ════════════════════════════════════════════════════════════════
create table public.abonos_correcciones (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  abono_id uuid not null,
  accion text not null check (accion in ('anulado', 'corregido')),
  motivo text not null check (char_length(btrim(motivo)) between 3 and 200),
  monto_anterior numeric not null,
  fecha_anterior date not null,
  nota_anterior text,
  pagos_anterior jsonb,
  registrado_por_anterior uuid,
  monto_nuevo numeric,
  fecha_nueva date,
  pagos_nuevo jsonb,
  realizado_por uuid references public.perfiles(id) on delete set null,
  realizado_en timestamptz not null default now()
);
create index abonos_correcciones_factura_idx on public.abonos_correcciones (factura_id, realizado_en);
create index abonos_correcciones_optica_idx on public.abonos_correcciones (optica_id);

alter table public.abonos_correcciones enable row level security;
-- Solo lectura para el personal con acceso a Ventas; las filas las escriben únicamente las funciones de abajo.
create policy abonos_correcciones_staff_select on public.abonos_correcciones for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and tiene_permiso('ventas', 'ver')
  );
create policy abonos_correcciones_superadmin_all on public.abonos_correcciones for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.abonos_correcciones
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());
revoke all on public.abonos_correcciones from anon;
revoke insert, update, delete on public.abonos_correcciones from authenticated;

-- ════════════════════════════════════════════════════════════════
-- 4. Recalcular el estado de una venta a partir de sus abonos (uso interno de las funciones de abajo)
-- ════════════════════════════════════════════════════════════════
create function public.recalcular_estado_venta(p_factura_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_f record;
  v_abonado numeric;
  v_estado text;
  v_cuotas integer;
begin
  select * into v_f from facturas_venta where id = p_factura_id for update;
  if not found then
    return null;
  end if;
  if v_f.estado = 'anulada' or v_f.metodo_pago not in ('cuotas', 'abonos') then
    return v_f.estado;
  end if;
  select coalesce(sum(a.monto), 0) into v_abonado from abonos_factura a where a.factura_id = p_factura_id;
  v_estado := case when v_abonado >= v_f.monto_total then 'pagada' else 'pendiente_pago' end;
  v_cuotas := case
    when v_f.metodo_pago <> 'cuotas' then v_f.cuotas_pagadas
    when v_estado = 'pagada' then v_f.cuotas_totales
    else greatest(0, least(v_f.cuotas_totales - 1, floor(v_abonado / nullif(round(v_f.monto_total / v_f.cuotas_totales, 2), 0))::integer))
  end;
  if v_estado is distinct from v_f.estado or v_cuotas is distinct from v_f.cuotas_pagadas then
    update facturas_venta set estado = v_estado, cuotas_pagadas = coalesce(v_cuotas, cuotas_pagadas) where id = p_factura_id;
  end if;
  return v_estado;
end;
$function$;
revoke all on function public.recalcular_estado_venta(uuid) from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. registrar_abono con la forma de pago (parámetro nuevo al final)
-- ════════════════════════════════════════════════════════════════
drop function public.registrar_abono(uuid, numeric, date, text);

create function public.registrar_abono(
  p_factura_id uuid,
  p_monto numeric,
  p_fecha date default null,
  p_nota text default null,
  p_pagos jsonb default null
) returns table (abono_id uuid, saldo numeric, estado text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_factura record;
  v_pagado numeric;
  v_saldo numeric;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_id uuid;
  v_estado text;
  -- Fechas en hora de Ecuador: el servidor trabaja en UTC y, de noche, "hoy" ya sería mañana.
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_fecha date;
  v_pagos jsonb;
begin
  if v_monto <= 0 then
    raise exception 'El abono debe ser mayor que cero.';
  end if;
  v_fecha := coalesce(p_fecha, v_hoy);
  if v_fecha > v_hoy then
    raise exception 'La fecha del abono no puede ser futura.';
  end if;
  if p_pagos is not null then
    v_pagos := normalizar_pagos(p_pagos, v_monto);
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

  insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos)
  values (v_optica, p_factura_id, v_monto, v_fecha, nullif(btrim(p_nota), ''), auth.uid(), v_pagos)
  returning id into v_id;

  v_saldo := v_saldo - v_monto;
  v_estado := case when v_saldo <= 0 then 'pagada' else 'pendiente_pago' end;
  update facturas_venta
     set estado = v_estado,
         cuotas_pagadas = case when v_estado = 'pagada' and metodo_pago = 'cuotas' then cuotas_totales else cuotas_pagadas end
   where id = p_factura_id;

  return query select v_id, v_saldo, v_estado;
end;
$function$;

revoke all on function public.registrar_abono(uuid, numeric, date, text, jsonb) from public, anon;
grant execute on function public.registrar_abono(uuid, numeric, date, text, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 6. registrar_pago_cuota_venta con la forma de pago (parámetro nuevo al final)
-- ════════════════════════════════════════════════════════════════
drop function public.registrar_pago_cuota_venta(uuid);

create function public.registrar_pago_cuota_venta(
  p_factura_id uuid,
  p_pagos jsonb default null
) returns table (cuotas_pagadas integer, estado text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_factura record;
  v_pagado numeric;
  v_saldo numeric;
  v_monto numeric;
  v_nuevas_cuotas integer;
  v_estado_nuevo text;
  v_pagos jsonb;
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
  if p_pagos is not null and v_monto > 0 then
    v_pagos := normalizar_pagos(p_pagos, v_monto);
  end if;

  if v_monto > 0 then
    insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos)
    values (v_optica, p_factura_id, v_monto, (now() at time zone 'America/Guayaquil')::date, 'Cuota ' || v_nuevas_cuotas || ' de ' || v_factura.cuotas_totales, auth.uid(), v_pagos);
  end if;

  -- Si el pago completa la deuda antes de la última cuota (hubo abonos libres), todas cuentan como pagadas.
  if v_estado_nuevo = 'pagada' then v_nuevas_cuotas := v_factura.cuotas_totales; end if;
  update facturas_venta set cuotas_pagadas = v_nuevas_cuotas, estado = v_estado_nuevo where facturas_venta.id = p_factura_id;

  return query select v_nuevas_cuotas, v_estado_nuevo;
end;
$function$;

revoke all on function public.registrar_pago_cuota_venta(uuid, jsonb) from public, anon;
grant execute on function public.registrar_pago_cuota_venta(uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 7. Anular un abono (nivel "editar" de Ventas, motivo obligatorio)
-- ════════════════════════════════════════════════════════════════
create function public.anular_abono(p_abono_id uuid, p_motivo text)
returns table (saldo numeric, estado text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_a record;
  v_f record;
  v_abonado numeric;
  v_estado text;
begin
  if es_superadmin() then
    select a.optica_id into v_optica from abonos_factura a where a.id = p_abono_id;
  else
    v_optica := optica_de_vendedor('editar');
  end if;
  if char_length(v_motivo) < 3 then
    raise exception 'Escribe el motivo de la anulación del abono.';
  end if;
  select * into v_a from abonos_factura a where a.id = p_abono_id and a.optica_id = v_optica for update;
  if not found then
    raise exception 'El abono no existe.';
  end if;
  select * into v_f from facturas_venta f where f.id = v_a.factura_id for update;
  if v_f.estado = 'anulada' then
    raise exception 'La venta está anulada: ya no se puede cambiar sus abonos.';
  end if;

  insert into abonos_correcciones (optica_id, factura_id, abono_id, accion, motivo, monto_anterior, fecha_anterior, nota_anterior, pagos_anterior, registrado_por_anterior, realizado_por)
  values (v_optica, v_a.factura_id, v_a.id, 'anulado', left(v_motivo, 200), v_a.monto, v_a.fecha, v_a.nota, v_a.pagos, v_a.registrado_por, auth.uid());
  delete from abonos_factura where id = p_abono_id;

  v_estado := recalcular_estado_venta(v_a.factura_id);
  select coalesce(sum(x.monto), 0) into v_abonado from abonos_factura x where x.factura_id = v_a.factura_id;
  return query select greatest(0, v_f.monto_total - v_abonado), v_estado;
end;
$function$;

revoke all on function public.anular_abono(uuid, text) from public, anon;
grant execute on function public.anular_abono(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 8. Corregir un abono (monto, fecha, nota y forma de pago; nivel "editar", motivo obligatorio)
-- ════════════════════════════════════════════════════════════════
create function public.corregir_abono(
  p_abono_id uuid,
  p_motivo text,
  p_monto numeric,
  p_fecha date,
  p_nota text default null,
  p_pagos jsonb default null
) returns table (saldo numeric, estado text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_a record;
  v_f record;
  v_otros numeric;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_hoy date := (now() at time zone 'America/Guayaquil')::date;
  v_pagos jsonb;
  v_estado text;
  v_fecha date;
begin
  if es_superadmin() then
    select a.optica_id into v_optica from abonos_factura a where a.id = p_abono_id;
  else
    v_optica := optica_de_vendedor('editar');
  end if;
  if char_length(v_motivo) < 3 then
    raise exception 'Escribe el motivo de la corrección del abono.';
  end if;
  if v_monto <= 0 then
    raise exception 'El abono debe ser mayor que cero.';
  end if;
  select * into v_a from abonos_factura a where a.id = p_abono_id and a.optica_id = v_optica for update;
  if not found then
    raise exception 'El abono no existe.';
  end if;
  -- Sin fecha nueva se conserva la que tenía.
  v_fecha := coalesce(p_fecha, v_a.fecha);
  if v_fecha > v_hoy then
    raise exception 'La fecha del abono no puede ser futura.';
  end if;
  select * into v_f from facturas_venta f where f.id = v_a.factura_id for update;
  if v_f.estado = 'anulada' then
    raise exception 'La venta está anulada: ya no se puede cambiar sus abonos.';
  end if;
  if v_fecha < (v_f.created_at at time zone 'America/Guayaquil')::date then
    raise exception 'La fecha del abono no puede ser anterior a la de la venta.';
  end if;
  select coalesce(sum(x.monto), 0) into v_otros from abonos_factura x where x.factura_id = v_a.factura_id and x.id <> p_abono_id;
  if v_otros + v_monto > v_f.monto_total then
    raise exception 'El abono ($%) supera el saldo de la venta ($%).', v_monto, v_f.monto_total - v_otros;
  end if;
  if p_pagos is not null then
    v_pagos := normalizar_pagos(p_pagos, v_monto);
  elsif v_a.pagos is not null then
    raise exception 'Indica cómo se pagó el abono corregido.';
  end if;

  insert into abonos_correcciones (optica_id, factura_id, abono_id, accion, motivo, monto_anterior, fecha_anterior, nota_anterior, pagos_anterior, registrado_por_anterior, monto_nuevo, fecha_nueva, pagos_nuevo, realizado_por)
  values (v_optica, v_a.factura_id, v_a.id, 'corregido', left(v_motivo, 200), v_a.monto, v_a.fecha, v_a.nota, v_a.pagos, v_a.registrado_por, v_monto, v_fecha, v_pagos, auth.uid());
  update abonos_factura set monto = v_monto, fecha = v_fecha, nota = nullif(btrim(p_nota), ''), pagos = v_pagos where id = p_abono_id;

  v_estado := recalcular_estado_venta(v_a.factura_id);
  return query select greatest(0, v_f.monto_total - (v_otros + v_monto)), v_estado;
end;
$function$;

revoke all on function public.corregir_abono(uuid, text, numeric, date, text, jsonb) from public, anon;
grant execute on function public.corregir_abono(uuid, text, numeric, date, text, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 9. crear_factura_venta con descuentos por línea y pago al contado dividido
--    (parámetro nuevo p_pagos al final; las líneas aceptan descuento_tipo, descuento_valor y descuento_motivo)
-- ════════════════════════════════════════════════════════════════
drop function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid, text);

create function public.crear_factura_venta(
  p_optica_id uuid,
  p_paciente_id uuid,
  p_metodo_pago text,
  p_lineas jsonb,
  p_cita_id uuid default null,
  p_consulta_id uuid default null,
  p_cuotas_totales integer default null,
  p_registrado_por uuid default null,
  p_factura_electronica text default null,
  p_pagos jsonb default null
) returns table (id uuid, monto_total numeric, estado text, created_at timestamptz, numero integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_linea jsonb;
  v_tipo text;
  v_monto_total numeric := 0;
  v_estado text;
  v_factura_id uuid;
  v_numero integer;
  v_created_at timestamptz;
  v_bruto numeric;
  v_subtotal numeric;
  v_stock_restante integer;
  v_electronica text := nullif(btrim(p_factura_electronica), '');
  v_desc_tipo text;
  v_desc_valor numeric;
  v_desc_monto numeric;
  v_desc_motivo text;
  v_hay_descuento boolean := false;
  v_pagos jsonb;
begin
  -- El superadmin (soporte e impersonación) actúa sobre la óptica indicada; el resto, sobre la suya.
  if es_superadmin() then
    v_optica := p_optica_id;
  else
    v_optica := optica_de_vendedor('crear');
    if p_optica_id is distinct from v_optica then
      raise exception 'No tienes acceso a esta óptica.';
    end if;
  end if;
  if not exists (select 1 from pacientes_base pb where pb.id = p_paciente_id and pb.optica_id = v_optica and pb.anonimizado_en is null) then
    raise exception 'El paciente no existe.';
  end if;
  if p_cita_id is not null and not exists (select 1 from citas_base cb where cb.id = p_cita_id and cb.optica_id = v_optica) then
    raise exception 'La cita no existe.';
  end if;
  if p_consulta_id is not null and not exists (select 1 from consultas_base cs where cs.id = p_consulta_id and cs.optica_id = v_optica) then
    raise exception 'La consulta no existe.';
  end if;
  if jsonb_array_length(p_lineas) = 0 then
    raise exception 'Un comprobante necesita al menos una línea.';
  end if;
  if v_electronica is not null and char_length(v_electronica) > 60 then
    raise exception 'El número de la factura electrónica es demasiado largo.';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_tipo := v_linea->>'tipo';
    if v_tipo is null or v_tipo not in ('producto', 'servicio', 'luna') then
      raise exception 'Tipo de línea no válido.';
    end if;
    if v_linea->'detalle' is not null and jsonb_typeof(v_linea->'detalle') not in ('object', 'null') then
      raise exception 'El detalle de la línea no es válido.';
    end if;
    v_bruto := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;
    v_desc_tipo := nullif(v_linea->>'descuento_tipo', '');
    v_desc_monto := 0;
    if v_desc_tipo is not null then
      v_hay_descuento := true;
      v_desc_valor := (v_linea->>'descuento_valor')::numeric;
      v_desc_motivo := btrim(coalesce(v_linea->>'descuento_motivo', ''));
      if v_desc_tipo not in ('monto', 'porcentaje') or v_desc_valor is null or v_desc_valor <= 0 then
        raise exception 'El descuento de "%" no es válido.', (v_linea->>'descripcion');
      end if;
      if char_length(v_desc_motivo) < 3 then
        raise exception 'Escribe el motivo del descuento de "%".', (v_linea->>'descripcion');
      end if;
      v_desc_monto := case when v_desc_tipo = 'porcentaje' then round(v_bruto * v_desc_valor / 100, 2) else round(v_desc_valor, 2) end;
      if v_desc_tipo = 'porcentaje' and v_desc_valor > 100 then
        raise exception 'El descuento de "%" no puede pasar del 100 %%.', (v_linea->>'descripcion');
      end if;
      if v_desc_monto <= 0 or v_desc_monto > v_bruto then
        raise exception 'El descuento de "%" no puede ser mayor que su valor.', (v_linea->>'descripcion');
      end if;
    end if;
    v_monto_total := v_monto_total + (v_bruto - v_desc_monto);
  end loop;

  -- Descontar es una decisión de quien puede corregir cobros (nivel "editar" de Ventas), no de cualquiera que venda.
  if v_hay_descuento and not (es_superadmin() or tiene_permiso('ventas', 'editar')) then
    raise exception 'No tienes permiso para aplicar descuentos.';
  end if;

  v_estado := case when p_metodo_pago in ('cuotas', 'abonos') and v_monto_total > 0 then 'pendiente_pago' else 'pagada' end;

  -- El pago al contado (si se indica) debe sumar exactamente el total; una venta a cuotas o con abonos no lleva pago al contado.
  if p_pagos is not null then
    if v_estado <> 'pagada' then
      raise exception 'Una venta a cuotas o con abonos no lleva pago al contado.';
    end if;
    if v_monto_total > 0 then
      v_pagos := normalizar_pagos(p_pagos, v_monto_total);
    end if;
  end if;

  -- Siguiente número de esta óptica (la fila del contador queda bloqueada hasta el commit).
  insert into contador_comprobantes_venta (optica_id, ultimo_numero)
  values (v_optica, 1)
  on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1
  returning contador_comprobantes_venta.ultimo_numero into v_numero;

  begin
    insert into facturas_venta (
      optica_id, paciente_id, cita_id, consulta_id, metodo_pago,
      cuotas_totales, monto_total, estado, registrado_por, numero, factura_electronica, pagos
    ) values (
      v_optica, p_paciente_id, p_cita_id, p_consulta_id, p_metodo_pago,
      p_cuotas_totales, v_monto_total, v_estado, auth.uid(), v_numero, v_electronica, v_pagos
    )
    returning facturas_venta.id, facturas_venta.created_at into v_factura_id, v_created_at;
  exception when unique_violation then
    raise exception 'Ese número de factura electrónica ya está registrado en otra venta.';
  end;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_tipo := v_linea->>'tipo';
    v_bruto := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;
    v_desc_tipo := nullif(v_linea->>'descuento_tipo', '');
    v_desc_valor := null;
    v_desc_motivo := null;
    v_desc_monto := 0;
    if v_desc_tipo is not null then
      v_desc_valor := (v_linea->>'descuento_valor')::numeric;
      v_desc_motivo := left(btrim(v_linea->>'descuento_motivo'), 200);
      v_desc_monto := case when v_desc_tipo = 'porcentaje' then round(v_bruto * v_desc_valor / 100, 2) else round(v_desc_valor, 2) end;
    end if;
    v_subtotal := v_bruto - v_desc_monto;

    -- Solo las líneas de producto (monturas y accesorios) descuentan inventario.
    if v_tipo = 'producto' and (v_linea->>'producto_id') is not null then
      update inventario
         set stock = inventario.stock - (v_linea->>'cantidad')::integer
       where inventario.id = (v_linea->>'producto_id')::uuid
         and inventario.optica_id = v_optica
         and inventario.stock >= (v_linea->>'cantidad')::integer
      returning inventario.stock into v_stock_restante;

      if not found then
        raise exception 'No hay suficiente stock para "%".', (v_linea->>'descripcion');
      end if;
    end if;

    insert into facturas_venta_lineas (
      factura_id, producto_id, tipo, descripcion, cantidad, precio_unitario, subtotal, detalle,
      descuento_tipo, descuento_valor, descuento_monto, descuento_motivo
    ) values (
      v_factura_id,
      case when v_tipo = 'producto' then (v_linea->>'producto_id')::uuid else null end,
      v_tipo,
      v_linea->>'descripcion',
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario')::numeric,
      v_subtotal,
      case when v_tipo = 'luna' and jsonb_typeof(v_linea->'detalle') = 'object' then v_linea->'detalle' else null end,
      v_desc_tipo, v_desc_valor, v_desc_monto, v_desc_motivo
    );
  end loop;

  return query select v_factura_id, v_monto_total, v_estado, v_created_at, v_numero;
end;
$function$;

revoke all on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid, text, jsonb) from public, anon;
grant execute on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid, text, jsonb) to authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
-- Las tres funciones se restauran con sus definiciones de 0088 (con el nivel de 0091) y 0094; después:
--   drop function public.anular_abono(uuid, text);
--   drop function public.corregir_abono(uuid, text, numeric, date, text, jsonb);
--   drop function public.recalcular_estado_venta(uuid);
--   drop function public.normalizar_pagos(jsonb, numeric);
--   drop table public.abonos_correcciones;
--   alter table public.facturas_venta_lineas drop column descuento_tipo, drop column descuento_valor, drop column descuento_monto, drop column descuento_motivo;
--   alter table public.facturas_venta drop column pagos;
--   alter table public.abonos_factura drop column pagos;
