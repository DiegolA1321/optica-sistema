"use client"

import { AlertTriangle, ChevronRight, Receipt } from "lucide-react"
import { INK } from "@/lib/tema"
import { horaSinCero } from "../../utilidades/formatoFecha"
import { claseEstadoCita, etiquetaEstadoCita } from "../../utilidades/estadosCita"
import { diasAtencionAbierta, textoAtencionAbierta } from "../../utilidades/atencionAbierta"
import { etiquetaFecha } from "../../utilidades/disponibilidad"
import { colorDe } from "../calendarioComun"

// La cita en la Agenda del celular: lo que decide de un vistazo (hora, paciente, motivo y estado, con los colores de estado de siempre). Toda la tarjeta se toca y abre el
// MISMO detalle de la computadora (paciente, cita, seguimiento y sus acciones: Atender, Editar, Cancelar, Contactar, Ver perfil…).
// Los avisos de un hecho (atención abierta de otro día, cobro pendiente, pre-triage, fecha real de atención) se ven igual que en la tarjeta de la computadora (regla 21).
export default function TarjetaCitaCelular({ cita, cobroPendiente = false, fechaReal = null, onAbrir }) {
  const dias = diasAtencionAbierta(cita)
  const triage = cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle)
  const textoEstado = cita.estado === "Cancelada"
    ? (cita.canceladaPor === "recepcion" ? "Cancelada por recepción" : cita.canceladaPor === "paciente" ? "Cancelada por el paciente" : "Cancelada")
    : etiquetaEstadoCita(cita.estado)
  const hora = horaSinCero(cita.hora)
  const [h, ampm] = hora.split(" ")
  return (
    <button type="button" data-cita-id={cita.id} onClick={() => onAbrir?.(cita)} aria-label={`${cita.paciente}, ${hora}, ${textoEstado}. Ver el detalle de la cita`}
      className={"relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-3xl border bg-white py-3 pl-5 pr-3 text-left shadow-sm " + (cita.estado === "Cancelada" ? "border-slate-100 opacity-70" : cita.estado === "En Atención" ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/80")}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: colorDe(cita.estado).linea }} aria-hidden="true" />
      <span className="w-[4.25rem] shrink-0 text-xl font-bold leading-tight" style={{ color: INK }}>
        {h}{ampm && <span className="block">{ampm}</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className={"flex items-center gap-1.5 text-lg font-bold leading-snug " + (cita.estado === "Cancelada" ? "line-through" : "")} style={{ color: INK }}>
          <span className="min-w-0 truncate">{cita.paciente}</span>
          {triage && <AlertTriangle size={16} className="shrink-0 text-amber-600" aria-label="Con pre-triage" />}
        </span>
        <span className="block truncate text-base text-slate-600">{cita.motivo || "Consulta general"}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className={"rounded-full border px-2.5 py-0.5 text-sm font-semibold " + claseEstadoCita(cita.estado)}>{textoEstado}</span>
          {cita.estado === "Atendida" && fechaReal && fechaReal !== cita.fecha && <span className="text-sm text-slate-600">Atendida el {etiquetaFecha(fechaReal)}</span>}
          {dias !== null && <span className="flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800"><AlertTriangle size={13} aria-hidden="true" /> {textoAtencionAbierta(dias)}</span>}
          {cobroPendiente && <span className="flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-100 px-2.5 py-0.5 text-sm font-bold text-amber-800"><Receipt size={13} aria-hidden="true" /> Cobro pendiente</span>}
        </span>
      </span>
      <ChevronRight size={18} aria-hidden="true" className="shrink-0 text-slate-400" />
    </button>
  )
}
