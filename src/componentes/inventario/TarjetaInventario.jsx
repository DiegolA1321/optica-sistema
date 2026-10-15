"use client"

import { INK } from "@/lib/tema"
import { Ayuda } from "../reportes/Sugerencia"

// Una tarjeta del resumen de Inventario. Todas son iguales y todas se pulsan: filtran la tabla o abren su detalle en la ventana estándar.
// La baldosa del ícono es la misma en todas (gris neutro); el color queda para un estado: ámbar cuando hay productos por agotarse.
// `activa`: la tarjeta es el filtro que está puesto (se ve en el azul de la marca). `ayuda`: el ⓘ con su definición exacta.
export default function TarjetaInventario({ icono: Icono, titulo, valor, sub, ayuda, alerta = false, activa = false, onClick }) {
  const tile = alerta ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"
  return (
    <div className={"relative flex min-w-0 items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm transition-colors hover:border-slate-300 " + (activa ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200/60")}>
      <div className={"grid h-11 w-11 shrink-0 place-items-center rounded-xl " + tile}><Icono size={20} aria-hidden="true" /></div>
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</span>
          {ayuda && <span className="relative z-10 flex shrink-0"><Ayuda texto={ayuda} nombre={titulo} /></span>}
        </div>
        <button type="button" onClick={onClick} aria-pressed={activa} aria-label={`${titulo}: ${valor}${sub ? `, ${sub}` : ""}`} className="mt-1 block w-full text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-blue-500 cursor-pointer">
          <span className="block truncate font-serif text-2xl font-semibold leading-none tabular-nums" style={{ color: INK }}>{valor}</span>
          <span className="mt-1 block truncate text-xs leading-tight text-slate-500">{sub || " "}</span>
        </button>
      </div>
    </div>
  )
}
