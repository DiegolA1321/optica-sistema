"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Check } from "lucide-react"

// Lista desplegable del sistema para elegir UNA opción de pocas (sin buscador): reemplaza la lista nativa del navegador, que en el celular se ve
// distinta en cada aparato. La lista se abre como un menú flotante encima de lo que sigue (no empuja el contenido ni obliga a desplazarse); si tiene muchas opciones, se desplaza por dentro.
// options: string[] | [{ id, etiqueta }]. `valor` es el id elegido y onChange recibe el id. Se maneja con el teclado (flechas, Enter, Escape).
export default function SelectorLista({ id, valor, onChange, options, etiqueta, placeholder = "Elige una opción", requerido = false, className = "" }) {
  const filas = options.map((o) => (typeof o === "string" ? { id: o, etiqueta: o } : o))
  const [abierto, setAbierto] = useState(false)
  const [activo, setActivo] = useState(0)
  const ref = useRef(null)
  const elegido = filas.find((f) => f.id === valor)

  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [abierto])

  const abrir = () => { setActivo(Math.max(0, filas.findIndex((f) => f.id === valor))); setAbierto(true) }
  const elegir = (fila) => { onChange(fila.id); setAbierto(false) }
  const alTeclear = (e) => {
    if (e.key === "Escape" && abierto) { e.preventDefault(); e.stopPropagation(); setAbierto(false); return }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!abierto) { abrir(); return }
      setActivo((a) => (a + (e.key === "ArrowDown" ? 1 : filas.length - 1)) % filas.length)
    } else if ((e.key === "Enter" || e.key === " ") && abierto) {
      e.preventDefault()
      if (filas[activo]) elegir(filas[activo])
    }
  }

  return (
    <div ref={ref} className={"relative " + className}>
      <button
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={abierto}
        aria-controls={id ? id + "-lista" : undefined}
        aria-required={requerido || undefined}
        aria-label={etiqueta ? undefined : placeholder}
        onClick={() => (abierto ? setAbierto(false) : abrir())}
        onKeyDown={alTeclear}
        className={"flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left text-base font-medium outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-100 cursor-pointer " + (abierto ? "border-blue-500 bg-white" : "border-slate-200/60") + (elegido ? " text-slate-800" : " text-slate-500")}
      >
        <span className="min-w-0 flex-1 truncate">{elegido ? elegido.etiqueta : placeholder}</span>
        <ChevronDown size={20} aria-hidden="true" className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "rotate-180" : "")} />
      </button>
      {abierto && (
        <ul id={id ? id + "-lista" : undefined} role="listbox" aria-label={etiqueta || placeholder} className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {filas.map((f, i) => {
            const marcado = f.id === valor
            return (
              <li key={f.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={marcado}
                  tabIndex={-1}
                  onClick={() => elegir(f)}
                  onMouseEnter={() => setActivo(i)}
                  className={"flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-base transition-colors cursor-pointer " + (i === activo ? "bg-blue-50 " : "") + (marcado ? "font-semibold text-blue-700" : "text-slate-700")}
                >
                  <span className="min-w-0 flex-1">{f.etiqueta}</span>
                  {marcado && <Check size={18} aria-hidden="true" className="shrink-0 text-blue-600" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
