"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, X } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { CalendarioRango } from "../FiltrosCitas"
import FranjaDiasCelular from "./FranjaDiasCelular"

const ACTIVO = { background: GRAD_MARCA, backgroundOrigin: "border-box" }
const CHIP = "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 text-base font-semibold "
const chip = (activo) => CHIP + (activo ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-700")

// Todo lo que la computadora pone en la barra de Citas (la búsqueda, los filtros, el periodo con sus flechas y la vista) en una ventana a pantalla completa, plegada
// detrás del botón «Filtrar». Es la misma información y las mismas acciones; solo cambia dónde está.
function VentanaFiltros({ p, onCerrar }) {
  const periodoConFlechas = p.filtro !== "todas" || p.hayRango
  return (
    <Cascaron titulo="Filtrar citas" subtitulo="Busca, elige el periodo y filtra la lista." Icono={SlidersHorizontal} ancho="max-w-lg" onCerrar={onCerrar}
      pie={<>
        {p.hayAlgo ? <button type="button" onClick={p.onLimpiar} className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-slate-700"><X size={16} aria-hidden="true" /> Limpiar</button> : <span />}
        <button type="button" onClick={onCerrar} className="cursor-pointer rounded-xl px-6 text-base font-bold text-white" style={ACTIVO}>Listo</button>
      </>}>
      <div className="space-y-6 px-5 py-5">
        <div className="space-y-1.5">
          <label htmlFor="citas-busqueda-celular" className="block text-sm font-bold uppercase tracking-wide text-slate-600">Buscar</label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <input id="citas-busqueda-celular" type="text" value={p.texto} onChange={(e) => p.onTexto(e.target.value)} placeholder="Paciente o código de cita" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
          </div>
          {p.buscando && <p className="text-sm text-slate-600">Buscando en todas las fechas.</p>}
        </div>

        {!p.buscando && p.esLista && (
          <div role="group" aria-label="Periodo de las citas" className="space-y-2">
            <span className="block text-sm font-bold uppercase tracking-wide text-slate-600">Periodo</span>
            <div className="flex flex-wrap gap-2">
              {p.periodos.map((o) => {
                const activo = !p.hayRango && p.filtro === o.id
                return <button key={o.id} type="button" onClick={() => p.onPeriodo(o.id)} aria-pressed={activo} className={chip(activo)} style={activo ? ACTIVO : undefined}>{o.etiqueta}</button>
              })}
              <button type="button" onClick={() => p.onAbrirRango()} aria-pressed={p.hayRango} className={chip(p.hayRango)} style={p.hayRango ? ACTIVO : undefined}>{p.textoRango}</button>
            </div>
            {p.rangoAbierto && <CalendarioRango rango={p.rango} />}
            {periodoConFlechas && (
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                <button type="button" onClick={p.onAnterior} aria-label="Periodo anterior" className="grid cursor-pointer place-items-center rounded-xl bg-white text-slate-700"><ChevronLeft size={20} /></button>
                <span className="min-w-0 flex-1 truncate text-center text-base font-semibold" style={{ color: INK }}>{p.tituloPeriodo}</span>
                <button type="button" onClick={p.onSiguiente} aria-label="Periodo siguiente" className="grid cursor-pointer place-items-center rounded-xl bg-white text-slate-700"><ChevronRight size={20} /></button>
              </div>
            )}
          </div>
        )}

        {p.mostrarVistas && (
          <div role="group" aria-label="Vista de citas" className="space-y-2">
            <span className="block text-sm font-bold uppercase tracking-wide text-slate-600">Vista</span>
            <div className="flex flex-wrap gap-2">
              {[["lista", "Lista"], ["semana", "Semana"], ["mes", "Mes"]].map(([id, etiqueta]) => (
                <button key={id} type="button" onClick={() => p.onVista(id)} aria-pressed={p.vista === id} className={chip(p.vista === id)} style={p.vista === id ? ACTIVO : undefined}>{etiqueta}</button>
              ))}
            </div>
          </div>
        )}

        {p.secciones.map((s) => (
          <div key={s.id} role="group" aria-label={s.titulo} className="space-y-2">
            <span className="block text-sm font-bold uppercase tracking-wide text-slate-600">{s.titulo}</span>
            {s.tipo === "lista" ? (
              <select aria-label={s.titulo} value={s.valor} onChange={(e) => s.onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-800">
                {s.opciones.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}{o.conteo != null ? ` (${o.conteo})` : ""}</option>)}
              </select>
            ) : (
              <div className="flex flex-wrap gap-2">
                {s.opciones.map((o) => {
                  const activo = s.valor === o.id
                  return (
                    <button key={o.id} type="button" onClick={() => s.onChange(activo ? s.opciones[0].id : o.id)} aria-pressed={activo} className={chip(activo)} style={activo ? ACTIVO : undefined}>
                      {o.etiqueta}{o.conteo != null && <span className={"rounded-full px-1.5 text-sm font-bold " + (activo ? "bg-white/25" : "bg-slate-100 text-slate-700")}>{o.conteo}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Cascaron>
  )
}

// La barra de la Agenda en el celular: los días deslizables, el botón «Filtrar» (con sus filtros activos como etiquetas con su «x») y lo que se ve («3 citas hoy»).
// p: lo que Citas ya calculó (ver Citas.jsx): el mismo estado, los mismos filtros y los mismos números que en la computadora.
export default function BarraCitasCelular({ p, avisos = null }) {
  const [abierto, setAbierto] = useState(false)
  const [rangoAbierto, setRangoAbierto] = useState(false)
  return (
    <div className="space-y-3">
      {p.mostrarDias && <FranjaDiasCelular seleccionado={p.diaSeleccionado} hoy={p.hoy} onElegir={p.onElegirDia} />}
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog" className="flex min-h-11 cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 shadow-sm">
          <SlidersHorizontal size={18} aria-hidden="true" /> Filtrar
          {p.etiquetas.length > 0 && <span className="rounded-full px-2 text-sm font-bold text-white" style={ACTIVO}>{p.etiquetas.length}</span>}
        </button>
        {avisos}
      </div>
      {(p.etiquetas.length > 0 || p.buscando) && (
        <div className="flex flex-wrap items-center gap-2">
          {p.buscando && <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700"><Search size={14} aria-hidden="true" /> “{p.texto.trim()}” · todas las fechas<button type="button" onClick={() => p.onTexto("")} aria-label="Quitar la búsqueda" className="grid place-items-center rounded-full"><X size={14} aria-hidden="true" /></button></span>}
          {p.etiquetas.map((e) => (
            <span key={e.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700">
              <span className="truncate">{e.texto}</span>
              <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="grid place-items-center rounded-full"><X size={14} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      {abierto && <VentanaFiltros p={{ ...p, rangoAbierto, onAbrirRango: () => setRangoAbierto((v) => !v) }} onCerrar={() => { setAbierto(false); setRangoAbierto(false) }} />}
    </div>
  )
}
