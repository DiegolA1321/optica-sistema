"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, mensajeDeError } from "../utilidades/permisos"
import { registrarLog } from "../utilidades/logs"
import { totalAbonado } from "../utilidades/abonos"
import { numeroComprobante } from "../utilidades/comprobantes"
import { Cascaron } from "./AtencionPaciente"

// Anular una venta (única forma de corregir un comprobante). Antes de confirmar se advierte
// cuánto dinero ya se recibió, que el stock se repone y que sus órdenes de laboratorio se cancelan.
export default function AnularVentaModal({ factura, paciente, abonos, ordenesAbiertas = 0, usuario, onAnulada, onCerrar }) {
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  // Lo recibido: una venta pagada (contado, tarjeta o ya completada) se cobró completa; una pendiente, lo abonado.
  const recibido = factura.estado === "pagada" ? Number(factura.montoTotal) : totalAbonado(factura.id, abonos)
  const nAbonos = abonos.filter((a) => a.facturaId === factura.id).length

  const confirmar = async (e) => {
    e.preventDefault()
    if (motivo.trim().length < 3) { setError("Escribe el motivo de la anulación."); return }
    setGuardando(true)
    setError("")
    if (supabase) {
      const { error: errorRpc } = await supabase.rpc("anular_factura_venta", { p_factura_id: factura.id, p_motivo: motivo.trim(), p_anulada_por: usuario?.id || null })
      if (errorRpc) {
        setError(mensajeDeError(errorRpc, "No se pudo anular la venta. Revisa tu conexión e intenta de nuevo."))
        setGuardando(false)
        return
      }
    }
    registrarLog(usuario, "ventas", "Anuló una venta", `${paciente?.nombre || ""} · ${numeroComprobante(factura.numero)} · ${dinero(factura.montoTotal)} · ${motivo.trim()}`)
    setGuardando(false)
    onAnulada?.({ motivo: motivo.trim() })
    onCerrar()
  }

  return (
    <Cascaron
      titulo="Anular esta venta"
      subtitulo={`${paciente?.nombre || "Paciente"} · ${numeroComprobante(factura.numero)} · ${dinero(factura.montoTotal)}`}
      Icono={AlertTriangle}
      ancho="max-w-md"
      onCerrar={() => { if (!guardando) onCerrar() }}
      formulario={{ onSubmit: confirmar }}
      pie={(
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Volver</button>
          <button type="submit" disabled={guardando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">{guardando ? "Anulando…" : "Anular venta"}</button>
        </div>
      )}
    >
      <div className="space-y-3 px-5 py-4">
        {recibido > 0 && (
          <p role="alert" className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <span className="font-bold">Ya se recibieron {dinero(recibido)}</span>{nAbonos > 0 ? ` en ${nAbonos} abono${nAbonos === 1 ? "" : "s"}` : ""}. El sistema no devuelve dinero: deberás reembolsarlo o reasignarlo por fuera.
          </p>
        )}
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>El stock de los productos de esta venta se repone.</li>
          {ordenesAbiertas > 0 && <li>{ordenesAbiertas === 1 ? "Su orden de laboratorio sin entregar se cancela" : `Sus ${ordenesAbiertas} órdenes de laboratorio sin entregar se cancelan`}.</li>}
          <li>La venta queda en el historial como anulada; no se puede deshacer.</li>
        </ul>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Motivo *</span>
          <textarea rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white" />
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
