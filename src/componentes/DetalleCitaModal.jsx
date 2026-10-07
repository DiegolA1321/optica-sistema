"use client"

import { fechaHoraLegible } from "../utilidades/formatoFecha"
import { createPortal } from "react-dom"
import { X, User, Stethoscope, CalendarDays, Clock, CalendarPlus, Globe, Building2, Hash, Phone, IdCard, ExternalLink, CalendarClock, Receipt, AlertTriangle, MessageSquare, UserCog, UserCheck, LogOut } from "lucide-react"
import { INK } from "@/lib/tema"
import { etiquetaFecha } from "../utilidades/disponibilidad"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { urlPerfilPaciente } from "./calendarioComun"
import { etiquetaMiembro } from "../utilidades/equipo"
import { puedeCancelarCita, puedeAtenderCita, puedeEditarCita, puedeAgendarOtraCita } from "../utilidades/filtrosCitas"
import { diasAtencionAbierta, textoAtencionAbierta } from "../utilidades/atencionAbierta"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const BADGE_ESTADO = {
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-600",
}
const BADGE_PENDIENTE = "border-amber-200/60 bg-amber-50 text-amber-700"
const ETIQUETA_ESTADO = { "En Atención": "En atención", "No Asistió": "No asistió" }

// "4 oct 2026, 03:20 PM" a partir del created_at de la cita (timestamptz).
function fechaHoraAgendada(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return fechaHoraLegible(d, { anio: true })
}

function Fila({ icono: Icono, etiqueta, children }) {
  return (
    <div className="flex items-start gap-2.5 py-2 text-sm">
      <Icono size={15} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" />
      <dt className="w-28 shrink-0 text-slate-500">{etiqueta}</dt>
      <dd className="min-w-0 flex-1 break-words font-semibold" style={{ color: INK }}>{children}</dd>
    </div>
  )
}

// Detalle completo de una cita (R12-R14): se abre al hacer clic en la cita,
// en la lista y en el modal "Citas del día". "Ingresar" lleva a la ficha
// clínica de esa cita (o al cobro si ya quedó pendiente) y "Ver perfil" abre
// el paciente en otra pestaña para no perder el lugar en la agenda.
export default function DetalleCitaModal({ cita, equipo = [], fechaAtencionReal, cobroPendiente, onCerrar, onIngresar, onAgendarOtra, onCobrar, onEditar, onCancelar, onDejarDeAtender }) {
  const refModal = useModalAccesible(true, onCerrar)
  const puedeIngresar = puedeAtenderCita(cita) && !!onIngresar
  const puedeAgendarOtra = puedeAgendarOtraCita(cita) && !!onAgendarOtra
  const agendada = fechaHoraAgendada(cita.creadoEn)
  const triage = cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle)
    ? [cita.triage.sintomas?.join(", "), cita.triage.desdeCuando, cita.triage.detalle].filter(Boolean).join(" · ")
    : null

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-cita-titulo"
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
              {cita.iniciales || <User size={18} />}
            </div>
            <div className="min-w-0">
              <h4 id="detalle-cita-titulo" className="truncate text-lg font-bold" style={{ color: INK }}>{cita.paciente}</h4>
              <span className={"mt-0.5 inline-block rounded-full border px-2 py-0.5 text-xs font-semibold " + (BADGE_ESTADO[cita.estado] || BADGE_PENDIENTE)}>
                {ETIQUETA_ESTADO[cita.estado] || cita.estado || "Pendiente"}
              </span>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          <dl className="divide-y divide-slate-100">
            <Fila icono={Stethoscope} etiqueta="Motivo">
              {cita.motivo || "Sin motivo"}
              {cita.motivoPublico && <span className="mt-0.5 block text-xs font-normal text-slate-500">Indicado en línea: {cita.motivoPublico}</span>}
            </Fila>
            <Fila icono={CalendarDays} etiqueta="Fecha">{cita.fecha ? etiquetaFecha(cita.fecha) : "Sin fecha"}</Fila>
            <Fila icono={Clock} etiqueta="Hora">{cita.hora}</Fila>
            {fechaAtencionReal && fechaAtencionReal !== cita.fecha && (
              <Fila icono={CalendarClock} etiqueta="Atendida el">{etiquetaFecha(fechaAtencionReal)}</Fila>
            )}
            <Fila icono={CalendarPlus} etiqueta="Agendada el">{agendada || "Sin registro"}</Fila>
            <Fila icono={cita.origen === "paciente" ? Globe : Building2} etiqueta="Origen">
              {cita.origen === "paciente" ? "Web (agendó el paciente)" : "Recepción"}
            </Fila>
            <Fila icono={UserCog} etiqueta="Asignado a">
              {etiquetaMiembro(equipo, cita.asignadoA) || <span className="font-normal text-slate-500">Sin asignar</span>}
            </Fila>
            <Fila icono={UserCheck} etiqueta="Atendido por">
              {etiquetaMiembro(equipo, cita.atendidoPor) || <span className="font-normal text-slate-500">{cita.estado === "Atendida" || cita.estado === "En Atención" ? "Sin registro" : "Aún no la atiende nadie"}</span>}
            </Fila>
            {cita.cedula && <Fila icono={IdCard} etiqueta="Cédula"><span className="font-mono">{cita.cedula}</span></Fila>}
            {cita.telefono && <Fila icono={Phone} etiqueta="Teléfono">{cita.telefono}</Fila>}
            {cita.codigo && <Fila icono={Hash} etiqueta="Código"><span className="font-mono">{cita.codigo}</span></Fila>}
            {cita.estado === "Cancelada" && cita.canceladaPor && (
              <Fila icono={MessageSquare} etiqueta="Cancelada por">{cita.canceladaPor === "recepcion" ? "Recepción" : "El paciente"}</Fila>
            )}
          </dl>
          {triage && (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
              Pre-triage: {triage}
            </p>
          )}
          {diasAtencionAbierta(cita) !== null && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
              <AlertTriangle size={13} aria-hidden="true" /> {textoAtencionAbierta(diasAtencionAbierta(cita))}
            </p>
          )}
          {cobroPendiente && (
            <p className="mt-2 flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">
              <Receipt size={13} aria-hidden="true" /> Cobro pendiente
            </p>
          )}
        </div>

        <div className="shrink-0 space-y-2 border-t border-slate-100 px-5 py-4">
          <div className="flex gap-2">
            <button type="button" onClick={onCerrar} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
              Cerrar
            </button>
            {cobroPendiente ? (
              <button type="button" onClick={() => onCobrar(cita)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
                <Receipt size={15} aria-hidden="true" /> Cobrar
              </button>
            ) : puedeAgendarOtra ? (
              <button type="button" onClick={() => onAgendarOtra(cita)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-blue-200/70 bg-blue-50 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer">
                <CalendarPlus size={15} aria-hidden="true" /> Agendar otra cita
              </button>
            ) : puedeIngresar && (
              <button type="button" onClick={() => onIngresar(cita)} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                <Stethoscope size={15} aria-hidden="true" /> Ingresar
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {cita.pacienteId && (
              <a href={urlPerfilPaciente(cita.pacienteId)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900">
                <ExternalLink size={13} aria-hidden="true" /> Ver perfil
              </a>
            )}
            {puedeEditarCita(cita) && (
              <button type="button" onClick={() => onEditar(cita)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 cursor-pointer">
                <CalendarClock size={13} aria-hidden="true" /> Editar cita
              </button>
            )}
            {cita.estado === "En Atención" && onDejarDeAtender && (
              <button type="button" onClick={() => onDejarDeAtender(cita)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900 cursor-pointer">
                <LogOut size={13} aria-hidden="true" /> Dejar de atender
              </button>
            )}
            {puedeCancelarCita(cita) && (
              <button type="button" onClick={() => onCancelar(cita)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 transition-colors hover:text-red-700 cursor-pointer">
                <X size={13} aria-hidden="true" /> Cancelar cita
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
