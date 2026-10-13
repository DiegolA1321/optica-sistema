"use client"

import { useEffect, useRef, useState } from "react"
import { Download, Inbox, Loader2 } from "lucide-react"
import { INK } from "@/lib/tema"
import { Ayuda } from "./Sugerencia"

// Piezas de maquetación comunes a las cinco pestañas de Reportes.
export const REJILLA_TARJETAS = "grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6"
export const REJILLA_TARJETAS_4 = "grid grid-cols-2 gap-2.5 lg:grid-cols-4"

export function Seccion({ titulo, aHoy = false, ayuda, derecha, children }) {
  return (
    <section className="space-y-2" aria-label={titulo}>
      <div className="flex min-h-7 items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{titulo}</h2>
        {aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
        {ayuda && <Ayuda texto={ayuda} nombre={titulo} />}
        {derecha && <div className="ml-auto">{derecha}</div>}
      </div>
      {children}
    </section>
  )
}

// El botón "Exportar" de un bloque: siempre en la esquina superior derecha. opciones: [{ id, etiqueta, descripcion, ejecutar }].
export function ExportarBloque({ opciones, nombre }) {
  const [abierto, setAbierto] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const raiz = useRef(null)
  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); setAbierto(false) } }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla, true)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla, true) }
  }, [abierto])
  const elegir = async (o) => { setAbierto(false); setOcupado(true); try { await o.ejecutar() } finally { setOcupado(false) } }
  return (
    <div ref={raiz} className="relative shrink-0">
      <button type="button" onClick={() => setAbierto((a) => !a)} disabled={ocupado} aria-haspopup="menu" aria-expanded={abierto} aria-label={`Exportar ${nombre}`} className="flex items-center gap-1 rounded-lg border border-slate-200/60 px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">
        {ocupado ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Download size={12} aria-hidden="true" />} Exportar
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-slate-200/60 bg-white p-1 shadow-lg">
          {opciones.map((o) => (
            <button key={o.id} type="button" role="menuitem" onClick={() => elegir(o)} className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-slate-50 cursor-pointer">
              <span className="block text-sm font-semibold text-slate-800">{o.etiqueta}</span>
              <span className="block text-xs text-slate-500">{o.descripcion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function Caja({ titulo, ayuda, aHoy = false, derecha, exportar, children, className = "" }) {
  return (
    <div className={"min-w-0 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm " + className}>
      {(titulo || derecha || exportar) && (
        <div className="mb-3 flex items-center gap-2">
          {titulo && <h3 className="text-sm font-bold" style={{ color: INK }}>{titulo}</h3>}
          {aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
          {ayuda && <Ayuda texto={ayuda} nombre={titulo} />}
          {derecha && <div className="ml-auto">{derecha}</div>}
          {exportar && <div className={derecha ? "" : "ml-auto"}><ExportarBloque opciones={exportar} nombre={titulo} /></div>}
        </div>
      )}
      {children}
    </div>
  )
}

// Una pantalla sin nada que mostrar: dice por qué y qué hacer (regla 17).
export function SinResultados({ texto, acciones = [] }) {
  return (
    <div role="status" className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center">
      <Inbox size={22} className="text-slate-400" aria-hidden="true" />
      <p className="max-w-md text-sm text-slate-600">{texto}</p>
      {acciones.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {acciones.map((a) => <button key={a.etiqueta} type="button" onClick={a.onClick} className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">{a.etiqueta}</button>)}
        </div>
      )}
    </div>
  )
}

// Un número dentro de una tabla: se pulsa y abre su lista. En cero no se pulsa (no hay nada que abrir).
export function NumeroPulsable({ valor, onClick, nombre, texto }) {
  if (!onClick || !valor) return <span className="tabular-nums text-slate-400">{texto ?? valor}</span>
  return <button type="button" data-lista onClick={onClick} aria-label={nombre} className="rounded-md px-1.5 py-0.5 font-semibold tabular-nums transition-colors hover:bg-blue-50 hover:text-blue-700 focus-visible:bg-blue-50 cursor-pointer" style={{ color: INK }}>{texto ?? valor}</button>
}

// Tabla de números sin desplazamiento horizontal: la primera columna recorta el nombre, el resto es de ancho fijo y va a la derecha.
export function TablaNumeros({ titulos, anchoNumeros = 96, children, etiqueta }) {
  return (
    <table className="w-full table-fixed text-sm" aria-label={etiqueta}>
      <colgroup><col />{titulos.slice(1).map((t) => <col key={t} style={{ width: anchoNumeros }} />)}</colgroup>
      <thead>
        <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {titulos.map((t, i) => <th key={t} scope="col" className={"truncate py-2 " + (i === 0 ? "pr-2 text-left" : "px-1 text-right")}>{t}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">{children}</tbody>
    </table>
  )
}
