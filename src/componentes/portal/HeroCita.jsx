"use client"

import { CalendarClock, CalendarPlus, X, CalendarDays, Sparkles } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { EstadoCita } from "./piezas"
import { BOTON_SOBRE_OSCURO, BOTON_BORDE_BLANCO } from "./estilos"

// La tarjeta destacada del portal: lo más importante del momento. Con una cita próxima, el día, la fecha y la hora en grande (con reagendar o cancelar si se puede);
// sin cita, una invitación clara a agendar; si el paciente es nuevo, la bienvenida con un solo botón. El fondo es el color de la óptica, siempre oscuro para que el texto blanco se lea.
export default function HeroCita({ cita, nuevo = false, nombreOptica, citaProps = {}, onAgendar }) {
  const reagendable = cita && citaProps.puedeReagendar?.(cita)
  const aviso = cita && !reagendable ? citaProps.avisoNoReagendable?.(cita) : null
  const base = "relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-8"
  const fondo = { background: "var(--portal-hero)" }
  const adorno = <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10" />

  if (nuevo) {
    return (
      <section aria-label="Lo próximo" className={base} style={fondo}>
        {adorno}
        <p className="flex items-center gap-2 text-lg font-semibold text-white/85"><Sparkles size={22} aria-hidden="true" /> Bienvenido</p>
        <h2 id="hero" className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">Te damos la bienvenida a {nombreOptica}</h2>
        <p className="mt-3 max-w-xl text-lg text-white/90">Aquí vas a ver tus citas, tu receta, el estado de tus lentes y lo que debes. Empieza agendando tu primera cita.</p>
        <button type="button" onClick={() => onAgendar()} className={BOTON_SOBRE_OSCURO + " mt-6 w-full sm:w-auto"}><CalendarPlus size={22} aria-hidden="true" /> Agendar mi primera cita</button>
      </section>
    )
  }

  if (!cita) {
    return (
      <section aria-label="Lo próximo" className={base} style={fondo}>
        {adorno}
        <p className="flex items-center gap-2 text-lg font-semibold text-white/85"><CalendarDays size={22} aria-hidden="true" /> Lo próximo</p>
        <h2 id="hero" className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">No tienes ninguna cita agendada</h2>
        <p className="mt-3 max-w-xl text-lg text-white/90">Elige el día y la hora que más te convengan. Te toma un minuto.</p>
        <button type="button" onClick={() => onAgendar()} className={BOTON_SOBRE_OSCURO + " mt-6 w-full sm:w-auto"}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>
      </section>
    )
  }

  return (
    <section aria-label="Lo próximo" className={base} style={fondo}>
      {adorno}
      <p className="flex items-center gap-2 text-lg font-semibold text-white/85"><CalendarDays size={22} aria-hidden="true" /> Lo próximo · tu cita</p>
      <h2 id="hero" className="mt-2 font-heading text-3xl font-bold leading-tight sm:text-4xl">{formatoFecha(cita.fecha, "largo")}</h2>
      <p className="mt-1 text-4xl font-bold tabular-nums sm:text-5xl">{cita.hora}</p>
      <p className="mt-3 text-xl text-white/95">{cita.motivo || "Consulta"}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <EstadoCita estado={cita.estado} />
        <span className="text-lg text-white/90">{NOTA_ESTADO_CITA[cita.estado]}</span>
      </div>
      {aviso && <p className="mt-3 rounded-xl bg-white/15 px-4 py-3 text-lg">{aviso}</p>}
      {reagendable && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={() => citaProps.onReagendar?.(cita)} className={BOTON_SOBRE_OSCURO}><CalendarClock size={22} aria-hidden="true" /> Reagendar</button>
          <button type="button" onClick={() => citaProps.onCancelar?.(cita)} className={BOTON_BORDE_BLANCO}><X size={22} aria-hidden="true" /> Cancelar cita</button>
        </div>
      )}
    </section>
  )
}
