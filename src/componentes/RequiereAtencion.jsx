"use client"

import { CheckCircle2 } from "lucide-react"
import { INK } from "@/lib/tema"

// Bloque único "Requiere tu atención" del Inicio: todo lo pendiente en una sola lista con un mismo estilo.
// Cada fila lleva un ícono, qué pasa y su botón de acción. Sin filas, una línea "Todo en orden".
// filas: [{ id, icono, titulo, detalle?, acciones: [{ etiqueta, onClick, principal? }] }]
export default function RequiereAtencion({ filas }) {
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
        {filas.length > 0 && <p className="text-xs text-slate-400">{filas.length} {filas.length === 1 ? "asunto pendiente" : "asuntos pendientes"}</p>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {filas.length === 0 ? (
          <p className="flex items-center gap-2.5 px-5 py-4 text-sm font-medium text-slate-600">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" /> Todo en orden: no hay nada pendiente.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filas.map((f) => {
              const Icono = f.icono
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icono size={17} aria-hidden="true" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold" style={{ color: INK }}>{f.titulo}</p>
                    {f.detalle && <p className="truncate text-xs text-slate-500">{f.detalle}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {f.acciones.map((a) => (
                      <button
                        key={a.etiqueta}
                        type="button"
                        onClick={a.onClick}
                        className={"rounded-lg px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer " + (a.principal ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}
                      >
                        {a.etiqueta}
                      </button>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
