"use client"

import { CalendarClock, X } from "lucide-react"
import { INK } from "@/lib/tema"
import { etiquetaEstadoCita, claseEstadoCita } from "../../utilidades/estadosCita"
import { TONOS } from "../ventas/Lista"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { BOTON_SECUNDARIO, BOTON_PELIGRO } from "./estilos"

// Piezas del portal del paciente (portal v2). Reglas del portal: texto de 16 px o más, y todo lo que se toca mide al menos 48 px de alto (regla 48).
// Insignia de estado: el color significa lo mismo que en el sistema del personal (verde listo, azul en curso, rojo urgente, gris cerrado).
export function Insignia({ tono = "gris", children, className = "" }) {
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-base font-semibold leading-snug ${TONOS[tono]} ${className}`}>{children}</span>
}

// El estado de una cita, con el nombre y el color del módulo de Citas.
export function EstadoCita({ estado }) {
  return <span role="status" aria-label={"Estado: " + etiquetaEstadoCita(estado)} className={"inline-flex items-center rounded-full border px-3 py-1 text-base font-semibold leading-snug " + claseEstadoCita(estado)}>{etiquetaEstadoCita(estado)}</span>
}

// Un bloque del Resumen o de una pantalla: el ícono va en una baldosa gris igual en todos (el color queda para un estado, regla 14).
export function Bloque({ titulo, Icono, children, derecha, className = "", id }) {
  return (
    <section aria-labelledby={id} className={"rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm sm:p-6 " + className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="flex min-w-0 items-center gap-3 text-xl font-bold leading-tight" style={{ color: INK }}>
          {Icono && <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icono size={22} aria-hidden="true" /></span>}
          <span className="min-w-0">{titulo}</span>
        </h2>
        {derecha}
      </div>
      {children}
    </section>
  )
}

export const TituloPagina = ({ children, subtitulo }) => (
  <div>
    <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: INK }}>{children}</h1>
    {subtitulo && <p className="mt-1 text-base text-slate-600">{subtitulo}</p>}
  </div>
)

// Lo que se ve mientras llegan los datos (en vez de una pantalla vacía o que parpadea).
export const Esqueleto = ({ alto = "h-28", etiqueta = "Cargando" }) => <div aria-busy="true" aria-label={etiqueta} className={"animate-pulse rounded-2xl bg-slate-200/70 " + alto} />

// Una cita con lo que el paciente necesita: cuándo, para qué, en qué estado está y qué sigue. Reagendar y cancelar solo si se puede.
export function FilaCita({ cita, puedeReagendar, avisoNoReagendable, onReagendar, onCancelar, grande = false }) {
  const reagendable = puedeReagendar?.(cita)
  const aviso = !reagendable ? avisoNoReagendable?.(cita) : null
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <p className={"font-bold leading-snug " + (grande ? "text-2xl" : "text-lg")} style={{ color: INK }}>{formatoFecha(cita.fecha, "corto")} · {cita.hora}</p>
        <p className="text-base text-slate-700">{cita.motivo || "Consulta"}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EstadoCita estado={cita.estado} />
          <span className="text-base text-slate-600">{NOTA_ESTADO_CITA[cita.estado]}</span>
        </div>
        {aviso && <p className="text-base text-slate-600">{aviso}</p>}
      </div>
      {reagendable && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => onReagendar?.(cita)} className={BOTON_SECUNDARIO}><CalendarClock size={20} aria-hidden="true" /> Reagendar</button>
          <button type="button" onClick={() => onCancelar?.(cita)} className={BOTON_PELIGRO}><X size={20} aria-hidden="true" /> Cancelar</button>
        </div>
      )}
    </li>
  )
}
