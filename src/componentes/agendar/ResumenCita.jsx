import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { INK } from "@/lib/tema"

// Resumen de la cita en una tarjeta blanca a la derecha (queda fija al desplazar). En celular va arriba y plegado: una línea con lo esencial que se despliega.
// Lo que aún no se eligió dice «Por elegir» en gris.
export default function ResumenCita({ filas, color, corto = "" }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 lg:sticky lg:top-24 lg:p-6" style={{ boxShadow: "0 24px 48px -32px rgba(14,43,51,0.25)" }}>
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-controls="resumen-cita-detalle" aria-label={abierto ? "Ocultar el resumen de tu cita" : "Ver el resumen de tu cita"}
        className="flex min-h-11 w-full items-center justify-between gap-3 text-left lg:hidden"
      >
        <span className="min-w-0">
          <span className="block text-xs font-bold uppercase tracking-[0.14em]" style={{ color }}>Tu cita</span>
          <span className="block truncate text-sm font-semibold" style={{ color: INK }}>{corto || "Resumen"}</span>
        </span>
        <ChevronDown size={20} className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>

      <div id="resumen-cita-detalle" className={(abierto ? "block " : "hidden ") + "mt-3 lg:mt-0 lg:block"}>
        <div className="hidden lg:block">
          <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color }}>Tu cita</p>
          <h2 className="font-serif text-2xl font-bold" style={{ color: INK }}>Resumen</h2>
        </div>
        <dl className="lg:mt-3">
          {filas.map(({ etiqueta, valor }) => (
            <div key={etiqueta} className="flex items-baseline justify-between gap-4 border-t border-slate-100 py-3 first:border-t-0 lg:border-t">
              <dt className="shrink-0 text-sm text-slate-600">{etiqueta}</dt>
              <dd className={"min-w-0 break-words text-right text-sm " + (valor ? "font-bold" : "text-slate-500")} style={valor ? { color: INK } : undefined}>{valor || "Por elegir"}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-1 text-sm text-slate-600">Sin crear cuenta · Datos protegidos</p>
      </div>
    </div>
  )
}
