"use client"

import { CheckCircle2, ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"

// "Requiere tu atención" del Inicio, separado por área (Citas, Pacientes, Ventas, Inventario): un bloque por área, todos con el mismo estilo,
// cada uno con sus tres avisos más importantes y "Ver todo (N)" hacia la vista del módulo. Un bloque sin avisos dice "Todo en orden".
// bloques: [{ id, titulo, icono, filas, onVerTodo }]; filas: [{ id, icono, titulo, detalle?, cantidad?, acciones }]. N suma la cantidad de cada aviso (1 por defecto).
export const AVISOS_POR_BLOQUE = 3

export default function RequiereAtencionPorArea({ bloques }) {
  if (bloques.length === 0) return null
  const cantidadDe = (b) => b.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
  const total = bloques.reduce((n, b) => n + cantidadDe(b), 0)
  // Los bloques con avisos van en columnas (cada uno con su alto, sin huecos); los que no tienen nada, en una franja de una línea.
  const conAvisos = bloques.filter((b) => b.filas.length > 0)
  const enOrden = bloques.filter((b) => b.filas.length === 0)
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
        {total === 0 && <p className="text-xs text-slate-400">Todo en orden</p>}
      </div>
      {conAvisos.length > 0 && (
        <div className="gap-3 md:columns-2 [&>*]:mb-3 [&>*]:break-inside-avoid">
          {conAvisos.map((b) => {
            const IconoBloque = b.icono
            const cantidad = cantidadDe(b)
            return (
              <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <header className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><IconoBloque size={16} aria-hidden="true" /></span>
                  <h3 className="text-sm font-bold" style={{ color: INK }}>{b.titulo}</h3>
                  <span className="ml-auto rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{cantidad}</span>
                </header>
                <ul className="divide-y divide-slate-100">
                  {b.filas.slice(0, AVISOS_POR_BLOQUE).map((f) => {
                    const Icono = f.icono
                    return (
                      <li key={f.id} className="flex items-start gap-3 px-4 py-3">
                        <span className="mt-0.5 shrink-0 text-slate-400"><Icono size={16} aria-hidden="true" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold" style={{ color: INK }}>{f.titulo}</p>
                          {f.detalle && <p className="truncate text-xs text-slate-500">{f.detalle}</p>}
                          {f.acciones?.length > 0 && (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {f.acciones.map((a) => (
                                <button key={a.etiqueta} type="button" onClick={a.onClick} className={"rounded-lg px-2.5 py-1 text-xs font-bold transition-colors cursor-pointer " + (a.principal ? "bg-blue-600 text-white hover:bg-blue-700" : "border border-slate-200/60 bg-white text-slate-700 hover:bg-slate-50")}>{a.etiqueta}</button>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <button type="button" onClick={b.onVerTodo} className="flex items-center gap-1 border-t border-slate-100 px-4 py-2.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 hover:underline cursor-pointer">
                  Ver todo ({cantidad}) <ArrowRight size={13} aria-hidden="true" />
                </button>
              </section>
            )
          })}
        </div>
      )}
      {enOrden.length > 0 && (
        <ul aria-label="Áreas sin avisos" className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm">
          {enOrden.map((b) => {
            const IconoBloque = b.icono
            return (
              <li key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className="flex items-center gap-1.5 text-sm font-medium text-slate-500">
                <CheckCircle2 size={15} className="shrink-0 text-emerald-600" aria-hidden="true" />
                <IconoBloque size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                <span className="font-semibold text-slate-700">{b.titulo}</span> · todo en orden
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
