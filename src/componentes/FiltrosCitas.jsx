"use client"

import { useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { INK } from "@/lib/tema"

// Piezas de la barra de Citas: la barra única de búsqueda y filtros, el periodo de la Lista y el conteo.

// Cierra un popover con Escape o al hacer clic fuera.
function useCierre(abierto, cerrar) {
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) cerrar() }
    const tecla = (e) => { if (e.key === "Escape") cerrar() }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto, cerrar])
  return ref
}

// Barra única de búsqueda y filtros: "Filtrar" abre un panel con todas las categorías a la vista (cada opción con
// cuántas citas habría dados los demás filtros), los filtros elegidos quedan como etiquetas con su "x" dentro de la
// barra, y el campo de búsqueda ocupa el resto. "Limpiar" quita etiquetas y búsqueda.
// secciones: [{ id, titulo, valor, onChange, opciones: [{ id, etiqueta, conteo }], tipo?: "chips" | "lista" }]
export function BarraBusquedaFiltros({ texto, onTexto, secciones, etiquetas, onLimpiar }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const hayAlgo = etiquetas.length > 0 || texto.trim() !== ""
  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <div className="flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-1.5 py-1 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          aria-haspopup="dialog"
          aria-expanded={abierto}
          aria-controls="citas-filtrar-panel"
          className={"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (abierto ? "border-slate-400 bg-slate-50 text-slate-800" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
        >
          <SlidersHorizontal size={14} aria-hidden="true" /> Filtrar
          {etiquetas.length > 0 && <span className="rounded-full px-1.5 text-[11px] font-bold text-white" style={{ backgroundColor: INK }}>{etiquetas.length}</span>}
          <ChevronDown size={13} className={"transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
        </button>
        {etiquetas.map((e) => (
          <span key={e.id} className="inline-flex max-w-full shrink-0 items-center gap-1 rounded-full border border-slate-200/60 bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
            <span className="truncate">{e.texto}</span>
            <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 cursor-pointer">
              <X size={12} aria-hidden="true" />
            </button>
          </span>
        ))}
        <div className="relative min-w-[12rem] flex-1">
          <Search size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor="citas-busqueda" className="sr-only">Buscar cita: paciente o código</label>
          <input
            id="citas-busqueda"
            type="text"
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            placeholder="Buscar cita: paciente o código"
            className="w-full bg-transparent py-1.5 pl-8 pr-2 text-xs font-medium text-slate-800 outline-none"
          />
        </div>
        {hayAlgo && (
          <button type="button" onClick={onLimpiar} className="mr-1 inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
            <X size={12} aria-hidden="true" /> Limpiar
          </button>
        )}
      </div>
      {abierto && (
        <div id="citas-filtrar-panel" role="dialog" aria-label="Filtrar citas" className="absolute left-0 top-full z-30 mt-1.5 w-[24rem] max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {secciones.map((s) => (
            <div key={s.id} role="group" aria-label={s.titulo} className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{s.titulo}</span>
              {s.tipo === "lista" ? (
                <select
                  aria-label={s.titulo}
                  value={s.valor}
                  onChange={(e) => s.onChange(e.target.value)}
                  className={"w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-100 " + (s.valor === s.opciones[0].id ? "border-slate-200/60 bg-white text-slate-600" : "border-transparent text-white")}
                  style={s.valor === s.opciones[0].id ? undefined : { backgroundColor: INK }}
                >
                  {s.opciones.map((o) => <option key={o.id} value={o.id} className="text-slate-800">{o.etiqueta}{o.conteo != null ? ` (${o.conteo})` : ""}</option>)}
                </select>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5">
                  {s.opciones.map((o) => {
                    const activo = s.valor === o.id
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => s.onChange(o.id)}
                        aria-pressed={activo}
                        className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}
                        style={activo ? { backgroundColor: INK } : undefined}
                      >
                        {o.etiqueta}
                        {o.conteo != null && <span className={"rounded-full px-1.5 text-[11px] font-bold tabular-nums " + (activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{o.conteo}</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Periodo de la Lista: Hoy · Próximas · Todas · Rango… (el rango pide dos fechas en un popover).
export function PeriodoLista({ valor, onChange, opciones, rango }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const hayRango = Boolean(rango.desde || rango.hasta)
  const corta = (iso) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "…")
  return (
    <div ref={ref} role="group" aria-label="Periodo de las citas" className="relative flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
      {opciones.map((o) => {
        const activo = !hayRango && valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => { setAbierto(false); onChange(o.id) }}
            aria-pressed={activo}
            className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-600 hover:bg-slate-50")}
            style={activo ? { backgroundColor: INK } : undefined}
          >
            {o.etiqueta}
            {o.conteo != null && <span className={"rounded-full px-1 text-[11px] font-bold tabular-nums " + (activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{o.conteo}</span>}
          </button>
        )
      })}
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-pressed={hayRango}
        className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (hayRango ? "text-white" : "text-slate-600 hover:bg-slate-50")}
        style={hayRango ? { backgroundColor: INK } : undefined}
      >
        {hayRango ? `${corta(rango.desde)} – ${corta(rango.hasta)}` : "Rango…"}
        {hayRango && rango.conteo != null && <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-bold tabular-nums text-white">{rango.conteo}</span>}
      </button>
      {abierto && (
        <div className="absolute right-0 top-full z-30 mt-1.5 space-y-2 rounded-2xl border border-slate-200/60 bg-white p-3 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Rango de fechas</span>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1">
            <button type="button" onClick={() => rango.onMover(-1)} aria-label="Rango anterior" title="Rango anterior" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronLeft size={15} /></button>
            <label htmlFor="rango-desde" className="sr-only">Desde</label>
            <input id="rango-desde" type="date" value={rango.desde} onChange={(e) => rango.onDesde(e.target.value)} max={rango.hasta || undefined} className="w-[7.4rem] rounded-lg bg-transparent px-1 py-1 text-xs font-semibold text-slate-600 outline-none" />
            <span className="text-xs text-slate-400">–</span>
            <label htmlFor="rango-hasta" className="sr-only">Hasta</label>
            <input id="rango-hasta" type="date" value={rango.hasta} onChange={(e) => rango.onHasta(e.target.value)} min={rango.desde || undefined} className="w-[7.4rem] rounded-lg bg-transparent px-1 py-1 text-xs font-semibold text-slate-600 outline-none" />
            <button type="button" onClick={() => rango.onMover(1)} aria-label="Rango siguiente" title="Rango siguiente" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronRight size={15} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

// Cuántas citas se ven ("Mostrando 4 de 9 citas") y, si ninguna coincide, el aviso con su botón para limpiar.
export function ConteoCitas({ texto, vacio, onLimpiar }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <p role="status" className={"text-xs " + (vacio ? "font-semibold text-slate-700" : "text-slate-500")}>{texto}</p>
      {vacio && onLimpiar && (
        <button type="button" onClick={onLimpiar} className="rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
