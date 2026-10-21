"use client"

import { LARGO_DETALLE_CANCELACION } from "../utilidades/motivosCancelacion"

// El motivo de una cancelación (o de un descarte, con `etiqueta`): una lista fija (para poder agrupar en los reportes) y un detalle opcional. Lo usan la óptica (Citas) y el paciente (portal, con `grande`:
// letra de 16 px y toques de 44 px, regla 48). motivos: [{ id, texto }]; el detalle va con «Otro» en primer plano pero se puede escribir con cualquiera.
export default function MotivoDeCancelacion({ motivos, motivo, detalle, onMotivo, onDetalle, grande = false, deshabilitado = false, etiqueta = "Motivo de la cancelación" }) {
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={etiqueta} className="space-y-2">
        {motivos.map((m) => {
          const activo = motivo === m.id
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={activo}
              disabled={deshabilitado}
              onClick={() => onMotivo(m.id)}
              className={"flex w-full items-center gap-3 rounded-xl border px-4 text-left font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 " + (grande ? "min-h-12 py-3 text-base " : "py-2.5 text-sm ") + (activo ? "border-blue-500 bg-blue-50 text-blue-800" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50")}
            >
              <span aria-hidden="true" className={"grid h-4 w-4 shrink-0 place-items-center rounded-full border " + (activo ? "border-blue-600" : "border-slate-300")}>{activo && <span className="h-2 w-2 rounded-full bg-blue-600" />}</span>
              {m.texto}
            </button>
          )
        })}
      </div>
      <label className="block">
        <span className={"mb-1 block font-semibold text-slate-600 " + (grande ? "text-base" : "text-xs")}>Detalle <span className="font-normal text-slate-500">(opcional)</span></span>
        <textarea
          value={detalle}
          onChange={(e) => onDetalle(e.target.value.slice(0, LARGO_DETALLE_CANCELACION))}
          rows={2}
          disabled={deshabilitado}
          maxLength={LARGO_DETALLE_CANCELACION}
          placeholder={motivo === "otro" ? "Cuéntanos qué pasó" : "Algo que quieras dejar anotado"}
          className={"w-full rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 " + (grande ? "text-base" : "text-sm")}
        />
      </label>
    </div>
  )
}
