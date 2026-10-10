"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, AlertTriangle } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { registrarLog } from "../utilidades/logs"
import { totalAbonado } from "../utilidades/abonos"

const dinero = (n) => `$${(Number(n) || 0).toFixed(2)}`

// Anular una venta (única forma de corregir una factura). Antes de confirmar se advierte
// cuánto dinero ya se recibió, que el stock se repone y que sus órdenes de laboratorio se cancelan.
export default function AnularVentaModal({ factura, paciente, abonos, ordenesAbiertas = 0, usuario, onAnulada, onCerrar }) {
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }
  const refModal = useModalAccesible(true, cerrar)
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
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo anular la venta. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
    }
    registrarLog(usuario, "ventas", "Anuló una venta", `${paciente?.nombre || ""} · ${dinero(factura.montoTotal)} · ${motivo.trim()}`)
    setGuardando(false)
    onAnulada?.({ motivo: motivo.trim() })
    onCerrar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <form ref={refModal} onSubmit={confirmar} role="alertdialog" aria-modal="true" aria-labelledby="anular-titulo" className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="anular-titulo" className="text-base font-bold" style={{ color: INK }}>Anular esta venta</h2>
              <p className="text-xs text-slate-500">{paciente?.nombre} · {dinero(factura.montoTotal)}</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {recibido > 0 && (
            <p role="alert" className="rounded-xl border border-amber-300/70 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <span className="font-bold">Ya se recibieron {dinero(recibido)}</span>{nAbonos > 0 ? ` en ${nAbonos} abono${nAbonos === 1 ? "" : "s"}` : ""}. El sistema no devuelve dinero: deberás reembolsarlo o reasignarlo por fuera.
            </p>
          )}
          <ul className="list-disc space-y-1 pl-5 text-xs text-slate-600">
            <li>El stock de los productos de esta venta se repone.</li>
            {ordenesAbiertas > 0 && <li>{ordenesAbiertas === 1 ? "Su orden de laboratorio sin entregar se cancela" : `Sus ${ordenesAbiertas} órdenes de laboratorio sin entregar se cancelan`}.</li>}
            <li>La venta queda en el historial como anulada; no se puede deshacer.</li>
          </ul>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Motivo *</span>
            <textarea rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:bg-white" />
          </label>
          {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={cerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Volver</button>
          <button type="submit" disabled={guardando} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">{guardando ? "Anulando…" : "Anular venta"}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
