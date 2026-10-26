"use client"

import { useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { SeccionRango } from "../FiltrosCitas"

const ACTIVO = { background: GRAD_MARCA, backgroundOrigin: "border-box" }
const CHIP = "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-4 text-base font-semibold "
const chip = (activo) => CHIP + (activo ? "border-transparent text-white" : "border-slate-300 bg-white text-slate-700")

// La barra de búsqueda y filtros de una lista, en el celular: la búsqueda siempre arriba, «Filtrar» abre una ventana a pantalla completa con TODAS las secciones de la barra de la computadora
// (las mismas `secciones` y `etiquetas` que ya arma la pantalla) y los filtros activos quedan como etiquetas con su «x». Misma información y mismos filtros; solo cambia dónde están.
// secciones: [{ id, titulo, valor, onChange, opciones: [{ id, etiqueta, conteo? }], tipo?: "chips" | "lista" | "rango" }]; etiquetas: [{ id, texto, quitar }].
export default function BarraFiltrosCelular({ texto, onTexto, secciones, etiquetas, onLimpiar, placeholder, inputId, titulo = "Filtrar", subtitulo = "Busca y filtra la lista." }) {
  const [abierto, setAbierto] = useState(false)
  const hayAlgo = etiquetas.length > 0 || texto.trim() !== ""
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <label htmlFor={inputId} className="sr-only">{placeholder}</label>
          <input id={inputId} type="text" value={texto} onChange={(e) => onTexto(e.target.value)} placeholder={placeholder}
            className="w-full rounded-2xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-slate-800 shadow-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
        </div>
        <button type="button" onClick={() => setAbierto(true)} aria-haspopup="dialog" className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-700 shadow-sm">
          <SlidersHorizontal size={18} aria-hidden="true" /> Filtrar
          {etiquetas.length > 0 && <span className="rounded-full px-2 text-sm font-bold text-white" style={ACTIVO}>{etiquetas.length}</span>}
        </button>
      </div>
      {etiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {etiquetas.map((e) => (
            <span key={e.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-slate-100 py-1 pl-3 pr-1 text-sm font-semibold text-slate-700">
              <span className="truncate">{e.texto}</span>
              <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="grid place-items-center rounded-full"><X size={14} aria-hidden="true" /></button>
            </span>
          ))}
        </div>
      )}
      {abierto && (
        <Cascaron titulo={titulo} subtitulo={subtitulo} Icono={SlidersHorizontal} ancho="max-w-lg" onCerrar={() => setAbierto(false)}
          pie={<>
            {hayAlgo ? <button type="button" onClick={onLimpiar} className="flex cursor-pointer items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-slate-700"><X size={16} aria-hidden="true" /> Limpiar</button> : <span />}
            <button type="button" onClick={() => setAbierto(false)} className="cursor-pointer rounded-xl px-6 text-base font-bold text-white" style={ACTIVO}>Listo</button>
          </>}>
          <div className="space-y-6 px-5 py-5">
            {secciones.map((s) => (
              <div key={s.id} role="group" aria-label={s.titulo} className="space-y-2">
                <span className="block text-sm font-bold uppercase tracking-wide text-slate-600">{s.titulo}</span>
                {s.tipo === "rango" ? (
                  <SeccionRango rango={s.rango} />
                ) : s.tipo === "lista" ? (
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
      )}
    </div>
  )
}
