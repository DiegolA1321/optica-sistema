"use client"

import { useLayoutEffect, useRef } from "react"
import { MAX_PLANTILLA, variablesDe, insertarEnCursor } from "../../utilidades/crmContactos"

const CAMPO = "w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50 read-only:text-slate-600"

// El texto de un mensaje con sus variables: al pulsar una, se inserta donde está el cursor (no al final) y el cursor queda después de ella.
export default function EditorMensaje({ id, valor, onCambio, filas = 3, soloLectura = false, ayudaId, motivo }) {
  const ref = useRef(null)
  const cursor = useRef(null)

  useLayoutEffect(() => {
    if (cursor.current === null || !ref.current) return
    const c = cursor.current
    cursor.current = null
    ref.current.focus()
    ref.current.setSelectionRange(c, c)
  })

  const agregar = (variable) => {
    const t = ref.current
    const r = insertarEnCursor(valor, variable, t?.selectionStart, t?.selectionEnd)
    cursor.current = r.cursor
    onCambio(r.texto)
  }

  return (
    <div className="space-y-1.5">
      <textarea ref={ref} id={id} rows={filas} value={valor} readOnly={soloLectura} aria-describedby={ayudaId} onChange={(e) => onCambio(e.target.value)} className={CAMPO} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Insertar:</span>
          {variablesDe(motivo).map((v) => (
            <button key={v.id} type="button" disabled={soloLectura} title={v.ayuda} aria-label={`Insertar ${v.id}: ${v.ayuda}`}
              onMouseDown={(e) => e.preventDefault()} onClick={() => agregar(v.id)}
              className="rounded-md border border-slate-200/60 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 cursor-pointer">{v.id}</button>
          ))}
        </div>
        <span id={ayudaId} className={"text-xs " + (valor.length > MAX_PLANTILLA ? "font-semibold text-red-600" : "text-slate-500")}>{valor.length} / {MAX_PLANTILLA}</span>
      </div>
    </div>
  )
}
