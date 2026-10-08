"use client"

import { useEffect, useRef, useState } from "react"
import { Search, SlidersHorizontal, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { INK } from "@/lib/tema"
import { ORIGENES_FILTRO, SEGUIMIENTO_FILTRO } from "../utilidades/filtrosCitas"

// Piezas del bloque de filtros de Citas (R3-R5). Lo que se usa siempre queda a
// la vista (buscador y estado); lo demás vive dentro del botón "Filtros".

// Chip de filtro: seleccionado = relleno oscuro (el color queda para los estados).
// "grande" es el de los indicadores de arriba; el normal, el de los filtros.
export function ChipFiltro({ activo, onClick, conteo, grande = false, titulo, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={titulo}
      className={
        "inline-flex items-center gap-2 rounded-full border font-semibold transition-colors cursor-pointer " +
        (grande ? "px-4 py-2 text-sm " : "px-3 py-1.5 text-xs ") +
        (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")
      }
      style={activo ? { backgroundColor: INK } : undefined}
    >
      {children}
      {conteo != null && (
        <span className={"rounded-full px-1.5 text-xs font-bold tabular-nums " + (activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{conteo}</span>
      )}
    </button>
  )
}

function GrupoFiltro({ etiqueta, children }) {
  return (
    <div role="group" aria-label={etiqueta} className="space-y-1.5">
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</span>
      <div className="flex flex-wrap items-center gap-1.5">{children}</div>
    </div>
  )
}

// Todos, nadie, o una persona del equipo (solo el administrador lo ve).
function SelectorResponsable({ etiqueta, valor, onChange, equipo }) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className={"w-full rounded-lg border px-2.5 py-1.5 text-xs font-semibold outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-100 " + (valor === "todos" ? "border-slate-200/60 bg-white text-slate-600" : "border-transparent text-white")}
      style={valor === "todos" ? undefined : { backgroundColor: INK }}
    >
      <option value="todos">Todos</option>
      <option value="ninguno">Nadie</option>
      {equipo.map((m) => (
        <option key={m.id} value={m.id}>{m.nombre}</option>
      ))}
    </select>
  )
}

// Buscador: siempre visible.
export function BuscadorCitas({ valor, onChange }) {
  return (
    <div className="relative min-w-[7rem] max-w-[17rem] flex-1">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <label htmlFor="citas-busqueda" className="sr-only">Buscar paciente o código de cita</label>
      <input
        id="citas-busqueda"
        type="text"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Buscar paciente..."
        className="w-full rounded-xl border border-slate-200/60 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 shadow-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
      />
    </div>
  )
}

// Opciones desplegadas en un solo grupo (periodo de la Lista, estado de la
// cita): todas a la vista, con su contador, sin abrir nada. La elegida va rellena.
export function GrupoOpciones({ etiqueta, valor, onChange, opciones, conteos, verConteos = true }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
      {opciones.map((o) => {
        const activo = valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            title={!verConteos && conteos?.[o.id] != null ? `${o.etiqueta}: ${conteos[o.id]}` : undefined}
            className={"inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-600 hover:bg-slate-50")}
            style={activo ? { backgroundColor: INK } : undefined}
          >
            {o.etiqueta}
            {verConteos && conteos?.[o.id] != null && (
              <span className={"rounded-full px-1.5 text-[11px] font-bold tabular-nums " + (activo ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600")}>{conteos[o.id]}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Botón "Más filtros" con el contador y, debajo, el panel con lo menos usado:
// origen, visita y (solo administrador) los responsables. Se cierra con
// Escape o al hacer clic fuera.
export function BotonFiltros({ cantidad, origen, onOrigen, seguimiento, onSeguimiento, esAdmin, equipo, asignado, onAsignado, atendido, onAtendido, rango }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!abierto) return
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === "Escape") setAbierto(false) }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla) }
  }, [abierto])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-controls="citas-filtros-panel"
        className={"inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 py-2 text-xs font-semibold shadow-sm transition-colors cursor-pointer " + (abierto ? "border-slate-400 bg-slate-50 text-slate-800" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
      >
        <SlidersHorizontal size={14} aria-hidden="true" /> Más filtros
        {cantidad > 0 && <span className="rounded-full px-1.5 text-xs font-bold text-white" style={{ backgroundColor: INK }}>{cantidad}</span>}
        <ChevronDown size={14} className={"transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div id="citas-filtros-panel" className="absolute right-0 top-full z-30 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {rango && (
            <GrupoFiltro etiqueta="Rango de fechas">
              <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1">
                <button type="button" onClick={() => rango.onMover(-1)} aria-label="Semana anterior" title="Semana anterior" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronLeft size={15} /></button>
                <label htmlFor="rango-desde" className="sr-only">Desde</label>
                <input id="rango-desde" type="date" value={rango.desde} onChange={(e) => rango.onDesde(e.target.value)} max={rango.hasta || undefined} className="w-[7.4rem] rounded-lg bg-transparent px-1 py-1 text-xs font-semibold text-slate-600 outline-none" />
                <span className="text-xs text-slate-400">–</span>
                <label htmlFor="rango-hasta" className="sr-only">Hasta</label>
                <input id="rango-hasta" type="date" value={rango.hasta} onChange={(e) => rango.onHasta(e.target.value)} min={rango.desde || undefined} className="w-[7.4rem] rounded-lg bg-transparent px-1 py-1 text-xs font-semibold text-slate-600 outline-none" />
                <button type="button" onClick={() => rango.onMover(1)} aria-label="Semana siguiente" title="Semana siguiente" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronRight size={15} /></button>
              </div>
            </GrupoFiltro>
          )}
          <GrupoFiltro etiqueta="Origen">
            {ORIGENES_FILTRO.map((o) => (
              <ChipFiltro key={o.id} activo={origen === o.id} onClick={() => onOrigen(o.id)}>{o.etiqueta}</ChipFiltro>
            ))}
          </GrupoFiltro>
          <GrupoFiltro etiqueta="Visita">
            {SEGUIMIENTO_FILTRO.map((o) => (
              <ChipFiltro key={o.id} activo={seguimiento === o.id} titulo={o.id === "primera" ? "El paciente no tenía atenciones anteriores" : undefined} onClick={() => onSeguimiento(o.id)}>{o.etiqueta}</ChipFiltro>
            ))}
          </GrupoFiltro>
          {esAdmin && (
            <div className="grid grid-cols-2 gap-3">
              <GrupoFiltro etiqueta="Asignada a"><SelectorResponsable etiqueta="Asignada a" valor={asignado} onChange={onAsignado} equipo={equipo} /></GrupoFiltro>
              <GrupoFiltro etiqueta="Atendida por"><SelectorResponsable etiqueta="Atendida por" valor={atendido} onChange={onAtendido} equipo={equipo} /></GrupoFiltro>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Filtros activos como etiquetas pequeñas con su "x", y "Limpiar filtros".
export function EtiquetasActivas({ etiquetas, hayAlgo, onLimpiar }) {
  if (!hayAlgo) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5" aria-label="Filtros activos">
      {etiquetas.map((e) => (
        <span key={e.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200/60 bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-slate-700">
          {e.texto}
          <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="rounded-full p-0.5 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-800 cursor-pointer">
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      <button type="button" onClick={onLimpiar} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
        Limpiar filtros
      </button>
    </div>
  )
}
