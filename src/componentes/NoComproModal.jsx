"use client"

import { useState } from "react"
import { UserX } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { MOTIVOS_NO_COMPRO } from "../utilidades/pasesVenta"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { Cascaron, PieFormulario } from "./AtencionPaciente"

// "No compró": cierra el pase como descartado y guarda el motivo (descartar_pase,
// migración 0086), que luego alimenta el embudo de R40.
export default function NoComproModal({ nombrePaciente, paseId, onCancelar, onHecho }) {
  const [motivo, setMotivo] = useState("")
  const [detalle, setDetalle] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

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

  return (
    <Cascaron
      titulo="No compró"
      subtitulo={nombrePaciente}
      Icono={UserX}
      ancho="max-w-md"
      onCerrar={() => { if (!guardando) onCancelar() }}
      formulario={{ onSubmit: confirmar }}
      pie={<PieFormulario onCancelar={onCancelar} etiquetaGuardar="Guardar" guardando={guardando} nota="Se podrá volver a la lista de espera si cambia de opinión." />}
    >
      <fieldset className="space-y-2 px-5 py-4">
        <legend className="mb-1 text-sm font-semibold text-slate-700">¿Por qué?</legend>
        {MOTIVOS_NO_COMPRO.map((m) => (
          <label key={m.id} className={"flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors " + (motivo === m.id ? "border-blue-500 bg-blue-50/60 text-slate-900" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}>
            <input type="radio" name="motivo-no-compro" value={m.id} checked={motivo === m.id} onChange={() => { setMotivo(m.id); setError("") }} className="accent-blue-600" />
            {m.etiqueta}
          </label>
        ))}
        {motivo === "otro" && (
          <div>
            <label htmlFor="no-compro-detalle" className="mb-1 block text-xs font-semibold text-slate-600">Cuéntanos el motivo</label>
            <textarea id="no-compro-detalle" rows={2} maxLength={300} value={detalle} onChange={(e) => setDetalle(e.target.value)} autoFocus className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100" />
          </div>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </fieldset>
    </Cascaron>
  )
}
