"use client"

import { useRef, useState } from "react"
import { CalendarDays, CalendarPlus } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { fechaAISO } from "../../utilidades/disponibilidad"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { enCuantoTiempo } from "../../utilidades/portalVistas"
import { EstadoCita } from "./piezas"
import { useAnchoDe } from "./useAncho"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const diasHasta = (iso) => Math.round((new Date(iso + "T00:00:00Z") - new Date(fechaAISO(ahoraEcuador()) + "T00:00:00Z")) / 86400000)
const cuando = (iso) => { const d = diasHasta(iso); return d === 0 ? "hoy" : d === 1 ? "mañana" : enCuantoTiempo(d) }

// «Tu próxima cita», estilo boleto (diseño aprobado). Con espacio (el boleto mide 520 px o más): a la izquierda el bloque oscuro de 193 px con el día de la semana, el número
// grande y el mes; a la derecha «Tu próxima cita · en 7 días», la hora, el motivo, con quién es y las acciones. En el celular el boleto responde a su propio ancho: una franja
// oscura arriba con el día y la hora, y debajo el motivo, el estado y dos botones. `variante`: "resumen" (con la dirección; Cancelar como texto debajo) o "citas" (las acciones
// en una columna a la derecha). Sin cita, una invitación a agendar con un solo botón.
export default function BoletoCita({ cita, detalle = null, detalleDisponible = false, direccion = "", citaProps = {}, onConfirmar, onIcs, onAgendar, variante = "resumen", conBoton = true }) {
  const caja = useRef(null)
  const ancho = useAnchoDe(caja)
  // Sin medida (pruebas) vale la versión ancha.
  const ancha = ancho === 0 || ancho >= 520
  const dosColumnas = ancho === 0 || ancho >= 760
  const [confirmando, setConfirmando] = useState(false)
  const [errorConfirmar, setErrorConfirmar] = useState("")

  if (!cita) {
    return (
      <section ref={caja} aria-label="Tu próxima cita" className="overflow-hidden rounded-[20px] border border-pt-borde bg-white">
        <div className={ancha ? "grid grid-cols-[193px_minmax(0,1fr)]" : ""}>
          <div className="flex items-center justify-center bg-pt-marino p-6 text-white"><CalendarDays size={ancha ? 72 : 44} aria-hidden="true" strokeWidth={1.5} /></div>
          <div className="space-y-3 p-6 sm:p-8">
            <h2 className="text-base font-semibold text-pt-texto">Tu próxima cita</h2>
            <p className="font-heading text-2xl font-bold leading-tight text-pt-marino sm:text-3xl">Aún no tienes una cita agendada</p>
            <p className="max-w-xl text-base text-pt-texto">Elige el día y la hora que más te convengan. Te toma un minuto y te la recordamos antes de que llegue.</p>
            {conBoton && <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>}
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
  const profesional = detalle?.profesional ? `Con ${detalle.profesional}` : ""
  const pie = <>
    {aviso && <p className="rounded-xl bg-pt-fondo px-4 py-3 text-base text-pt-texto">{aviso}</p>}
    {errorConfirmar && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorConfirmar}</p>}
  </>
  const btnConfirmar = puedeConfirmar && <button type="button" onClick={confirmar} disabled={confirmando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{confirmando ? "Confirmando…" : "Confirmar asistencia"}</button>
  const btnCalendario = (texto) => <button type="button" onClick={() => onIcs(cita)} aria-label="Agregar a mi calendario" className={btnConfirmar ? BOTON_SECUNDARIO : BOTON_PRINCIPAL} style={btnConfirmar ? undefined : ESTILO_PRINCIPAL}>{texto}</button>
  const btnReagendar = reagendable && <button type="button" onClick={() => citaProps.onReagendar?.(cita)} className={BOTON_SECUNDARIO}>Reagendar</button>
  const btnCancelar = (clase) => reagendable && <button type="button" onClick={() => citaProps.onCancelar?.(cita)} aria-label="Cancelar cita" className={clase}>Cancelar</button>
  const nota = !detalle?.confirmadaAt && cita.estado !== "Pendiente" ? NOTA_ESTADO_CITA[cita.estado] : ""

  // ── Celular ──
  if (!ancha) {
    return (
      <section ref={caja} aria-label="Tu próxima cita" className="overflow-hidden rounded-[20px] border border-pt-borde bg-white">
        <div className="flex items-center gap-4 bg-pt-marino px-5 py-4 text-white">
          <span aria-hidden="true" className="flex flex-col items-center leading-none"><span className="font-heading text-5xl font-bold tabular-nums">{dia}</span><span className="mt-1 text-lg font-medium">{nombreMes(mes - 1, "corto")}</span></span>
          <div className="min-w-0">
            <p className="text-base font-medium text-white/80">Tu próxima cita · {semana.toLowerCase()}</p>
            <p className="font-heading text-[32px] font-bold leading-tight tabular-nums">{cita.hora}</p>
          </div>
          <p className="sr-only">{formatoFecha(cita.fecha, "largo")}</p>
        </div>
        <div className="space-y-3 p-5">
          <div>
            <p className="text-lg font-semibold leading-snug text-pt-marino">{cita.motivo || "Consulta"}</p>
            {profesional && <p className="text-base text-pt-texto">{profesional}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2"><EstadoCita estado={cita.estado} confirmada={confirmada} sinIcono />{nota && <span className="text-base text-pt-texto">{nota}</span>}</div>
          {pie}
          {btnConfirmar && <div className="grid grid-cols-1">{btnConfirmar}</div>}
          <div className={"grid gap-3 " + (reagendable ? "grid-cols-2" : "grid-cols-1")}>
            {btnReagendar}
            {btnCalendario(reagendable ? "A mi calendario" : "Agregar a mi calendario")}
          </div>
          {variante === "citas" && btnCancelar(BOTON_SECUNDARIO + " w-full")}
        </div>
      </section>
    )
  }

  // ── Ancho ──
  const cabecera = <p className="text-base font-semibold text-pt-texto">Tu próxima cita · {cuando(cita.fecha)}</p>
  const hora = <p className="font-heading text-[33px] font-bold leading-none tabular-nums text-pt-marino">{cita.hora}</p>
  const motivo = <p className="text-lg font-semibold leading-snug text-pt-marino">{cita.motivo || "Consulta"}</p>
  return (
    <section ref={caja} aria-label="Tu próxima cita" className="overflow-hidden rounded-[20px] border border-pt-borde bg-white">
      <div className="grid h-full grid-cols-[193px_minmax(0,1fr)]">
        <div aria-hidden="true" className="flex flex-col items-center justify-center bg-pt-marino px-4 py-6 text-center text-white">
          <span className="text-base font-medium text-white/85">{semana}</span>
          <span className="my-1 font-heading text-[76px] font-bold leading-none tabular-nums">{dia}</span>
          <span className="text-xl font-medium">{nombreMes(mes - 1)}</span>
        </div>
        <div className="min-w-0 p-6 sm:px-[30px] sm:py-7">
          <p className="sr-only">{formatoFecha(cita.fecha, "largo")}</p>
          {variante === "citas" && dosColumnas ? (
            <div className="grid h-full grid-cols-[minmax(0,1fr)_auto] gap-x-8">
              <div className="flex flex-col justify-center gap-2.5">{cabecera}{hora}{motivo}{profesional && <p className="text-base text-pt-texto">{profesional}</p>}{nota && <p className="text-base text-pt-texto">{nota}</p>}{pie}</div>
              <div className="flex w-[244px] flex-col gap-3">
                <div className="flex justify-start"><EstadoCita estado={cita.estado} confirmada={confirmada} /></div>
                {btnConfirmar}
                {btnCalendario("Agregar a mi calendario")}
                <div className="grid grid-cols-2 gap-3">{btnReagendar}{btnCancelar(BOTON_SECUNDARIO)}</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-start justify-between gap-2">{cabecera}<EstadoCita estado={cita.estado} confirmada={confirmada} /></div>
              {hora}
              {motivo}
              <p className="text-base leading-snug text-pt-texto">{[profesional, variante === "resumen" ? direccion : ""].filter(Boolean).join(" · ")}</p>
              {nota && <p className="text-base text-pt-texto">{nota}</p>}
              {pie}
              <div className="flex flex-wrap gap-3 pt-1.5">{btnConfirmar}{btnCalendario("Agregar a mi calendario")}{btnReagendar}</div>
              {btnCancelar("inline-flex min-h-11 items-center px-8 text-base font-semibold text-pt-texto hover:underline cursor-pointer -mt-1")}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
