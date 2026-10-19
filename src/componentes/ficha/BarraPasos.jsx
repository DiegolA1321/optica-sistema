"use client"

import { Check } from "lucide-react"
import { PASOS } from "../../utilidades/fichaDatos"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const TONO = { Completo: "text-emerald-600", Incompleto: "text-amber-700", Opcional: "text-slate-500", Omitido: "text-slate-500" }

// La barra de los cinco pasos: se puede ir a cualquiera (el orden es una sugerencia) y cada uno dice su estado (Completo, Incompleto, Opcional u Omitido). Los nombres caben en una sola línea.
export default function BarraPasos({ paso, estados, onIr }) {
  return (
    <nav aria-label="Pasos de la ficha clínica" className="flex gap-1 rounded-2xl border border-slate-200/70 bg-white p-1.5 shadow-sm">
      {PASOS.map((p) => {
        const activo = paso === p.id
        const estado = estados[p.id]
        return (
          <button key={p.id} type="button" onClick={() => onIr(p.id)} aria-current={activo ? "step" : undefined} aria-label={`Paso ${p.n}: ${p.label}, ${estado}`}
            className={"flex flex-auto items-center justify-center gap-1.5 rounded-xl px-1.5 py-1.5 text-left transition-colors cursor-pointer " + (activo ? "text-white" : "hover:bg-slate-50")} style={activo ? { background: GRAD } : undefined}>
            <span className={"grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold " + (activo ? "bg-white/25 text-white" : estado === "Completo" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600")}>
              {!activo && estado === "Completo" ? <Check size={13} aria-hidden="true" /> : p.n}
            </span>
            <span className="min-w-0">
              <span className={"block whitespace-nowrap text-[13px] font-semibold leading-tight " + (activo ? "text-white" : "text-slate-800")}>{p.label}</span>
              <span className={"block text-xs leading-tight " + (activo ? "text-white" : TONO[estado])}>{estado}</span>
            </span>
          </button>
        )
      })}
    </nav>
  )
}
