"use client"

import { Check, X } from "lucide-react"
import { INK } from "@/lib/tema"
import { SALUD } from "../../utilidades/superadminNegocio"
import { MODO_SAAS_VISIBLE } from "@/lib/config"

// Con el modo de la tesis (una sola óptica) las de prueba son "entornos de prueba": no son clientes.
export const NOMBRE_PRUEBA = MODO_SAAS_VISIBLE ? "Óptica de prueba" : "Entorno de prueba"
// El mismo nombre en frases: "ópticas de prueba" (con clientes) o "entornos de prueba" (modo de la tesis).
export const NOMBRE_PRUEBA_PLURAL = MODO_SAAS_VISIBLE ? "ópticas de prueba" : "entornos de prueba"

// Piezas pequeñas que comparten las secciones del panel del superadmin.

// La insignia de la salud de una óptica (Saludable · Atención · En riesgo), con su color de siempre.
export function InsigniaSalud({ estado }) {
  const s = SALUD[estado] || SALUD.saludable
  return <span className={"inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-bold " + s.clase}>{s.nombre}</span>
}

// El marcador de una óptica de prueba (se ve en Ópticas, en el Resumen y en su detalle).
export function EtiquetaPrueba() {
  return <span className="inline-flex shrink-0 items-center rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">{NOMBRE_PRUEBA}</span>
}

// "Incluir ópticas de prueba": las de prueba y de demostración no cuentan en las métricas del negocio salvo que se pida verlas.
export function InterruptorPrueba({ activo, onCambiar, cuantas }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50">
      <input type="checkbox" checked={activo} onChange={(e) => onCambiar(e.target.checked)} className="peer sr-only" />
      <span aria-hidden="true" className="grid h-4 w-4 place-items-center rounded border border-slate-300 bg-white text-white transition-colors peer-checked:border-blue-600 peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-500/50">{activo && <Check size={12} strokeWidth={3} />}</span>
      Incluir {MODO_SAAS_VISIBLE ? "ópticas" : "entornos"} de prueba{cuantas != null && <span className="font-normal text-slate-500">({cuantas})</span>}
    </label>
  )
}

// Cabecera de una sección: el título, la pregunta que responde y, a la derecha, sus acciones. Igual que la de Reportes.
export function CabeceraSeccion({ titulo, pregunta, children }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <div className="min-w-0">
        <h1 className="text-xl font-bold" style={{ color: INK }}>{titulo}</h1>
        {pregunta && <p className="text-sm text-slate-500">{pregunta}</p>}
      </div>
      {children && <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

// Etiquetas de los filtros activos, con su "x" (como en Reportes y Citas). etiquetas: [{ id, texto, quitar? }]
export function EtiquetasFiltros({ etiquetas, onLimpiar }) {
  const hayQuitables = etiquetas.some((e) => e.quitar)
  return (
    <ul className="ml-auto flex min-w-[160px] flex-1 flex-wrap items-center justify-end gap-1.5 self-center" aria-label="Filtros activos">
      {etiquetas.map((e) => (
        <li key={e.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {e.texto}
          {e.quitar && <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 cursor-pointer"><X size={12} aria-hidden="true" /></button>}
        </li>
      ))}
      {hayQuitables && onLimpiar && <li><button type="button" onClick={onLimpiar} className="rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">Limpiar filtros</button></li>}
    </ul>
  )
}
