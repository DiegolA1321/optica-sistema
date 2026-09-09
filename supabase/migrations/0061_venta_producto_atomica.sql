-- Hallazgo G5 de la auditoría 2026-09-09: VentaProductoModal.jsx registraba
-- la venta y descontaba el stock como DOS llamadas separadas desde el
-- navegador — insert en `ventas`, luego un update en `inventario` calculado
-- con el stock que el cliente tenía cargado en memoria (lectura obsoleta).
-- Dos problemas reales, no cosméticos:
--   1. Si el update de inventario fallaba (RLS, red, o el permiso del
--      usuario no alcanza para inventario) la venta YA estaba insertada —
--      queda una venta registrada sin descontar stock, y el error se
--      tragaba en silencio (el código ni siquiera mostraba un mensaje).
--   2. Dos ventas concurrentes del mismo producto parten del mismo stock
--      leído en memoria (`productoSeleccionado.stock`) — la segunda
--      sobreescribe el cálculo de la primera ("lost update"), pudiendo
--      dejar stock incorrecto o negativo.
-- Se reemplazan las dos llamadas por una única función que hace ambas
-- escrituras en una sola sentencia top-level: si algo falla (incluida la
-- falta de stock o de permiso), Postgres revierte automáticamente TODO lo
-- que la función alcanzó a hacer, sin necesidad de manejar excepciones a
-- mano. El "update ... where stock >= p_cantidad" además resuelve la
-- concurrencia: la fila se bloquea por la duración del update, así que la
-- segunda venta concurrente ve el stock ya descontado, no el obsoleto.
--
-- SECURITY INVOKER (el default) a propósito: corre con los permisos de
-- quien llama, así que las políticas RLS de `ventas` e `inventario` se
-- siguen aplicando exactamente igual que con las dos llamadas separadas —
-- esto no abre ningún permiso nuevo, solo hace atómico lo que ya se hacía.

create function public.registrar_venta_producto(
  p_optica_id uuid,
  p_paciente_id uuid,
  p_producto_id uuid,
  p_producto_nombre text,
  p_cantidad integer,
  p_precio_unitario numeric,
  p_monto_total numeric,
  p_metodo_pago text,
  p_cuotas_totales integer,
  p_estado text,
  p_registrado_por uuid
) returns table (id uuid, created_at timestamptz, stock_restante integer)
language plpgsql
set search_path = public
as $$
declare
  v_stock_restante integer;
  v_id uuid;
  v_created_at timestamptz;
begin
  if p_cantidad is null or p_cantidad <= 0 then
    raise exception 'La cantidad debe ser mayor a cero.';
  end if;

  update inventario
     set stock = inventario.stock - p_cantidad
   where inventario.id = p_producto_id
     and inventario.optica_id = p_optica_id
     and inventario.stock >= p_cantidad
  returning inventario.stock into v_stock_restante;

  if not found then
    raise exception 'No hay suficiente stock disponible para esta venta.';
  end if;

  insert into ventas (
    optica_id, paciente_id, producto_id, producto_nombre, cantidad,
    precio_unitario, monto_total, metodo_pago, cuotas_totales, cuotas_pagadas,
    estado, registrado_por
  ) values (
    p_optica_id, p_paciente_id, p_producto_id, p_producto_nombre, p_cantidad,
    p_precio_unitario, p_monto_total, p_metodo_pago, p_cuotas_totales, 0,
    p_estado, p_registrado_por
  )
  returning ventas.id, ventas.created_at into v_id, v_created_at;

  return query select v_id, v_created_at, v_stock_restante;
end;
$$;

revoke all on function public.registrar_venta_producto(uuid, uuid, uuid, text, integer, numeric, numeric, text, integer, text, uuid) from public;
grant execute on function public.registrar_venta_producto(uuid, uuid, uuid, text, integer, numeric, numeric, text, integer, text, uuid) to authenticated;
