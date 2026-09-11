-- Punto 06 del Diagnóstico Maestro: modelo de factura con líneas múltiples.
-- NO APLICADA TODAVÍA — Diego pidió revisar el SQL final antes de correrla
-- contra la base real (node scripts/_run-migration.mjs se ejecuta después
-- de su aprobación, no como parte de este commit).
--
-- OJO — hallazgo al preparar esto: ya existe una tabla `facturas` en la
-- base, pero es otra cosa completamente distinta (columnas numero/periodo/
-- monto/emitida_at/pagada_at — la factura de suscripción SaaS que
-- SuperadminPanel.jsx le cobra a cada óptica, usada también en
-- Mensajes.jsx). Por eso esta tabla se llama `facturas_venta` (la factura
-- que la óptica le da a SU paciente por una venta), no `facturas` a secas
-- — nombrarla igual habría chocado de frente con esa tabla existente y la
-- migración habría fallado con "relation already exists" al aplicarla.
--
-- Decisiones de Diego (2026-09-10) que fija este diseño:
--   1. Una línea "servicio" (examen, ajuste, garantía) no tiene producto_id
--      y NO descuenta inventario — solo las líneas "producto" lo hacen.
--   2. El camino viejo (consultas.monto_venta/producto_id) se migra a este
--      modelo en una fase separada, no bloqueante para esto.
--   3. Si una línea está mal, se anula la factura completa — no se editan
--      líneas de una factura ya cerrada.
--   4. Un solo método de pago para el total de la factura, no por línea.
--   5. Una factura tiene 0 o 1 relación con una consulta/cita, nunca varias.
--   6. Se reutiliza el permiso ya usado hoy para `ventas` (inventario o
--      pacientes o consultas) — no se crea un permiso "facturación" nuevo.
--
-- estado de facturas_venta (pregunta de Diego sobre pagos en cuotas): tres
-- valores, no dos. 'pagada' cubre tanto un pago directo/tarjeta (queda
-- pagada de inmediato, no hay cuotas que rastrear) como una factura en
-- cuotas que ya cobró todas sus cuotas. 'pendiente_pago' es exclusivo de
-- metodo_pago='cuotas' mientras cuotas_pagadas < cuotas_totales. 'anulada'
-- es el único mecanismo de "corrección" (ver decisión 3) y puede llegar
-- desde cualquiera de los otros dos estados.
--
-- A diferencia de `ventas` (donde Pacientes.jsx calcula la transición
-- pendiente→completado en JavaScript, en registrarCuotaPagada, sin nada
-- que lo respalde en la base — confirmado al revisar ese código para este
-- diseño), acá la transición de estado por pago de cuota vive en la propia
-- RPC `registrar_pago_cuota_venta`, no en el cliente: una sola fuente de
-- verdad para esa regla, sin depender de que cada pantalla que registre un
-- pago la reimplemente igual.
--
-- SECURITY INVOKER (default, igual que registrar_venta_producto en
-- 0061) a propósito en las tres funciones: corren con los permisos de
-- quien llama, así que las políticas RLS de abajo se siguen aplicando
-- igual que si fueran inserts/updates directos — no se abre ningún
-- permiso nuevo, solo se hace atómico lo que ya requeriría varias
-- llamadas desde el navegador.

create table public.facturas_venta (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes_base(id) on delete cascade,
  cita_id uuid references public.citas_base(id) on delete set null,
  consulta_id uuid references public.consultas_base(id) on delete set null,
  metodo_pago text not null check (metodo_pago in ('directo', 'tarjeta', 'cuotas')),
  cuotas_totales integer check (cuotas_totales is null or cuotas_totales > 0),
  cuotas_pagadas integer not null default 0 check (cuotas_pagadas >= 0),
  monto_total numeric not null check (monto_total >= 0),
  estado text not null check (estado in ('pagada', 'pendiente_pago', 'anulada')),
  anulada_motivo text,
  anulada_at timestamptz,
  anulada_por uuid references public.perfiles(id) on delete set null,
  registrado_por uuid references public.perfiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint facturas_venta_cuotas_solo_si_metodo_cuotas check (
    (metodo_pago = 'cuotas' and cuotas_totales is not null)
    or (metodo_pago != 'cuotas' and cuotas_totales is null)
  ),
  constraint facturas_venta_pendiente_pago_solo_si_cuotas check (
    estado != 'pendiente_pago' or metodo_pago = 'cuotas'
  )
);

create table public.facturas_venta_lineas (
  id uuid primary key default gen_random_uuid(),
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  producto_id uuid references public.inventario(id) on delete set null,
  tipo text not null check (tipo in ('producto', 'servicio')),
  descripcion text not null,
  cantidad integer not null default 1 check (cantidad > 0),
  precio_unitario numeric not null check (precio_unitario >= 0),
  subtotal numeric not null check (subtotal >= 0),
  created_at timestamptz not null default now()
);

create index facturas_venta_optica_id_idx on public.facturas_venta(optica_id);
create index facturas_venta_paciente_id_idx on public.facturas_venta(paciente_id);
create index facturas_venta_lineas_factura_id_idx on public.facturas_venta_lineas(factura_id);

alter table public.facturas_venta enable row level security;
alter table public.facturas_venta_lineas enable row level security;

-- Mismo criterio que ventas_staff_select/ventas_staff_write (0047):
-- reutiliza tiene_permiso_modulo de inventario/pacientes/consultas, no un
-- permiso "facturación" nuevo (decisión 6 de Diego).
create policy facturas_venta_staff_select on public.facturas_venta for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()));

create policy facturas_venta_staff_write on public.facturas_venta for all
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  )
  with check (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  );

create policy facturas_venta_superadmin_all on public.facturas_venta for all
  using (es_superadmin()) with check (es_superadmin());

create policy facturas_venta_lineas_staff_select on public.facturas_venta_lineas for select
  using (exists (
    select 1 from public.facturas_venta f
    where f.id = facturas_venta_lineas.factura_id
      and f.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
  ));

create policy facturas_venta_lineas_staff_write on public.facturas_venta_lineas for all
  using (exists (
    select 1 from public.facturas_venta f
    where f.id = facturas_venta_lineas.factura_id
      and f.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
      and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  ))
  with check (exists (
    select 1 from public.facturas_venta f
    where f.id = facturas_venta_lineas.factura_id
      and f.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
      and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  ));

create policy facturas_venta_lineas_superadmin_all on public.facturas_venta_lineas for all
  using (es_superadmin()) with check (es_superadmin());

-- Crea la factura y todas sus líneas en una sola transacción: si una línea
-- de tipo 'producto' no tiene stock suficiente, TODO se revierte (nada de
-- factura a medias) — mismo patrón que registrar_venta_producto (0061).
-- p_lineas: jsonb array de {producto_id, tipo, descripcion, cantidad, precio_unitario}.
create function public.crear_factura_venta(
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

  v_estado := case when p_metodo_pago = 'cuotas' then 'pendiente_pago' else 'pagada' end;

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

-- Única forma de "corregir" una factura ya creada (decisión 3 de Diego):
-- anula el total, nunca edita una línea. Repone el stock de las líneas de
-- producto para que anular una venta no deje el inventario descontado
-- para siempre por algo que ya no cuenta.
create function public.anular_factura_venta(
  p_factura_id uuid,
  p_motivo text,
  p_anulada_por uuid default null
) returns void
language plpgsql
set search_path = public
as $$
declare
  v_actualizado uuid;
  v_linea record;
begin
  update facturas_venta
     set estado = 'anulada', anulada_motivo = p_motivo, anulada_at = now(), anulada_por = p_anulada_por
   where facturas_venta.id = p_factura_id
     and facturas_venta.estado != 'anulada'
  returning facturas_venta.id into v_actualizado;

  if v_actualizado is null then
    raise exception 'La factura no existe o ya estaba anulada.';
  end if;

  for v_linea in
    select producto_id, cantidad from facturas_venta_lineas
    where facturas_venta_lineas.factura_id = p_factura_id and facturas_venta_lineas.tipo = 'producto' and facturas_venta_lineas.producto_id is not null
  loop
    update inventario set stock = inventario.stock + v_linea.cantidad where inventario.id = v_linea.producto_id;
  end loop;
end;
$$;

revoke all on function public.anular_factura_venta(uuid, text, uuid) from public;
grant execute on function public.anular_factura_venta(uuid, text, uuid) to authenticated;

-- Transición de estado por pago de cuota — vive acá, no en el cliente
-- (contraste deliberado con ventas/Pacientes.jsx: ver nota al inicio).
-- Rechaza pagar una factura que no es de cuotas o que ya está anulada, y
-- nunca deja pasar cuotas_pagadas de cuotas_totales.
create function public.registrar_pago_cuota_venta(
  p_factura_id uuid
) returns table (cuotas_pagadas integer, estado text)
language plpgsql
set search_path = public
as $$
declare
  v_factura record;
  v_nuevas_cuotas integer;
  v_estado_nuevo text;
begin
  select * into v_factura from facturas_venta where facturas_venta.id = p_factura_id for update;

  if not found then
    raise exception 'La factura no existe.';
  end if;
  if v_factura.metodo_pago != 'cuotas' then
    raise exception 'Esta factura no es de pago en cuotas.';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La factura está anulada.';
  end if;
  if v_factura.cuotas_pagadas >= v_factura.cuotas_totales then
    raise exception 'Esta factura ya está totalmente pagada.';
  end if;

  v_nuevas_cuotas := v_factura.cuotas_pagadas + 1;
  v_estado_nuevo := case when v_nuevas_cuotas >= v_factura.cuotas_totales then 'pagada' else 'pendiente_pago' end;

  update facturas_venta set cuotas_pagadas = v_nuevas_cuotas, estado = v_estado_nuevo where facturas_venta.id = p_factura_id;

  return query select v_nuevas_cuotas, v_estado_nuevo;
end;
$$;

revoke all on function public.registrar_pago_cuota_venta(uuid) from public;
grant execute on function public.registrar_pago_cuota_venta(uuid) to authenticated;
