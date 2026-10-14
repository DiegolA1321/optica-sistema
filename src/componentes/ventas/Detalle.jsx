"use client"

import { INK } from "@/lib/tema"

// Piezas de las ventanas de detalle de Ventas (regla 4): los datos se agrupan por la pregunta que responden, en columnas con título, y
// cada dato lleva su etiqueta arriba. Mismo estilo que el detalle de una cita.

export function Columna({ titulo, children }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      <dl>{children}</dl>
    </section>
  )
}

export function Dato({ etiqueta, children, vacio = false }) {
  return (
    <div className="mt-3 min-w-0 first:mt-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className={"mt-0.5 break-words text-sm " + (vacio ? "text-slate-400" : "font-semibold")} style={vacio ? undefined : { color: INK }}>{children}</dd>
    </div>
  )
}

// Un bloque con título dentro de la ventana (las líneas, los abonos, las órdenes…).
export function Bloque({ titulo, derecha = null, children }) {
  return (
    <section className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-3 border-b border-slate-200/60 pb-1.5">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
        {derecha}
      </div>
      {children}
    </section>
  )
}
