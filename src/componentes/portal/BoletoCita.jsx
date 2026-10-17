"use client"

import { useState } from "react"
import { CalendarClock, CalendarPlus, X, CalendarCheck, Download, MapPin, UserRound, BadgeCheck, CalendarDays } from "lucide-react"
import { INK } from "@/lib/tema"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { EstadoCita } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_PELIGRO, ESTILO_PRINCIPAL } from "./estilos"

// «Tu próxima cita», estilo boleto: a la izquierda el día en número grande (con el mes y el día de la semana) sobre el color de la óptica; a la derecha, la hora, el motivo,
// con quién es y dónde, y las acciones. Sin cita, una invitación cálida a agendar con un solo botón.
export default function BoletoCita({ cita, detalle = null, detalleDisponible = false, direccion = "", citaProps = {}, onConfirmar, onIcs, onAgendar }) {
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmar, setErrorConfirmar] = useState("")

  if (!cita) {
    return (
      <section aria-label="Tu próxima cita" className="pt-boleto-zona overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
       <div className="pt-boleto">
        <div className="flex items-center justify-center p-6 text-white" style={{ background: "var(--portal-hero)" }}>
          <CalendarDays size={72} aria-hidden="true" strokeWidth={1.5} />
        </div>
        <div className="space-y-3 p-6 sm:p-8">
          <h2 className="text-lg font-bold" style={{ color: INK }}>Tu próxima cita</h2>
          <p className="font-heading text-3xl font-bold leading-tight" style={{ color: INK }}>Aún no tienes una cita agendada</p>
          <p className="max-w-xl text-lg text-slate-700">Elige el día y la hora que más te convengan. Te toma un minuto y te la recordamos antes de que llegue.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>
        </div>
       </div>
      </section>
    )
  }

  const reagendable = citaProps.puedeReagendar?.(cita)
  const aviso = !reagendable ? citaProps.avisoNoReagendable?.(cita) : null
  const confirmada = Boolean(detalle?.confirmadaAt)
  const [, mes, dia] = cita.fecha.split("-").map(Number)
  const semana = formatoFecha(cita.fecha, "largo").split(",")[0]
  const puedeConfirmar = detalleDisponible && !confirmada && cita.estado === "Pendiente"
  const confirmar = async () => {
    setConfirmando(true); setErrorConfirmar("")
    const r = await onConfirmar(cita.id)
    setConfirmando(false)
    if (!r.ok) setErrorConfirmar(r.error)
  }

  return (
    <section aria-label="Tu próxima cita" className="pt-boleto-zona overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
     <div className="pt-boleto">
      <div className="pt-boleto-dia flex items-center gap-4 p-5 text-white" style={{ background: "var(--portal-hero)" }} aria-hidden="true">
        <span className="text-lg font-semibold uppercase tracking-wide text-white/85">{semana}</span>
        <span className="pt-num font-heading text-6xl font-bold leading-none tabular-nums">{dia}</span>
        <span className="text-xl font-semibold capitalize">{nombreMes(mes - 1)}</span>
      </div>
      <div className="min-w-0 space-y-3 p-5 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold" style={{ color: INK }}>Tu próxima cita</h2>
          <EstadoCita estado={cita.estado} />
        </div>
        <p className="sr-only">{formatoFecha(cita.fecha, "largo")}</p>
        <p className="font-heading text-4xl font-bold leading-none tabular-nums" style={{ color: INK }}>{cita.hora}</p>
        <p className="text-xl font-semibold text-slate-800">{cita.motivo || "Consulta"}</p>
        <ul className="space-y-1.5 text-lg text-slate-700">
          {detalle?.profesional && <li className="flex items-start gap-2.5"><UserRound size={22} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /> Con {detalle.profesional}</li>}
          {direccion && <li className="flex items-start gap-2.5"><MapPin size={22} className="mt-0.5 shrink-0 text-slate-500" aria-hidden="true" /> {direccion}</li>}
          {confirmada
            ? <li className="flex items-start gap-2.5 font-semibold text-emerald-700"><BadgeCheck size={22} className="mt-0.5 shrink-0" aria-hidden="true" /> Asistencia confirmada</li>
            : <li className="text-slate-600">{NOTA_ESTADO_CITA[cita.estado]}</li>}
        </ul>
        {aviso && <p className="rounded-xl bg-slate-50 px-4 py-3 text-base text-slate-700">{aviso}</p>}
        {errorConfirmar && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorConfirmar}</p>}
        <div className="flex flex-wrap gap-2.5 pt-1">
          {puedeConfirmar && <button type="button" onClick={confirmar} disabled={confirmando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}><CalendarCheck size={22} aria-hidden="true" /> {confirmando ? "Confirmando…" : "Confirmar asistencia"}</button>}
          {reagendable && <button type="button" onClick={() => citaProps.onReagendar?.(cita)} className={BOTON_SECUNDARIO}><CalendarClock size={20} aria-hidden="true" /> Reagendar</button>}
          {reagendable && <button type="button" onClick={() => citaProps.onCancelar?.(cita)} className={BOTON_PELIGRO}><X size={20} aria-hidden="true" /> Cancelar cita</button>}
          <button type="button" onClick={() => onIcs(cita)} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Agregar a mi calendario</button>
        </div>
      </div>
     </div>
    </section>
  )
}
