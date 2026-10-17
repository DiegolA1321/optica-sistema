"use client"

import { INK } from "@/lib/tema"
import { Ayuda } from "./Sugerencia"

const TONO = { bueno: "text-emerald-700", malo: "text-red-600", neutro: "text-slate-500" }

// Un indicador: nombre, ⓘ con su definición, el número y cómo va frente al período anterior (verde = bueno, rojo = malo).
// Toda la tarjeta se pulsa y abre la lista exacta de lo que la compone. Lo que es "a hoy" lo lleva escrito y no cambia con el período.
// `aparte`: lo que no suma en el total que anuncia la fila (las canceladas), con borde punteado.
export default function TarjetaReporte({ titulo, valor, variacion, comparacion, ayuda, aHoy = false, onClick, sub, aparte = false, claseValor = "" }) {
  return (
    <div className={"relative flex min-w-0 flex-col justify-between rounded-2xl border bg-white p-3 shadow-sm transition-colors hover:border-slate-300 " + (aparte ? "border-dashed border-slate-300" : "border-slate-200/60")}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-bold uppercase leading-tight tracking-wider text-slate-500">{titulo}</span>
        <span className="relative z-10 flex shrink-0 items-center gap-1.5">
          {aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
          {ayuda && <Ayuda texto={ayuda} nombre={titulo} />}
        </span>
      </div>
      <button type="button" data-lista onClick={onClick} disabled={!onClick} aria-label={`${titulo}: ${valor}. Ver la lista`} className="mt-1.5 block w-full text-left outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:ring-2 focus-visible:after:ring-blue-500 enabled:cursor-pointer">
        <span className={"block truncate font-serif text-2xl font-semibold leading-none tabular-nums " + claseValor} style={claseValor ? undefined : { color: INK }}>{valor}</span>
        {variacion ? (
          <>
            <span className={"mt-1.5 block truncate text-xs font-semibold leading-tight " + TONO[variacion.tono]}><span aria-hidden="true">{variacion.flecha}</span> {variacion.texto}</span>
            <span className="block truncate text-xs leading-tight text-slate-500">{comparacion || " "}</span>
          </>
        ) : (
          <span className="mt-1.5 block truncate text-xs leading-tight text-slate-500">{sub || " "}</span>
        )}
      </button>
    </div>
  )
}
