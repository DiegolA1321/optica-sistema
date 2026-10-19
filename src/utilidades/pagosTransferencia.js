// Pagos por transferencia que reportan los pacientes desde su portal (migración 0131): la óptica los ve, revisa el comprobante y los confirma (queda como un abono con el método «Transferencia»)
// o los rechaza con un motivo. Los pagos «por verificar» salen en Ventas · Cobros y saldos y en «Requiere tu atención» del Inicio, con el mismo número.
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { mapAbono, EVENTO_ABONO } from "./abonos"

export const mapPagoTransferencia = (p) => ({
  id: p.id, pacienteId: p.paciente_id, facturaId: p.factura_id, monto: Number(p.monto), estado: p.estado, creadoEn: p.creado_en,
  archivoNombre: p.archivo_nombre, archivoTipo: p.archivo_tipo,
  pacienteNombre: p.pacientes_base?.nombre || "", facturaNumero: p.facturas_venta?.numero ?? null,
})

// Los pagos por verificar de la óptica (se vuelven a pedir cada minuto, como lo que llega del portal). `habilitado`: quien puede ver Ventas.
export function usePagosTransferencia(opticaId, habilitado) {
  const [pagos, setPagos] = useState([])
  const recargar = useCallback(async () => {
    if (!supabase || !habilitado || !opticaId || document.hidden) return
    const { data } = await supabase.from("pagos_transferencia").select("*, pacientes_base(nombre), facturas_venta(numero)").eq("optica_id", opticaId).eq("estado", "por_verificar").order("creado_en", { ascending: true })
    if (data) setPagos(data.map(mapPagoTransferencia))
  }, [opticaId, habilitado])
  useEffect(() => {
    if (!supabase || !habilitado || !opticaId) return undefined
    recargar()
    const t = setInterval(recargar, 60000)
    return () => clearInterval(t)
  }, [opticaId, habilitado, recargar])
  return { pagos, recargar }
}

// El comprobante: { nombre, tipo, base64 } (solo lo baja quien puede ver Ventas).
export async function archivoDelPago(pagoId) {
  const { data, error } = await supabase.rpc("archivo_pago_transferencia", { p_pago_id: pagoId })
  if (error || !data) return { error: error?.message || "No se pudo abrir el comprobante." }
  return { archivo: data }
}

// Confirmar: la base registra el abono («Transferencia»). Aquí se vuelven a leer los abonos de esa venta y se avisa a la aplicación (sin recargar) y se devuelve el estado nuevo de la venta.
export async function confirmarPago(pagoId, facturaId) {
  const { error } = await supabase.rpc("confirmar_pago_transferencia", { p_pago_id: pagoId })
  if (error) return { error: error.message }
  const { data: filas } = await supabase.from("abonos_factura").select("*").eq("factura_id", facturaId)
  ;(filas || []).forEach((f) => window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(f) })))
  const { data: factura } = await supabase.from("facturas_venta").select("estado, cuotas_pagadas").eq("id", facturaId).maybeSingle()
  return { estado: factura?.estado || null, cuotasPagadas: factura?.cuotas_pagadas }
}

export async function rechazarPago(pagoId, motivo) {
  const { error } = await supabase.rpc("rechazar_pago_transferencia", { p_pago_id: pagoId, p_motivo: motivo })
  return error ? { error: error.message } : {}
}
