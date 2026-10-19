-- 0126 — Portal del paciente: historial de abonos en «Mis compras» y en el detalle del saldo.
--
-- ESTADO: ESCRITA, NO APLICADA. Espera la aprobación de Diego y el protocolo de siempre (respaldo, ensayo y verificación con sesión real de paciente).
--
-- Qué hace: `mis_compras_paciente` ya entrega, por compra, lo abonado y el saldo (sumas). Para mostrar «el historial de abonos» en el detalle del saldo y de cada compra,
-- agrega a cada compra un campo `abonos`: la lista de sus abonos vigentes, del más antiguo al más reciente, con solo la fecha y el monto. No se entrega la nota ni quién
-- registró el abono (son datos internos del personal). Los abonos anulados no aparecen, igual que en la suma de `abonado`.
--
-- Compatible con la versión publicada: la firma de la función no cambia (`create or replace`, sin duplicar sobrecargas) y el campo `abonos` es nuevo, así que el portal
-- publicado, que no lo lee, sigue funcionando igual. El portal nuevo muestra el historial solo si el campo llega; si no, muestra el total abonado.
--
-- Lo demás de la función es idéntico a 0110: mismas columnas, mismo orden, misma validación de sesión (`sesion_paciente_valida`).

create or replace function public.mis_compras_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.fila order by x.fecha desc, x.numero desc), '[]'::jsonb)
  from (
    select f.created_at as fecha, f.numero,
      jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'fecha', f.created_at, 'total', f.monto_total, 'estado', f.estado,
        'abonado', case when f.estado = 'pagada' then f.monto_total else coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0) end,
        'saldo', case when f.estado = 'pendiente_pago' then greatest(0, f.monto_total - coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0)) else 0 end,
        'abonos', coalesce((select jsonb_agg(jsonb_build_object('fecha', a.fecha, 'monto', a.monto) order by a.fecha, a.created_at) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), '[]'::jsonb),
        'lineas', coalesce((select jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'cantidad', l.cantidad, 'subtotal', l.subtotal) order by l.created_at) from facturas_venta_lineas l where l.factura_id = f.id), '[]'::jsonb),
        'factura_electronica', case when f.factura_electronica is null then null else jsonb_build_object(
          'numero', f.factura_electronica,
          'autorizada_el', (select e.autorizada_el from facturas_electronicas e where e.factura_id = f.id),
          'pdf', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'pdf'),
          'xml', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'xml')
        ) end
      ) as fila
    from facturas_venta f
    where f.paciente_id = p_paciente_id and f.estado <> 'anulada' and sesion_paciente_valida(p_paciente_id, p_token)
  ) x;
$function$;
revoke all on function public.mis_compras_paciente(uuid, text) from public;
grant execute on function public.mis_compras_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   Volver a crear la función con el cuerpo de 0110 (sin el campo `abonos`).
