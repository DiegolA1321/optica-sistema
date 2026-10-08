"use client"

import { useEffect, useRef, useState } from "react"
import { Search, ChevronLeft, ChevronRight, X, CalendarRange } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaAISO, hoyISO, isoAFechaLocal } from "../utilidades/disponibilidad"

// Piezas de la barra de Citas: el buscador, el bloque de filtros siempre visible, el periodo de la Lista (con su botón
// "Rango…"), las flechas del periodo y el conteo.

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

// Buscador de citas: su "x" borra solo el texto (los filtros se limpian aparte, en "Limpiar filtros").
export function BuscadorCitas({ texto, onTexto }) {
  return (
    <div className="relative min-w-0 flex-1">
      <div className="flex h-[38px] items-center rounded-xl border border-slate-200/60 bg-white px-3 shadow-sm transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <Search size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
        <label htmlFor="citas-busqueda" className="sr-only">Buscar cita: paciente o código</label>
        <input
          id="citas-busqueda"
          type="text"
          value={texto}
          onChange={(e) => onTexto(e.target.value)}
          placeholder="Buscar cita: paciente o código"
          className="min-w-0 flex-1 bg-transparent px-2 py-1.5 text-xs font-medium text-slate-800 outline-none"
        />
        {texto !== "" && (
          <button type="button" onClick={() => onTexto("")} aria-label="Borrar la búsqueda" title="Borrar la búsqueda" className="shrink-0 rounded-full p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}

const ETIQUETA_GRUPO = "w-[4.25rem] shrink-0 text-[11px] font-bold uppercase tracking-wide text-slate-500"

// Un grupo del bloque de filtros: título en línea y sus opciones como botones. Un clic en la opción activa la quita
// (vuelve a la primera, "Todas"/"Todos"). Sin números por opción: el total está en el conteo de la fila final.
function GrupoChips({ grupo }) {
  return (
    <div role="group" aria-label={grupo.titulo} className="flex items-center gap-1.5">
      <span className={ETIQUETA_GRUPO}>{grupo.titulo}</span>
      {grupo.opciones.map((o) => {
        const activo = grupo.valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => grupo.onChange(activo ? grupo.opciones[0].id : o.id)}
            aria-pressed={activo}
            title={activo && o.id !== grupo.opciones[0].id ? "Clic de nuevo para quitar este filtro" : undefined}
            className={"whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}
            style={activo ? { backgroundColor: INK } : undefined}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// Grupo con muchas opciones (el equipo): una lista compacta en la misma fila.
function GrupoLista({ grupo }) {
  const activo = grupo.valor !== grupo.opciones[0].id
  return (
    <div role="group" aria-label={grupo.titulo} className="flex items-center gap-1.5">
      <span className={ETIQUETA_GRUPO + " w-[5rem]"}>{grupo.titulo}</span>
      <select
        aria-label={grupo.titulo}
        value={grupo.valor}
        onChange={(e) => grupo.onChange(e.target.value)}
        className={"h-[26px] w-44 rounded-full border px-2.5 text-xs font-semibold outline-none transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-blue-100 " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600")}
        style={activo ? { backgroundColor: INK } : undefined}
      >
        {grupo.opciones.map((o) => <option key={o.id} value={o.id} className="text-slate-800">{o.etiqueta}</option>)}
      </select>
    </div>
  )
}

// Bloque de filtros siempre a la vista, en dos filas que no cambian de lugar ni de alto entre Lista, Semana y Mes:
// fila 1 = Estado + Origen; fila 2 = Visita + Profesional y, al final, "Limpiar filtros" (siempre ahí; apagado si no hay
// filtros activos). `filas` = [[grupos de la fila 1], [grupos de la fila 2]]; un grupo con `tipo: "lista"` es una lista.
export function BloqueFiltros({ filas, hayFiltros, onLimpiar }) {
  const pintar = (g) => (g.tipo === "lista" ? <GrupoLista key={g.id} grupo={g} /> : <GrupoChips key={g.id} grupo={g} />)
  return (
    <div role="group" aria-label="Filtros de las citas" className="rounded-xl border border-slate-200/60 bg-white px-3 py-2 shadow-sm">
      <div className="flex min-h-[26px] flex-wrap items-center gap-x-6 gap-y-1.5">{filas[0].map(pintar)}</div>
      <div className="mt-1.5 flex min-h-[26px] flex-wrap items-center gap-x-6 gap-y-1.5">
        {filas[1].map(pintar)}
        <button
          type="button"
          onClick={onLimpiar}
          disabled={!hayFiltros}
          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent disabled:hover:text-slate-300"
        >
          <X size={12} aria-hidden="true" /> Limpiar filtros
        </button>
      </div>
    </div>
  )
}

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

// Calendario del rango, con el mismo estilo del selector de fecha de las citas: el primer clic marca el inicio, el
// segundo el final (si es anterior, se intercambian) y el trayecto queda sombreado. "Borrar" quita el rango.
function CalendarioRango({ rango }) {
  const hoy = hoyISO()
  const ref = rango.desde || rango.hasta || hoy
  const [mes, setMes] = useState(() => new Date(Number(ref.slice(0, 4)), Number(ref.slice(5, 7)) - 1, 1))
  const { desde, hasta } = rango
  const eligiendoFin = Boolean(desde) && !hasta
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
  const celdas = [...Array((primero.getDay() + 6) % 7).fill(null), ...Array.from({ length: new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate() }, (_, i) => fechaAISO(new Date(mes.getFullYear(), mes.getMonth(), i + 1)))]
  const elegir = (iso) => {
    if (eligiendoFin) {
      const [d, h] = iso < desde ? [iso, desde] : [desde, iso]
      rango.onDesde(d); rango.onHasta(h)
    } else { rango.onDesde(iso); rango.onHasta("") }
  }
  const corta = (iso) => { const d = isoAFechaLocal(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` }
  const resumen = desde && hasta ? `${corta(desde)} – ${corta(hasta)}` : desde ? `Desde el ${corta(desde)} · elige el final` : "Elige el inicio y el final"
  const flecha = "rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200/60 bg-slate-50/40 p-2.5">
        <div className="mb-2 flex items-center justify-between px-0.5">
          <span className="text-xs font-bold capitalize" style={{ color: INK }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() - 1, 1))} aria-label="Mes anterior" className={flecha}><ChevronLeft size={14} /></button>
            <button type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + 1, 1))} aria-label="Mes siguiente" className={flecha}><ChevronRight size={14} /></button>
          </div>
        </div>
        <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-slate-500">{DIAS_CORTOS.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {celdas.map((iso, i) => {
            if (!iso) return <span key={"v" + i} />
            const extremo = iso === desde || iso === hasta
            const dentro = desde && hasta && iso > desde && iso < hasta
            return (
              <button
                key={iso}
                type="button"
                onClick={() => elegir(iso)}
                aria-pressed={extremo}
                aria-label={iso.split("-").reverse().join("/")}
                className={"h-7 text-xs font-semibold tabular-nums transition-colors cursor-pointer " + (extremo ? "rounded-lg text-white" : dentro ? "bg-slate-200/70 text-slate-800" : "rounded-lg text-slate-700 hover:bg-slate-200/70") + (!extremo && iso === hoy ? " ring-1 ring-inset ring-slate-400 rounded-lg" : "")}
                style={extremo ? { backgroundColor: INK } : undefined}
              >
                {Number(iso.slice(8))}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="truncate text-xs font-semibold text-slate-600">{resumen}</span>
        {(desde || hasta) && <button type="button" onClick={() => { rango.onDesde(""); rango.onHasta("") }} className="shrink-0 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">Borrar</button>}
      </div>
    </div>
  )
}

// Periodo de la Lista: Hoy · Semana · Mes. Con un rango de fechas elegido en el panel "Filtrar" ninguno queda marcado.
export function PeriodoLista({ valor, onChange, opciones, sinActivo = false }) {
  return (
    <div role="group" aria-label="Periodo de las citas" className="flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
      {opciones.map((o) => {
        const activo = !sinActivo && valor === o.id
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={activo}
            className={"inline-flex items-center whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-600 hover:bg-slate-50")}
            style={activo ? { backgroundColor: INK } : undefined}
          >
            {o.etiqueta}
          </button>
        )
      })}
    </div>
  )
}

// Flechas ‹ › con el título del periodo que se ve (igual en Lista, Semana y Mes).
export function NavegadorPeriodo({ titulo, onAnterior, onSiguiente, etiquetaAnterior, etiquetaSiguiente }) {
  const flecha = "rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="flex shrink-0 items-center rounded-lg border border-slate-200/60 bg-white p-0.5 shadow-sm">
        <button type="button" onClick={onAnterior} aria-label={etiquetaAnterior} title={etiquetaAnterior} className={flecha}><ChevronLeft size={14} /></button>
        <button type="button" onClick={onSiguiente} aria-label={etiquetaSiguiente} title={etiquetaSiguiente} className={flecha}><ChevronRight size={14} /></button>
      </div>
      <h2 className="min-w-0 truncate text-[13px] font-semibold" style={{ color: INK }}>{titulo}</h2>
    </div>
  )
}

// Botón "Rango…" (solo en la Lista): abre el calendario del rango libre de fechas. Con un rango elegido muestra sus
// fechas, marcado como un filtro más (se quita con "Limpiar filtros" o con "Borrar" dentro del calendario).
export function BotonRango({ rango }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const hay = Boolean(rango.desde || rango.hasta)
  const corta = (iso) => { const d = isoAFechaLocal(iso); return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}` }
  const texto = hay ? `${rango.desde ? corta(rango.desde) : "…"} – ${rango.hasta ? corta(rango.hasta) : "…"}` : "Rango…"
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="dialog"
        className={"inline-flex h-[38px] items-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-xs font-semibold shadow-sm transition-colors cursor-pointer " + (hay ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
        style={hay ? { backgroundColor: INK } : undefined}
      >
        <CalendarRange size={14} aria-hidden="true" /> {texto}
      </button>
      {abierto && (
        <div role="dialog" aria-label="Rango de fechas" className="absolute right-0 top-full z-30 mt-1.5 w-[17.5rem] rounded-2xl border border-slate-200/60 bg-white p-3 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          <CalendarioRango rango={rango} />
        </div>
      )}
    </div>
  )
}

// Cuántas citas se ven ("5 citas", "0 citas"): siempre el mismo formato, con o sin resultados.
export function ConteoCitas({ texto }) {
  return <p role="status" className="shrink-0 text-xs text-slate-500">{texto}</p>
}
