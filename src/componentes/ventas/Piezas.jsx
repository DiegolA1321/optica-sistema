"use client"

import { useState } from "react"
import { Calendar, ChevronDown, Search, SlidersHorizontal, X } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { CalendarioRango, useCierre } from "../FiltrosCitas"
import { hayRango } from "../../utilidades/periodoLista"
import { formatoFecha } from "../../utilidades/formatoFecha"

// Las piezas de Ventas e Inventario que se ven igual en los dos módulos (regla 18): las pestañas con su número, la franja de datos con sus rayitas, el campo de
// búsqueda, el botón «Filtrar», el selector de período y las píldoras de filtro. Los datos cortos van en franjas, no en tarjetas grandes.
const ACTIVO = { background: GRAD_MARCA, backgroundOrigin: "border-box" }
const BOTON_BARRA = "inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200/60 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"

// Pestañas del módulo: el nombre y, al lado, su número. La activa lleva la línea de la marca debajo.
export function Pestanas({ etiqueta, pestanas, activa, onCambiar, idBase }) {
  return (
    <div role="tablist" aria-label={etiqueta} className="flex items-end gap-1 overflow-x-auto border-b border-slate-200/70">
      {pestanas.map(({ id, titulo, cuenta }) => {
        const esta = activa === id
        return (
          <button key={id} type="button" role="tab" id={`${idBase}-tab-${id}`} aria-selected={esta} aria-controls={`${idBase}-panel`} onClick={() => onCambiar(id)}
            className={"-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-base font-semibold transition-colors cursor-pointer " + (esta ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-900")}>
            {titulo}
            {cuenta != null && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold tabular-nums text-slate-500">{cuenta}</span>}
          </button>
        )
      })}
    </div>
  )
}

// Campo de búsqueda con su lupa dentro y alineada (la lupa va en el mismo cuadro que el campo, nunca en uno más alto).
export function CampoBusqueda({ valor, onCambio, placeholder, id, className = "" }) {
  return (
    <div className={"relative min-w-0 flex-1 " + className}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
      <label htmlFor={id} className="sr-only">{placeholder}</label>
      <input id={id} type="text" value={valor} onChange={(e) => onCambio(e.target.value)} placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-200/60 bg-white pl-10 pr-3 text-sm text-slate-800 shadow-sm outline-none transition-colors placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
    </div>
  )
}

// «Filtrar ▾»: un menú pequeño con secciones de opciones (una sola elegida por sección; la primera es «sin filtro»). Con filtros puestos lleva su número.
export function BotonFiltrar({ secciones, panelId, etiqueta = "Filtrar" }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useCierre(abierto, () => setAbierto(false))
  const puestos = secciones.filter((s) => s.valor !== s.opciones[0].id).length
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setAbierto((v) => !v)} aria-haspopup="dialog" aria-expanded={abierto} aria-controls={panelId} className={BOTON_BARRA}>
        <SlidersHorizontal size={15} aria-hidden="true" /> {etiqueta}
        {puestos > 0 && <span className="rounded-full px-1.5 text-xs font-bold text-white" style={ACTIVO}>{puestos}</span>}
        <ChevronDown size={14} className={"transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div id={panelId} role="dialog" aria-label={etiqueta} className="absolute right-0 top-full z-30 mt-1.5 w-[22rem] max-w-[calc(100vw-2rem)] space-y-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {secciones.map((s) => (
            <div key={s.id} role="group" aria-label={s.titulo} className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">{s.titulo}</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {s.opciones.map((o) => {
                  const activo = s.valor === o.id
                  return (
                    <button key={o.id} type="button" aria-pressed={activo} onClick={() => s.onChange(activo ? s.opciones[0].id : o.id)}
                      className={"inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50")}
                      style={activo ? ACTIVO : undefined}>
                      {o.etiqueta}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const OPCIONES_PERIODO = [{ id: "hoy", etiqueta: "Hoy" }, { id: "semana", etiqueta: "Esta semana" }, { id: "mes", etiqueta: "Este mes" }]
const corta = (iso) => formatoFecha(iso, "medioSinAnio")

// El texto del botón del período: «Este mes», «Hoy», «5 oct – 11 oct» o «Todas las fechas».
export function etiquetaDePeriodo(periodo, buscando = false) {
  if (buscando) return "Todas las fechas"
  if (hayRango(periodo)) return periodo.desde && periodo.hasta ? `${corta(periodo.desde)} – ${corta(periodo.hasta)}` : "Elegir fechas"
  return OPCIONES_PERIODO.find((o) => o.id === periodo.filtro)?.etiqueta || "Todas las fechas"
}

// «Este mes ▾»: Hoy, Esta semana, Este mes y Elegir fechas (que abre el calendario del rango). Mientras se busca, la búsqueda mira todas las fechas y el selector lo dice.
export function SelectorPeriodo({ periodo, onCambiar, buscando = false, ariaLabel = "Período" }) {
  const [abierto, setAbierto] = useState(false)
  const [eligiendo, setEligiendo] = useState(false)
  const cerrar = () => { setAbierto(false); setEligiendo(false) }
  const ref = useCierre(abierto, cerrar)
  const elegido = hayRango(periodo) ? "rango" : periodo.filtro
  const opcion = "flex w-full items-center rounded-lg px-3 py-2 text-left text-sm font-semibold transition-colors cursor-pointer "
  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setAbierto((v) => !v)} disabled={buscando} aria-haspopup="menu" aria-expanded={abierto} aria-label={ariaLabel} className={BOTON_BARRA + " min-w-[9.5rem] justify-between disabled:cursor-default disabled:opacity-70"}>
        <span>{etiquetaDePeriodo(periodo, buscando)}</span>
        <ChevronDown size={14} className={"transition-transform " + (abierto ? "rotate-180" : "")} aria-hidden="true" />
      </button>
      {abierto && (
        <div role="menu" aria-label={ariaLabel} className="absolute left-0 top-full z-30 mt-1.5 w-64 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-xl" style={{ animation: "menu-in 160ms ease-out" }}>
          {OPCIONES_PERIODO.map((o) => (
            <button key={o.id} type="button" role="menuitemradio" aria-checked={elegido === o.id} onClick={() => { onCambiar({ filtro: o.id, ref: "", desde: "", hasta: "" }); cerrar() }}
              className={opcion + (elegido === o.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50")}>{o.etiqueta}</button>
          ))}
          <button type="button" role="menuitemradio" aria-checked={elegido === "rango"} onClick={() => setEligiendo((v) => !v)} className={opcion + "justify-between " + (elegido === "rango" ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50")}>
            <span className="inline-flex items-center gap-2"><Calendar size={14} aria-hidden="true" /> Elegir fechas</span>
            <ChevronDown size={13} className={"transition-transform " + (eligiendo ? "rotate-180" : "")} aria-hidden="true" />
          </button>
          {eligiendo && (
            <div className="p-1.5">
              <CalendarioRango rango={{
                desde: periodo.desde || "", hasta: periodo.hasta || "",
                onDesde: (d) => onCambiar({ filtro: "rango", ref: "", desde: d, hasta: d ? periodo.hasta || "" : "" }),
                onHasta: (h) => { onCambiar({ filtro: "rango", ref: "", desde: periodo.desde || "", hasta: h }); if (h) cerrar() },
              }} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// La franja de datos: una sola caja con rayitas finas entre los datos. Cada dato es un botón que filtra la lista; el activo se marca y el rótulo dice qué cuenta.
// datos: [{ id, etiqueta, valor, sub, punto?: "rojo" | "ambar", activo?, onClick, ayuda? }]
const PUNTO = { rojo: "bg-red-600", ambar: "bg-amber-600" }
export function FranjaDatos({ datos, etiqueta }) {
  return (
    <ul aria-label={etiqueta} className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm sm:grid-cols-3 lg:flex lg:divide-x lg:divide-slate-200/70">
      {datos.map((d) => (
        <li key={d.id} className="min-w-0 border-b border-slate-200/70 last:border-b-0 lg:flex-1 lg:border-b-0">
          <button type="button" onClick={d.onClick} disabled={!d.onClick} aria-pressed={d.onClick ? Boolean(d.activo) : undefined} title={d.ayuda}
            className={"block h-full w-full px-4 py-3 text-left transition-colors " + (d.onClick ? "cursor-pointer " : "cursor-default ") + (d.activo ? "bg-blue-50/70" : d.onClick ? "hover:bg-slate-50" : "")}>
            <span className="flex items-center gap-2 text-sm text-slate-600">
              {d.punto && <span className={"h-2.5 w-2.5 shrink-0 rounded-full " + PUNTO[d.punto]} aria-hidden="true" />}
              <span className="truncate">{d.etiqueta}</span>
            </span>
            <span className="mt-0.5 block truncate font-serif text-2xl font-bold tabular-nums" style={{ color: INK }}>{d.valor}</span>
            <span className="block truncate text-sm text-slate-500">{d.sub || " "}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

// Píldoras de filtro (En curso · Atrasados · …): la activa lleva el color de la marca. Con `cuenta`, el número va en la misma píldora.
export function Pildoras({ etiqueta, opciones, valor, onCambiar }) {
  return (
    <div role="group" aria-label={etiqueta} className="flex flex-wrap items-center gap-2">
      {opciones.map((o) => {
        const activo = valor === o.id
        return (
          <button key={o.id} type="button" aria-pressed={activo} onClick={() => onCambiar(o.id)}
            className={"inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50")}
            style={activo ? ACTIVO : undefined}>
            {o.etiqueta}{o.cuenta != null && " "}{o.cuenta != null && <span className={"tabular-nums " + (activo ? "text-white/90" : "text-slate-500")}>· {o.cuenta}</span>}
          </button>
        )
      })}
    </div>
  )
}

// El filtro que está puesto y se quita con un gesto: «Por cobrar ✕».
export function FiltroActivo({ texto, onQuitar, onLimpiar }) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Mostrando</span>
      <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/70 bg-blue-50 py-1 pl-3 pr-1.5 text-sm font-semibold text-blue-800">
        {texto}
        <button type="button" onClick={onQuitar} aria-label={`Quitar el filtro ${texto}`} className="rounded-full p-0.5 text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer"><X size={14} aria-hidden="true" /></button>
      </span>
      {onLimpiar && <button type="button" onClick={onLimpiar} className="text-sm font-semibold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">Limpiar</button>}
    </div>
  )
}

// Una lista como la del diseño: encabezado de columnas en mayúsculas, filas separadas por una línea fina y toda la fila pulsable (regla 50).
export function TablaLista({ etiqueta, plantilla, encabezado, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
      <div aria-hidden="true" className={"hidden gap-x-4 border-b border-slate-200/70 px-5 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 lg:grid " + plantilla}>
        {encabezado.map((e, i) => <span key={i} className={e.derecha ? "text-right" : ""}>{e.texto}</span>)}
      </div>
      <ul role="list" aria-label={etiqueta} data-lista={etiqueta} className="divide-y divide-slate-200/70">{children}</ul>
    </div>
  )
}
