"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Search, ChevronDown, X } from "lucide-react"

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Lista desplegable con buscador: se escribe para filtrar (sin importar tildes ni mayúsculas) en vez de recorrer decenas de nombres.
// options: [{ id, etiqueta, detalle? }]. `valor` es el id elegido ("" = ninguno) y onChange recibe el id.
export default function SelectorBuscable({ id, valor, onChange, options, placeholder = "Buscar…", etiquetaNinguno = "Ninguno", icono: Icono = Search }) {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState("")
  const [activo, setActivo] = useState(0)
  const ref = useRef(null)
  const elegido = options.find((o) => o.id === valor)
  const filtradas = useMemo(() => {
    const q = sinTildes(texto.trim())
    return q ? options.filter((o) => sinTildes(o.etiqueta).includes(q)) : options
  }, [options, texto])
  // La primera fila es siempre "ninguno": quitar la elección debe ser tan rápido como hacerla.
  const filas = [{ id: "", etiqueta: etiquetaNinguno }, ...filtradas]

  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) { setAbierto(false); setTexto("") } }
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [abierto])

  const elegir = (fila) => { onChange(fila.id); setAbierto(false); setTexto("") }
  const alTeclear = (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setActivo((a) => Math.min(a + 1, filas.length - 1)) }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((a) => Math.max(a - 1, 0)) }
    else if (e.key === "Enter" && abierto) { e.preventDefault(); if (filas[activo]) elegir(filas[activo]) }
    else if (e.key === "Escape" && abierto) { e.stopPropagation(); setAbierto(false); setTexto("") }
  }

  return (
    <div ref={ref} className="relative">
      <Icono className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} aria-hidden="true" />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-controls={id + "-lista"}
        aria-autocomplete="list"
        autoComplete="off"
        value={abierto ? texto : elegido ? elegido.etiqueta : ""}
        placeholder={abierto ? placeholder : etiquetaNinguno}
        onFocus={() => { setAbierto(true); setActivo(0) }}
        onChange={(e) => { setTexto(e.target.value); setAbierto(true); setActivo(1) }}
        onKeyDown={alTeclear}
        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-9 pr-16 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"
      />
      <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
        {valor && <button type="button" onClick={() => elegir({ id: "" })} aria-label="Quitar la selección" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={14} /></button>}
        <ChevronDown size={15} aria-hidden="true" className={"text-slate-400 transition-transform " + (abierto ? "rotate-180" : "")} />
      </div>
      {abierto && (
        <ul id={id + "-lista"} role="listbox" className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-slate-200/60 bg-white py-1 shadow-xl" style={{ animation: "menu-in 140ms ease-out" }}>
          {filas.map((f, i) => (
            <li
              key={f.id || "ninguno"}
              role="option"
              aria-selected={f.id === valor}
              onMouseDown={(e) => { e.preventDefault(); elegir(f) }}
              onMouseEnter={() => setActivo(i)}
              className={"cursor-pointer px-3 py-2 text-sm " + (i === activo ? "bg-blue-50 text-blue-800 " : "text-slate-700 ") + (f.id === valor ? "font-semibold" : "") + (f.id === "" ? " italic text-slate-500" : "")}
            >
              {f.etiqueta}
              {f.detalle && <span className="ml-2 text-xs text-slate-400">{f.detalle}</span>}
            </li>
          ))}
          {filtradas.length === 0 && <li className="px-3 py-3 text-center text-xs text-slate-500">Ningún paciente coincide con «{texto}».</li>}
        </ul>
      )}
    </div>
  )
}
