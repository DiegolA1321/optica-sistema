"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, UserX } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { MOTIVOS_NO_COMPRO } from "../utilidades/pasesVenta"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"

// "No compró": cierra el pase como descartado y guarda el motivo (descartar_pase,
// migración 0086), que luego alimenta el embudo de R40.
export default function NoComproModal({ nombrePaciente, paseId, onCancelar, onHecho }) {
  const [motivo, setMotivo] = useState("")
  const [detalle, setDetalle] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCancelar() }
  const refModal = useModalAccesible(true, cerrar)

  const confirmar = async (e) => {
    e.preventDefault()
    if (!motivo) { setError("Elige el motivo."); return }
    if (motivo === "otro" && detalle.trim().length < 3) { setError("Describe el motivo."); return }
    setGuardando(true)
    setError("")
    if (supabase) {
      const { error: errorRpc } = await supabase.rpc("descartar_pase", { p_pase_id: paseId, p_motivo: motivo, p_detalle: motivo === "otro" ? detalle.trim() : null })
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo guardar. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
    }
    setGuardando(false)
    onHecho({ motivo, detalle: motivo === "otro" ? detalle.trim() : null })
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <form
        ref={refModal}
        onSubmit={confirmar}
        role="dialog"
        aria-modal="true"
        aria-labelledby="no-compro-titulo"
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-600"><UserX size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="no-compro-titulo" className="text-base font-bold" style={{ color: INK }}>El paciente no compró</h2>
              <p className="text-xs text-slate-500">{nombrePaciente}</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>
        <fieldset className="min-h-0 flex-1 space-y-2 overflow-y-auto px-5 py-4">
          <legend className="mb-1 text-sm font-semibold text-slate-700">¿Por qué?</legend>
          {MOTIVOS_NO_COMPRO.map((m) => (
            <label key={m.id} className={"flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors " + (motivo === m.id ? "border-slate-700 bg-slate-50 text-slate-900" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}>
              <input type="radio" name="motivo-no-compro" value={m.id} checked={motivo === m.id} onChange={() => { setMotivo(m.id); setError("") }} className="accent-slate-800" />
              {m.etiqueta}
            </label>
          ))}
          {motivo === "otro" && (
            <div>
              <label htmlFor="no-compro-detalle" className="mb-1 block text-xs font-semibold text-slate-600">Cuéntanos el motivo</label>
              <textarea id="no-compro-detalle" rows={2} maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} autoFocus className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100" />
            </div>
          )}
          <p className="pt-1 text-xs text-slate-500">Quedará en la lista de "No compraron" y se podrá volver a la lista de espera si cambia de opinión.</p>
          {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
        </fieldset>
        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={cerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Volver</button>
          <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ backgroundColor: INK }}>{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
