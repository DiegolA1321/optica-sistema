"use client"

import { ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "./AtencionPaciente"

// Ventana de una tarjeta de Totales del Inicio (regla 43: las elecciones con contenido usan la ventana estándar del sistema).
// Ofrece las dos maneras de ver ese total: todo lo registrado o lo nuevo de este mes. Cada una lleva al módulo con el mismo número
// que se lee aquí (regla 42): el número es el de la lista que se abre, no uno distinto calculado aparte.
//
// total: { id, titulo, modulo, icono, opciones: [{ id, etiqueta, detalle, valor, onClick }] }
export default function VentanaTotal({ total, onCerrar }) {
  return (
    <Cascaron
      titulo={total.titulo}
      subtitulo="¿Qué quieres ver?"
      Icono={total.icono}
      ancho="max-w-md"
      onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">Se abre {total.modulo} con la lista que tiene ese número.</span>
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
      </>}
    >
      <ul className="divide-y divide-slate-100">
        {total.opciones.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => { onCerrar(); o.onClick() }}
              aria-label={`Abrir en ${total.modulo} · ${o.etiqueta} (${o.valor})`}
              className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold" style={{ color: INK }}>{o.etiqueta}</span>
                <span className="block text-sm text-slate-500">{o.detalle}</span>
              </span>
              <span className="font-serif text-2xl font-semibold leading-none" style={{ color: INK }}>{o.valor}</span>
              <ArrowRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Cascaron>
  )
}
