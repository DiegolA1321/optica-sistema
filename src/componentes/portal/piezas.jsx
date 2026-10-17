"use client"

import { CalendarClock, X, Check, Star } from "lucide-react"
import { INK } from "@/lib/tema"
import { etiquetaEstadoCita, claseEstadoCita } from "../../utilidades/estadosCita"
import { TONOS } from "../ventas/Lista"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { pasosDeLosLentes, textoOrdenPaciente, NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { BOTON_SECUNDARIO, BOTON_PELIGRO } from "./estilos"

// Piezas del portal del paciente. Reglas del portal: texto de 16 px o más, títulos de tarjeta de 18 px, números principales de 28 a 40 px y todo lo que se toca mide al
// menos 44 px (regla 48). Los íconos van en baldosas de color suave: el color distingue la pregunta que responde cada tarjeta.

// Insignia de estado: el color significa lo mismo que en el sistema del personal (verde listo, azul en curso, rojo urgente, gris cerrado).
export function Insignia({ tono = "gris", children, className = "" }) {
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1 text-base font-semibold leading-snug ${TONOS[tono]} ${className}`}>{children}</span>
}

// El estado de una cita, con el nombre y el color del módulo de Citas.
export function EstadoCita({ estado }) {
  return <span role="status" aria-label={"Estado: " + etiquetaEstadoCita(estado)} className={"inline-flex items-center rounded-full border px-3 py-1 text-base font-semibold leading-snug " + claseEstadoCita(estado)}>{etiquetaEstadoCita(estado)}</span>
}

const BALDOSA = {
  azul: "bg-blue-50 text-blue-700",
  verde: "bg-emerald-50 text-emerald-700",
  ambar: "bg-amber-50 text-amber-700",
  violeta: "bg-violet-50 text-violet-700",
  rosa: "bg-rose-50 text-rose-700",
  gris: "bg-slate-100 text-slate-600",
}
export const Baldosa = ({ Icono, tono = "gris", tam = "h-11 w-11" }) => <span className={`grid ${tam} shrink-0 place-items-center rounded-xl ${BALDOSA[tono]}`}><Icono size={24} aria-hidden="true" /></span>

// Una tarjeta del portal: baldosa con el ícono y el título de 18 px.
export function Bloque({ titulo, Icono, tono = "azul", children, derecha, className = "", id }) {
  return (
    <section aria-labelledby={id} className={"min-w-0 rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6 " + className}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id={id} className="flex min-w-0 items-center gap-3 text-lg font-bold leading-tight" style={{ color: INK }}>
          {Icono && <Baldosa Icono={Icono} tono={tono} />}
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

// Una cita en una fila de lista: cuándo, para qué, en qué estado está y qué sigue. Reagendar y cancelar solo si se puede.
export function FilaCita({ cita, puedeReagendar, avisoNoReagendable, onReagendar, onCancelar }) {
  const reagendable = puedeReagendar?.(cita)
  const aviso = !reagendable ? avisoNoReagendable?.(cita) : null
  return (
    <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <p className="text-lg font-bold leading-snug" style={{ color: INK }}>{formatoFecha(cita.fecha, "corto")} · {cita.hora}</p>
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

// El seguimiento de unos lentes como el de un envío: Pedido → En el laboratorio → Listos para retirar → Entregados, con el paso actual resaltado, la fecha de cada paso
// cumplido y la fecha estimada. Mismo estado y mismo color que las órdenes de Ventas. Vertical siempre (`vertical`) o solo en el celular.
const COLOR_PASO = { azul: "#2563EB", verde: "#059669", rojo: "#DC2626", gris: "#475569" }
const dia = (v) => (v ? formatoFecha(diaDeRegistro(v), "medio") : "")
export function PasosLentes({ orden, vertical = false, conMensaje = true }) {
  const { pasos, tono, actual } = pasosDeLosLentes(orden)
  const t = textoOrdenPaciente(orden)
  const color = COLOR_PASO[tono]
  // La fecha que acompaña a cada paso: cuándo se cumplió, o la estimada si es el actual.
  const fechaDe = [dia(orden.pedidoEl || orden.creadaEn), actual === 1 && orden.fechaPrometida ? `Fecha estimada: ${formatoFecha(orden.fechaPrometida, "medio")}` : "", dia(orden.listaEl), dia(orden.entregadaEl)]
  return (
    <div>
      <ol aria-label="Seguimiento de tus lentes" className={"flex flex-col " + (vertical ? "" : "sm:flex-row")}>
        {pasos.map((p, i) => {
          const ultimo = i === pasos.length - 1
          const lineaOn = p.estado === "hecho"
          return (
            <li key={p.nombre} aria-current={p.estado === "actual" ? "step" : undefined} className={"relative flex flex-1 gap-3 pb-5 " + (vertical ? "" : "sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center")}>
              {!ultimo && <span aria-hidden="true" className={"absolute left-[19px] top-10 h-[calc(100%-2.5rem)] w-0.5 " + (vertical ? "" : "sm:left-1/2 sm:top-[19px] sm:h-0.5 sm:w-full")} style={{ background: lineaOn ? color : "#E2E8F0" }} />}
              <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 text-base font-bold" style={p.estado === "pendiente" ? { borderColor: "#CBD5E1", background: "#fff", color: "#64748B" } : p.estado === "hecho" ? { borderColor: color, background: color, color: "#fff" } : { borderColor: color, background: "#fff", color, boxShadow: `0 0 0 4px ${color}22` }}>
                {p.estado === "hecho" ? <Check size={20} aria-hidden="true" /> : i + 1}
              </span>
              <span className={"min-w-0 pt-0.5 " + (vertical ? "" : "sm:pt-0")}>
                <span className={"block text-base leading-snug " + (p.estado === "actual" ? "font-bold text-slate-900" : p.estado === "hecho" ? "font-semibold text-slate-700" : "text-slate-600")}>{p.nombre}</span>{" "}
                {fechaDe[i] && p.estado !== "pendiente" && <span className="block text-base leading-snug text-slate-600">{fechaDe[i]}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {conMensaje && t.clave === "atrasada" && <p className="mt-1 rounded-xl px-4 py-3 text-lg font-semibold leading-snug" style={{ background: color + "14", color: tono === "gris" ? "#334155" : color }}>{t.detalle}</p>}
    </div>
  )
}

// Las cinco estrellas para calificar la atención (cada una mide 48 px).
export function Estrellas({ valor, onCambiar, etiqueta = "Calificación" }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => onCambiar?.(n)} className="grid h-12 w-12 place-items-center rounded-lg transition-colors hover:bg-amber-50 cursor-pointer">
          <Star size={32} aria-hidden="true" fill={valor >= n ? "#F59E0B" : "none"} stroke={valor >= n ? "#F59E0B" : "#94A3B8"} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  )
}
