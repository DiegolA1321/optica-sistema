"use client"

import { CheckCircle2, ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"

// "Requiere tu atención" del Inicio, compacto: un solo cuadro con un subtítulo por área (Citas, Pacientes, Ventas, Inventario) y una línea por
// tipo de aviso: el número, qué pasa, los nombres resumidos y una sola acción. El total se escribe una vez, en el título; cada área
// conserva su enlace "Ver todo →" hacia su módulo, sin repetir el número. Las áreas sin avisos se resumen en una línea de "todo en orden".
// bloques: [{ id, titulo, icono, filas, onVerTodo }]; filas: [{ id, cantidad, texto, nombres?, tono?: "urgente" | "normal" | "suave", accion?: { etiqueta, onClick } }]
const PUNTO = { urgente: "bg-red-500", normal: "bg-amber-500", suave: "bg-slate-300" }

export default function RequiereAtencionPorArea({ bloques }) {
  if (bloques.length === 0) return null
  const cantidadDe = (b) => b.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
  const total = bloques.reduce((n, b) => n + cantidadDe(b), 0)
  const conAvisos = bloques.filter((b) => b.filas.length > 0)
  const enOrden = bloques.filter((b) => b.filas.length === 0)
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
        {total > 0 ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">{total}</span> : <p className="text-xs text-slate-500">Todo en orden</p>}
      </div>
      <div className="rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {conAvisos.map((b, i) => {
          const IconoBloque = b.icono
          return (
            <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className={i > 0 ? "border-t border-slate-100" : ""}>
              <header className="flex items-center gap-2 px-4 pb-0.5 pt-2">
                <IconoBloque size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{b.titulo}</h3>
                <button type="button" onClick={b.onVerTodo} aria-label={`Ver todo en ${b.titulo}`} className="ml-auto flex items-center gap-1 text-[11px] font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                  Ver todo <ArrowRight size={12} aria-hidden="true" />
                </button>
              </header>
              <ul className="px-4 pb-1.5">
                {b.filas.map((f) => (
                  <li key={f.id} className="flex items-center gap-2.5 py-1">
                    <span className={"h-2 w-2 shrink-0 rounded-full " + (PUNTO[f.tono || "normal"])} aria-hidden="true" />
                    <p className="min-w-0 flex-1 truncate text-[13px] text-slate-700">
                      <span className="font-bold" style={{ color: INK }}>{f.cantidad ?? 1}</span> {f.texto}
                      {f.nombres && <span className="text-slate-500"> · {f.nombres}</span>}
                    </p>
                    {f.accion && (
                      <button type="button" onClick={f.accion.onClick} className="shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                        {f.accion.etiqueta}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
        {enOrden.length > 0 && (
          <p aria-label="Áreas sin avisos" className={"flex flex-wrap items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-slate-500 " + (conAvisos.length > 0 ? "border-t border-slate-100" : "")}>
            <CheckCircle2 size={14} className="shrink-0 text-emerald-600" aria-hidden="true" />
            <span className="font-semibold text-slate-700">{enOrden.map((b) => b.titulo).join(", ")}</span> · todo en orden
          </p>
        )}
      </div>
    </section>
  )
}
