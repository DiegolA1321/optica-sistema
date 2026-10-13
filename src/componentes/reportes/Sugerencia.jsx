"use client"

import { useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Info } from "lucide-react"
import { INK } from "@/lib/tema"

// Un globo de texto pegado a lo que se señala con el cursor (o con el foco del teclado). Es `fixed` y se mantiene dentro de la
// pantalla: nunca agranda la página ni se corta en el borde. Sirve para el detalle de una barra, una celda o un ⓘ.
const ANCHO = 260

export default function Sugerencia({ texto, children, className = "", as: Raiz = "span", ...resto }) {
  const [pos, setPos] = useState(null)
  const ref = useRef(null)
  const abrir = () => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const w = Math.min(ANCHO, window.innerWidth - 16)
    const left = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), window.innerWidth - w - 8)
    const abajo = r.top < 90
    setPos({ left, w, top: abajo ? r.bottom + 6 : null, bottom: abajo ? null : window.innerHeight - r.top + 6 })
  }
  const cerrar = () => setPos(null)
  if (!texto) return <Raiz className={className} {...resto}>{children}</Raiz>
  return (
    <Raiz ref={ref} className={className} onMouseEnter={abrir} onMouseLeave={cerrar} onFocus={abrir} onBlur={cerrar} {...resto}>
      {children}
      {pos && createPortal(
        <div role="tooltip" className="pointer-events-none fixed z-[70] rounded-lg px-3 py-2 text-xs font-medium leading-snug text-white shadow-lg" style={{ left: pos.left, width: pos.w, top: pos.top ?? undefined, bottom: pos.bottom ?? undefined, background: INK }}>
          {texto}
        </div>,
        document.body,
      )}
    </Raiz>
  )
}

// El ⓘ de un indicador: su definición exacta y cómo se calcula.
export function Ayuda({ texto, nombre }) {
  return (
    <Sugerencia texto={texto} as="span" className="inline-flex shrink-0">
      <button type="button" aria-label={`Qué es ${nombre}: ${texto}`} className="rounded-full text-slate-400 transition-colors hover:text-slate-600 focus-visible:text-slate-600 cursor-help">
        <Info size={14} aria-hidden="true" />
      </button>
    </Sugerencia>
  )
}
