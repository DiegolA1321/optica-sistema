"use client"

import { CheckCircle2, ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"

// "Requiere tu atención" del Inicio: una tarjeta por área (Citas, Pacientes, Ventas, Inventario), nunca todo en una sola lista (I4).
// Las tarjetas van en una cuadrícula de dos columnas y las de una misma fila tienen la misma altura. Cada una lleva su ícono, su título y
// su número (el total de avisos del área); como máximo tres avisos (I5), una línea cada uno con su número, qué pasa, los nombres resumidos y
// una sola acción; abajo, cuántos elementos más hay y "Ver todo →" hacia el módulo (sin repetir el número). Un área sin avisos dice "Todo en orden".
// bloques: [{ id, titulo, icono, filas, onVerTodo }]; filas: [{ id, cantidad, texto, nombres?, tono?: "urgente", accion?: { etiqueta, onClick } }]
export const AVISOS_POR_TARJETA = 3

export default function RequiereAtencionPorArea({ bloques }) {
  if (bloques.length === 0) return null
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:auto-rows-fr">
        {bloques.map((b) => {
          const Icono = b.icono
          const visibles = b.filas.slice(0, AVISOS_POR_TARJETA)
          const total = b.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
          const ocultos = b.filas.slice(AVISOS_POR_TARJETA).reduce((n, f) => n + (f.cantidad ?? 1), 0)
          return (
            <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              <header className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icono size={18} aria-hidden="true" /></span>
                <h3 className="text-base font-bold" style={{ color: INK }}>{b.titulo}</h3>
                {total > 0
                  ? <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-bold text-amber-700">{total}</span>
                  : <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold text-emerald-700">Todo en orden</span>}
              </header>
              {visibles.length > 0 ? (
                <ul className="flex-1 divide-y divide-slate-100">
                  {visibles.map((f) => (
                    <li key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                      <p className="min-w-0 flex-1 truncate text-sm text-slate-700">
                        <span className={"font-bold " + (f.tono === "urgente" ? "text-red-700" : "")} style={f.tono === "urgente" ? undefined : { color: INK }}>{f.cantidad ?? 1}</span> {f.texto}
                        {f.nombres && <span className="text-slate-500"> · {f.nombres}</span>}
                      </p>
                      {f.accion && (
                        <button type="button" onClick={f.accion.onClick} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                          {f.accion.etiqueta}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex flex-1 items-center gap-2 px-4 py-4 text-sm text-slate-600"><CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden="true" /> Nada pendiente en esta área.</p>
              )}
              <footer className="flex items-center border-t border-slate-100 px-4 py-2.5 text-sm">
                {ocultos > 0 && <span className="text-slate-500">{ocultos === 1 ? "1 elemento más" : `${ocultos} elementos más`}</span>}
                <button type="button" onClick={b.onVerTodo} aria-label={`Ver todo en ${b.titulo}`} className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                  Ver todo <ArrowRight size={14} aria-hidden="true" />
                </button>
              </footer>
            </section>
          )
        })}
      </div>
    </section>
  )
}
