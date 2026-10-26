"use client"

import { CheckCircle2, ChevronRight } from "lucide-react"
import { INK } from "@/lib/tema"

// Las notificaciones (la campanita de la computadora) en una pantalla propia: las mismas alertas, cada una abre lo mismo que abre allí.
// alertas: [{ icon, color, bg, texto, sub, onAbrir }].
export default function NotificacionesCelular({ alertas }) {
  if (alertas.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-3xl border border-slate-200/80 bg-white px-5 py-12 text-center shadow-sm">
        <CheckCircle2 size={32} className="text-emerald-500" aria-hidden="true" />
        <p className="text-lg font-semibold" style={{ color: INK }}>Todo al día</p>
        <p className="text-base text-slate-600">No tienes notificaciones nuevas.</p>
      </div>
    )
  }
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      {alertas.map((a, i) => (
        <li key={i}>
          <button type="button" onClick={a.onAbrir} className="fila-tocable min-h-16 px-4 py-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: a.bg, color: a.color }} aria-hidden="true"><a.icon size={18} /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold leading-snug" style={{ color: INK }}>{a.texto}</span>
              {a.sub && <span className="block text-sm text-slate-600">{a.sub}</span>}
            </span>
            <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
          </button>
        </li>
      ))}
    </ul>
  )
}
