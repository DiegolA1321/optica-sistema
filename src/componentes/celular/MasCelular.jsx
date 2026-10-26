"use client"

import { ChevronRight } from "lucide-react"
import { INK } from "@/lib/tema"

// «Más»: lo que no cabe en la barra de abajo. Arriba, lo que sí se usa desde el celular (Notificaciones, Mi horario, Mi cuenta); debajo, «Solo en computadora»
// (tocar uno muestra el aviso «Este módulo se usa desde la computadora» dentro del sistema) y, al final, «Cerrar sesión».
// Cada persona ve solo lo que ya puede usar: la lista de módulos ya llega filtrada por sus permisos.
// filas / filasComputadora: [{ id, nombre, cuenta?, onClick }]; vistas: [{ id, nombre }] (solo si la persona tiene más de una vista), vista: la activa.
const Fila = ({ fila, apagada = false }) => (
  <li>
    <button type="button" onClick={fila.onClick} className="fila-tocable min-h-14 px-4 py-3 text-lg">
      <span className={"min-w-0 flex-1 truncate " + (apagada ? "text-slate-500" : "")} style={apagada ? undefined : { color: INK }}>{fila.nombre}</span>
      {fila.cuenta > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-sm font-bold text-amber-800">{fila.cuenta}</span>}
      {apagada ? <span className="shrink-0 text-base text-slate-500">Computadora</span> : <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />}
    </button>
  </li>
)

export default function MasCelular({ filas, filasComputadora, vistas = [], vista = null, onCambiarVista, onCerrarSesion }) {
  return (
    <div className="space-y-5">
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        {filas.map((f) => <Fila key={f.id} fila={f} />)}
      </ul>

      {vistas.length > 1 && (
        <section aria-label="Vista" className="space-y-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-600">Vista</h2>
          <div role="group" aria-label="Vista" className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            {vistas.map((v) => (
              <button key={v.id} type="button" role="menuitemradio" aria-checked={vista?.id === v.id} onClick={() => onCambiarVista?.(v.id)} className="fila-tocable min-h-14 px-4 py-3 text-lg">
                <span className={"grid h-5 w-5 shrink-0 place-items-center rounded-full border " + (vista?.id === v.id ? "border-blue-600 bg-blue-600" : "border-slate-300")} aria-hidden="true">{vista?.id === v.id && <span className="h-2 w-2 rounded-full bg-white" />}</span>
                <span className="min-w-0 flex-1 truncate font-semibold" style={{ color: INK }}>{v.nombre}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {filasComputadora.length > 0 && (
        <section aria-label="Solo en computadora" className="space-y-2">
          <h2 className="px-1 text-sm font-bold uppercase tracking-wide text-slate-600">Solo en computadora</h2>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
            {filasComputadora.map((f) => <Fila key={f.id} fila={f} apagada />)}
          </ul>
        </section>
      )}

      <button type="button" onClick={onCerrarSesion} className="mx-auto flex min-h-12 w-full cursor-pointer items-center justify-center rounded-2xl text-lg font-semibold text-red-700">
        Cerrar sesión
      </button>
    </div>
  )
}
