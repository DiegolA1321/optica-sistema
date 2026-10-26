"use client"

import { Calendar, CalendarPlus, Clock, Mail, MoreVertical, Phone, ShoppingCart } from "lucide-react"
import { INK } from "@/lib/tema"
import { etiquetaDocumento, tipoDeDocumento } from "../../utilidades/documento"
import { fechaLegible, horaSinCero } from "../../utilidades/formatoFecha"

// Un paciente de la lista de Pacientes en el celular: nombre, documento, sus insignias, contacto, última visita y próxima cita, con el mismo menú de acciones de la computadora.
// Toda la tarjeta se toca y abre su perfil; sus acciones («Agendar cita», «Nueva venta» y «Más acciones») son las que en la computadora aparecen al pasar el cursor.
// insignias: las mismas de la fila de la tabla (las arma Pacientes). visita: la última consulta (texto) o null; siguiente: su próxima cita o null.
export default function TarjetaPacienteCelular({ paciente, color, insignias, visita, sinConsultasTexto = "Sin consultas", siguiente, onAbrir, onAgendar, onVender, onMenu, menuAbierto = false, activa = false }) {
  const documento = (tipoDeDocumento(paciente) !== "cedula" ? `${etiquetaDocumento(paciente)} · ` : "") + paciente.cedula
  return (
    <li data-paciente-id={paciente.id} className={"overflow-hidden rounded-3xl border bg-white shadow-sm " + (activa ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/80")}>
      <div className="flex items-start gap-1 pr-1">
        <button type="button" onClick={() => onAbrir(paciente)} aria-label={`Ver el perfil de ${paciente.nombre}`} className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 py-3 pl-4 text-left">
          <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white" style={{ background: color }}>{paciente.nombre.charAt(0).toUpperCase()}</span>
          <span className="min-w-0 flex-1">
            <span className="block break-words text-lg font-bold leading-snug" style={{ color: INK }}>{paciente.nombre}</span>
            <span className="block font-mono text-sm text-slate-600">{documento}</span>
          </span>
        </button>
        {onMenu && (
          <button type="button" onClick={(e) => onMenu(paciente.id, e)} aria-label="Más acciones" aria-haspopup="menu" aria-expanded={menuAbierto} className={"mt-2 grid shrink-0 cursor-pointer place-items-center rounded-xl " + (menuAbierto ? "bg-slate-100 text-slate-800" : "text-slate-600")}>
            <MoreVertical size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className="px-4 pb-3 [&>div]:mt-0">{insignias}</div>
      <dl className="grid gap-y-1.5 border-t border-slate-100 px-4 py-3 text-base text-slate-700">
        <div className="flex items-center gap-2"><dt className="sr-only">Teléfono</dt><Phone size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><dd className="min-w-0 truncate">{paciente.telefono}</dd></div>
        <div className="flex items-center gap-2"><dt className="sr-only">Correo</dt><Mail size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><dd className="min-w-0 truncate">{paciente.correo}</dd></div>
        <div className="flex items-center gap-2"><dt className="sr-only">Última visita</dt><Clock size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><dd className="min-w-0"><span className="text-slate-600">Última visita · </span>{visita || <span className="text-slate-500">{sinConsultasTexto}</span>}</dd></div>
        <div className="flex items-center gap-2"><dt className="sr-only">Próxima cita</dt><Calendar size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><dd className="min-w-0"><span className="text-slate-600">Próxima cita · </span>{siguiente ? `${fechaLegible(siguiente.fecha)} · ${horaSinCero(siguiente.hora)}` : <span className="text-slate-500">Sin cita</span>}</dd></div>
      </dl>
      {(onAgendar || onVender) && (
        <div className="flex flex-wrap gap-2 border-t border-slate-100 px-3 py-2">
          {onAgendar && <button type="button" onClick={() => onAgendar(paciente)} aria-label="Agendar cita" className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-blue-700"><CalendarPlus size={18} aria-hidden="true" /> Agendar cita</button>}
          {onVender && <button type="button" onClick={() => onVender(paciente)} aria-label="Nueva venta" className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl px-3 text-base font-semibold text-emerald-700"><ShoppingCart size={18} aria-hidden="true" /> Nueva venta</button>}
        </div>
      )}
    </li>
  )
}
