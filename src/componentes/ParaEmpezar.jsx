import React from "react"
import { Clock, UserPlus, Users, Package, ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"

// Óptica recién creada (sin pacientes, citas ni productos): en lugar de cuatro tarjetas "Todo en orden" que no guían,
// el administrador ve por dónde empezar. Cada paso lleva a la pantalla donde se hace (regla 17).
// pasos: [{ id, titulo, texto, icono, onClick }]
export default function ParaEmpezar({ pasos = [] }) {
  if (pasos.length === 0) return null
  return (
    <section aria-labelledby="para-empezar" className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <h2 id="para-empezar" className="text-xs font-bold uppercase tracking-wide text-slate-500">Para empezar</h2>
      <p className="mt-1 text-sm text-slate-500">Tu óptica está recién creada. Estos cuatro pasos la dejan lista para atender.</p>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pasos.map((p, i) => {
          const Icono = p.icono
          return (
            <li key={p.id}>
              <button type="button" onClick={p.onClick} className="flex w-full items-center gap-3 rounded-xl border border-slate-200/60 p-3.5 text-left transition-colors hover:border-blue-200 hover:bg-blue-50/40 cursor-pointer">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icono size={18} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold" style={{ color: INK }}>{i + 1}. {p.titulo}</span>
                  <span className="block text-sm text-slate-500">{p.texto}</span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

