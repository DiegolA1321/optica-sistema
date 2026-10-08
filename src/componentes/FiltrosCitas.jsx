"use client"

import { useEffect, useRef, useState } from "react"
import { Search, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { INK } from "@/lib/tema"

// Piezas de la barra de filtros de Citas. Todos los filtros comparten un mismo
// formato: un menú compacto con su nombre visible ("Estado: Todas") y, dentro,
// cuántas citas habría con cada opción dados los demás filtros.

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

const CLASE_BOTON = "inline-flex min-w-0 max-w-full items-center gap-1.5 whitespace-nowrap rounded-xl border px-2 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer "

// Menú desplegable de un filtro. `opciones`: [{ id, etiqueta, conteo }]. Lo elegido distinto de `porDefecto` se marca relleno.
export function FiltroDesplegable({ nombre, valor, onChange, opciones, porDefecto }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const actual = opciones.find((o) => o.id === valor)
  const activo = valor !== porDefecto
  return (
    <div ref={ref} className="relative min-w-0 shrink">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={`${nombre}: ${actual?.etiqueta ?? ""}`}
        title={`${nombre}: ${actual?.etiqueta ?? ""}`}
        className={CLASE_BOTON + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
        style={activo ? { backgroundColor: INK } : undefined}
      >
        <span className={"shrink-0 " + (activo ? "text-white/70" : "text-slate-500")}>{nombre}:</span>
        <span className="min-w-0 truncate font-bold">{actual?.etiqueta}</span>
        <ChevronDown size={13} className={"shrink-0 transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="menu" aria-label={nombre} className="absolute left-0 top-full z-30 mt-1.5 max-h-72 min-w-[12rem] overflow-y-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {opciones.map((o) => (
            <button
              key={o.id}
              type="button"
              role="menuitemradio"
              aria-checked={o.id === valor}
              onClick={() => { onChange(o.id); setAbierto(false) }}
              className={"flex w-full items-center justify-between gap-4 rounded-lg px-3 py-1.5 text-left text-xs font-semibold transition-colors cursor-pointer " + (o.id === valor ? "text-white" : "text-slate-700 hover:bg-slate-50")}
              style={o.id === valor ? { backgroundColor: INK } : undefined}
            >
              <span className="truncate">{o.etiqueta}</span>
              {o.conteo != null && <span className={"rounded-full px-1.5 text-[11px] font-bold tabular-nums " + (o.id === valor ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{o.conteo}</span>}
            </button>
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

// Buscador de las citas (el de la cabecera salta a pacientes y módulos).
export function BuscadorCitas({ valor, onChange }) {
  return (
    <div className="relative w-72 max-w-full">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <label htmlFor="citas-busqueda" className="sr-only">Buscar en las citas por paciente o código de cita</label>
      <input
        id="citas-busqueda"
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar en citas…"
        className="w-full rounded-xl border border-slate-200/60 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
      />
    </div>
  )
}

// Línea siempre visible bajo los filtros: cuántas citas se muestran, los filtros activos con su "x" y "Limpiar filtros".
export function ResumenCitas({ texto, vacio, etiquetas, hayFiltros, onLimpiar }) {
  return (
    <div className="flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1.5" aria-label="Resumen de la lista">
      <p role="status" className={"text-xs " + (vacio ? "font-semibold text-slate-700" : "text-slate-500")}>{texto}</p>
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
          {etiquetas.map((e) => (
            <span key={e.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
              {e.texto}
              <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 cursor-pointer">
                <X size={12} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
      {hayFiltros && (
        <button type="button" onClick={onLimpiar} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
          Limpiar filtros
        </button>
      )}
    </div>
  )
}
