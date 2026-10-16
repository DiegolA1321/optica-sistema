"use client"

import { useMemo, useState } from "react"
import { BookOpen, ChevronDown, Search, X } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL } from "../ventas/estilos"
import { AYUDA_POR_MODULO, buscarAyuda } from "../../utilidades/soporteAyuda"

function Pregunta({ q, abierta }) {
  return (
    <details open={abierta || undefined} className="group border-b border-slate-100 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        {q.p}
        <ChevronDown size={16} className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{q.r}</p>
    </details>
  )
}

// Pestaña "Ayuda": las preguntas frecuentes por módulo, con buscador. Es lo primero que se ve, porque lo mejor es encontrar la respuesta antes de escribir.
export default function PestanaAyuda({ puedeEscribir, onEscribir, esAdmin = true, busquedaInicial = "", enfocar = false }) {
  const escribirA = esAdmin ? "Escribir al soporte" : "Escribir a mi administrador"
  const [busqueda, setBusqueda] = useState(busquedaInicial)
  const [modulo, setModulo] = useState("")
  const buscando = busqueda.trim().length > 0
  const encontradas = useMemo(() => (buscando ? buscarAyuda(busqueda, modulo) : []), [busqueda, modulo, buscando])
  const grupos = modulo ? AYUDA_POR_MODULO.filter((g) => g.modulo === modulo) : AYUDA_POR_MODULO
  const modulosConResultado = [...new Set(encontradas.map((q) => q.modulo))]

  const pieEscribir = (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold" style={{ color: INK }}>¿No encontraste lo que buscabas?</p>
        <p className="mt-0.5 text-sm text-slate-500">{esAdmin ? "Cuéntanos qué pasa y te respondemos por aquí." : "Cuéntale a tu administrador qué pasa y te responde por aquí."}</p>
      </div>
      {puedeEscribir && <button type="button" onClick={() => onEscribir(modulo)} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{escribirA}</button>}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[16rem] flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
          <input type="search" autoFocus={enfocar} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar en la ayuda: agendar, abono, permisos…" aria-label="Buscar en la ayuda"
            className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50 [&::-webkit-search-cancel-button]:hidden" />
          {buscando && <button type="button" onClick={() => setBusqueda("")} aria-label="Limpiar búsqueda" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={14} aria-hidden="true" /></button>}
        </div>
        <select value={modulo} onChange={(e) => setModulo(e.target.value)} aria-label="Filtrar la ayuda por módulo" className="rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50">
          <option value="">Todos los módulos</option>
          {AYUDA_POR_MODULO.map((g) => <option key={g.modulo} value={g.modulo}>{g.nombre}</option>)}
        </select>
      </div>

      {buscando && encontradas.length === 0 ? (
        <Vacio Icono={Search} titulo={`No encontramos preguntas con «${busqueda.trim()}»`} texto={`Prueba con otra palabra o quita el filtro de módulo. ${esAdmin ? "Si no está, escríbenos y lo resolvemos." : "Si no está, escríbele a tu administrador."}`}>
          {puedeEscribir && <button type="button" onClick={() => onEscribir(modulo)} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{escribirA}</button>}
        </Vacio>
      ) : (
        <div className="space-y-3">
          {buscando && <p role="status" className="px-1 text-xs font-semibold text-slate-500">{encontradas.length === 1 ? "1 pregunta" : `${encontradas.length} preguntas`} en {modulosConResultado.length === 1 ? "1 módulo" : `${modulosConResultado.length} módulos`}</p>}
          {grupos.map((g) => {
            const preguntas = buscando ? encontradas.filter((q) => q.modulo === g.modulo) : g.preguntas
            if (buscando && preguntas.length === 0) return null
            return (
              // Cada módulo empieza cerrado, con su título y cuántas preguntas tiene; al buscar, se abren los que tienen resultados.
              <details key={`${g.modulo}-${buscando}`} open={buscando || undefined} aria-label={`Ayuda de ${g.nombre}`} role="group" className="group/m overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
                <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold transition-colors hover:bg-slate-50 [&::-webkit-details-marker]:hidden" style={{ color: INK }}>
                  <BookOpen size={15} className="text-blue-700" aria-hidden="true" />
                  <span>{g.nombre} · {preguntas.length === 1 ? "1 pregunta" : `${preguntas.length} preguntas`}</span>
                  <ChevronDown size={16} className="ml-auto shrink-0 text-slate-400 transition-transform group-open/m:rotate-180" aria-hidden="true" />
                </summary>
                <div className="border-t border-slate-100">{preguntas.map((q) => <Pregunta key={q.p} q={q} abierta={buscando && encontradas.length === 1} />)}</div>
              </details>
            )
          })}
        </div>
      )}

      {pieEscribir}
    </div>
  )
}
