"use client"

import { Eye } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { valorD } from "../../utilidades/portalVistas"

// La graduación vigente en pequeño, a la derecha del nombre en la cabecera del perfil del paciente (se ve desde todas las pestañas): los dos ojos con su esfera. Al pulsarla abre la pestaña
// «Graduación». Solo para quien tiene permiso de Ficha clínica «ver» (el perfil decide si la dibuja). Sin esfera en un ojo dice «Sin registrar».
export default function GraduacionDeCabecera({ receta, onAbrir }) {
  if (!receta) return null
  const ojo = (sigla, o = {}, color) => (
    <span className="flex items-baseline gap-1.5">
      <span className="text-xs font-bold" style={{ color }}>{sigla}</span>
      {valorD(o.esfera) ? <span className="text-lg font-bold tabular-nums text-slate-900">{valorD(o.esfera)}</span> : <span className="text-xs text-slate-400">Sin registrar</span>}
    </span>
  )
  return (
    <button type="button" onClick={onAbrir} aria-label={`Graduación vigente del ${formatoFecha(receta.fecha, "medio")}: ojo derecho ${valorD(receta.od?.esfera) || "sin registrar"}, ojo izquierdo ${valorD(receta.oi?.esfera) || "sin registrar"}. Abrir la pestaña Graduación`}
      className="group flex shrink-0 items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/50 cursor-pointer">
      <Eye size={18} className="text-blue-600" aria-hidden="true" />
      <span className="block">
        <span className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Graduación vigente</span>
        <span className="mt-0.5 flex items-center gap-4">{ojo("OD", receta.od, "#1d4ed8")}{ojo("OI", receta.oi, "#0891b2")}</span>
      </span>
    </button>
  )
}
