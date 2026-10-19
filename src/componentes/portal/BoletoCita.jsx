"use client"

import { useRef, useState } from "react"
import { CalendarDays, CalendarPlus, ChevronRight, Check } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { fechaAISO } from "../../utilidades/disponibilidad"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { enCuantoTiempo } from "../../utilidades/portalVistas"
import { EstadoCita, CambiosDeCita, BotonCalendario, VerDetalle } from "./piezas"
import { useAnchoDe } from "./useAncho"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const diasHasta = (iso) => Math.round((new Date(iso + "T00:00:00Z") - new Date(fechaAISO(ahoraEcuador()) + "T00:00:00Z")) / 86400000)
const cuando = (iso) => { const d = diasHasta(iso); return d === 0 ? "hoy" : d === 1 ? "mañana" : enCuantoTiempo(d) }

// «Tu próxima cita», estilo boleto (diseño aprobado). Con espacio (el boleto mide 520 px o más): a la izquierda el bloque oscuro de 193 px con el día de la semana, el número
// grande y el mes; a la derecha «Tu próxima cita · en 7 días», la hora, el motivo, con quién es y las acciones. En el celular el boleto responde a su propio ancho: una franja
// oscura arriba con el día y la hora, y debajo el motivo, el estado y dos botones. `variante`: "resumen" (con la dirección; Cancelar como texto debajo) o "citas" (las acciones
// en una columna a la derecha). Sin cita, una invitación a agendar con un solo botón. Todo el boleto se pulsa y abre el detalle de la cita (`onAbrir`). «Agregar a mi calendario» se ofrece
// cuando tiene sentido —ya confirmada la asistencia— y cambia a «Agregada a tu calendario» cuando el paciente la agrega; antes de confirmar, la primera acción es «Confirmar asistencia».
export default function BoletoCita({ cita, detalle = null, detalleDisponible = false, direccion = "", citaProps = {}, onConfirmar, onAbrir, onAgendar, variante = "resumen", conBoton = true, ocultarConfirmar = false }) {
  const caja = useRef(null)
  const ancho = useAnchoDe(caja)
  // Sin medida (pruebas) vale la versión ancha.
  const ancha = ancho === 0 || ancho >= 520
  const dosColumnas = ancho === 0 || ancho >= 760
  // «Mis citas»: la próxima cita es una franja compacta (la pantalla es la lista de visitas, no la cita).
  const compacto = variante === "citas" && dosColumnas
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
  const confirmada = Boolean(detalle?.confirmadaAt)
  const [, mes, dia] = cita.fecha.split("-").map(Number)
  const semana = formatoFecha(cita.fecha, "largo").split(",")[0]
  const puedeConfirmar = detalleDisponible && !confirmada && cita.estado === "Pendiente"
  const enCalendario = Boolean(citaProps.calendarioAgregada?.(cita.id))
  const estadoCita = (sinIcono) => <EstadoCita estado={cita.estado} confirmada={confirmada} enCalendario={enCalendario} sinIcono={sinIcono} />
  const confirmar = async () => {
    setConfirmando(true); setErrorConfirmar("")
    const r = await onConfirmar(cita.id)
    setConfirmando(false)
    if (!r.ok) setErrorConfirmar(r.error)
  }
  const profesional = detalle?.profesional ? `Con ${detalle.profesional}` : ""
  const pie = <>
    {!ancha && <CambiosDeCita cita={cita} citaProps={citaProps} />}
    {errorConfirmar && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorConfirmar}</p>}
  </>
  const btnConfirmar = puedeConfirmar && !ocultarConfirmar && <button type="button" onClick={confirmar} disabled={confirmando} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{confirmando ? "Confirmando…" : "Confirmar asistencia"}</button>
  const verCalendario = confirmada || !puedeConfirmar
  const btnCalendario = verCalendario && <BotonCalendario cita={cita} citaProps={citaProps} principal={!btnConfirmar} corto={!ancha} ocultaAgregada />
  const abrir = onAbrir && <button type="button" onClick={() => onAbrir(cita)} aria-label="Ver el detalle de tu próxima cita" className="pt-abrir absolute inset-0 cursor-pointer" />
  const clase = "overflow-hidden rounded-[20px] border border-pt-borde bg-white " + (onAbrir ? "pt-abrible relative transition-shadow hover:shadow-md" : "")
  const btnReagendar = reagendable && <button type="button" onClick={() => citaProps.onReagendar?.(cita)} className={BOTON_SECUNDARIO}>Reagendar</button>
  const btnCancelar = (clase) => reagendable && <button type="button" onClick={() => citaProps.onCancelar?.(cita)} aria-label="Cancelar cita" className={clase}>Cancelar</button>
  const nota = !detalle?.confirmadaAt && cita.estado !== "Pendiente" ? NOTA_ESTADO_CITA[cita.estado] : ""

  // «Qué llevar a tu cita»: en el espacio libre del boleto, para que el paciente llegue con lo que el optómetra necesita.
  const queLlevar = cita.estado === "Pendiente" && (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <p className="text-base font-semibold text-pt-marino">Qué llevar a tu cita:</p>
      <ul aria-label="Qué llevar a tu cita" className="flex flex-wrap gap-2">
        {["Tus lentes actuales", "Llega 10 minutos antes"].map((t) => <li key={t} className="inline-flex items-center gap-1.5 rounded-full bg-pt-fondo px-3 py-1 text-base text-pt-marino"><Check size={16} strokeWidth={2.5} className="text-[#15803D]" aria-hidden="true" />{t}</li>)}
      </ul>
    </div>
  )

  // ── Celular ──
  if (!ancha) {
    return (
      <section ref={caja} aria-label="Tu próxima cita" className={clase}>
        {abrir}
        <div className="flex items-center gap-4 bg-pt-marino px-5 py-4 text-white">
          <span aria-hidden="true" className="flex flex-col items-center leading-none"><span className="font-heading text-5xl font-bold tabular-nums">{dia}</span><span className="mt-1 text-lg font-medium">{nombreMes(mes - 1, "corto")}</span></span>
          <div className="min-w-0">
            <p className="text-base font-medium text-white/80">Tu próxima cita · {semana.toLowerCase()}</p>
            <p className="font-heading text-[32px] font-bold leading-tight tabular-nums">{cita.hora}</p>
          </div>
          <p className="sr-only">{formatoFecha(cita.fecha, "largo")}</p>
          {onAbrir && <ChevronRight size={24} className="ml-auto shrink-0 text-white/70" aria-hidden="true" />}
        </div>
        <div className="space-y-3 p-5">
          <div>
            <p className="text-lg font-semibold leading-snug text-pt-marino">{cita.motivo || "Consulta"}</p>
            {profesional && <p className="text-base text-pt-texto">{profesional}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">{estadoCita(true)}{nota && <span className="text-base text-pt-texto">{nota}</span>}</div>
          {pie}
          {queLlevar}
          {(btnConfirmar || btnCalendario) && <div className="grid grid-cols-1 gap-3">{btnConfirmar}{btnCalendario}</div>}
          {reagendable && <div className="grid grid-cols-2 gap-3">{btnReagendar}{btnCancelar(BOTON_SECUNDARIO)}</div>}
        </div>
      </section>
    )
  }

  // ── Ancho ──
  const cabecera = <p className="text-base font-semibold text-pt-texto">Tu próxima cita · {cuando(cita.fecha)}</p>
  const hora = <p className="font-heading text-[33px] font-bold leading-none tabular-nums text-pt-marino">{cita.hora}</p>
  const motivo = <p className="text-lg font-semibold leading-snug text-pt-marino">{cita.motivo || "Consulta"}</p>
  // Si la óptica no deja cambiar la cita desde el portal (o ya falta poco), se dice en una línea con la salida por WhatsApp.
  const textoSinCambios = cita.estado === "Pendiente" && !reagendable ? (citaProps.cambiosPermitidos === false ? "¿Necesitas cambiarla?" : citaProps.avisoNoReagendable?.(cita)) : null
  const aviso = textoSinCambios && (
    <p className="text-base leading-snug text-pt-texto">{textoSinCambios}{" "}
      {citaProps.whatsappUrl ? <a href={citaProps.whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold text-pt-azul hover:underline">Escríbenos por WhatsApp</a> : citaProps.cambiosPermitidos === false ? "Comunícate con la óptica." : ""}
    </p>
  )
  const error = errorConfirmar && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorConfirmar}</p>
  const acciones = (btnConfirmar || btnCalendario || reagendable) && <div className={"flex flex-wrap gap-3 " + (compacto ? "" : "pt-1.5")}>{btnConfirmar}{btnCalendario}{btnReagendar}{btnCancelar(BOTON_SECUNDARIO)}</div>
  return (
    <section ref={caja} aria-label="Tu próxima cita" className={clase}>
      {abrir}
      <div className={"grid h-full " + (compacto ? "grid-cols-[128px_minmax(0,1fr)]" : "grid-cols-[193px_minmax(0,1fr)]")}>
        <div aria-hidden="true" className={"flex flex-col items-center justify-center bg-pt-marino px-3 text-center text-white " + (compacto ? "py-3" : "px-4 py-6")}>
          <span className="text-base font-medium text-white/85">{semana}</span>
          <span className={"font-heading font-bold leading-none tabular-nums " + (compacto ? "my-0.5 text-[48px]" : "my-1 text-[76px]")}>{dia}</span>
          <span className={compacto ? "text-base font-medium" : "text-xl font-medium"}>{nombreMes(mes - 1)}</span>
        </div>
        <div className={"flex min-w-0 flex-col " + (compacto ? "px-5 py-3.5 sm:px-6" : "p-6 sm:px-[30px] sm:py-7")}>
          <p className="sr-only">{formatoFecha(cita.fecha, "largo")}</p>
          {compacto ? (
            // Tres columnas: la fecha (el bloque oscuro); al centro la hora, el motivo, el profesional y qué llevar; a la derecha el estado y las acciones.
            <div className="grid h-full gap-x-8 gap-y-3 grid-cols-[minmax(0,1fr)_minmax(15rem,0.55fr)]">
              <div className="flex min-w-0 flex-col gap-1.5">
                {cabecera}
                <p className="font-heading text-[30px] font-bold leading-none tabular-nums text-pt-marino">{cita.hora}</p>
                <p className="text-lg font-semibold leading-snug text-pt-marino">{cita.motivo || "Consulta"}</p>
                {detalle?.profesional && <p className="text-base text-pt-texto">Con {detalle.profesional}</p>}
                {nota && <p className="text-base text-pt-texto">{nota}</p>}
                {queLlevar}
              </div>
              <div className="flex min-w-0 flex-col items-stretch gap-2.5 sm:items-end">
                {estadoCita(false)}
                {error}
                {(btnConfirmar || btnCalendario || reagendable) && <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[15rem]">{btnConfirmar}{btnCalendario}{btnReagendar}{btnCancelar(BOTON_SECUNDARIO)}</div>}
                {textoSinCambios && (citaProps.whatsappUrl
                  ? <a href={citaProps.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO + " w-full sm:w-auto sm:min-w-[15rem]"}>Escribir por WhatsApp</a>
                  : aviso)}
                <VerDetalle className="mt-auto">Ver detalle</VerDetalle>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">{cabecera}{estadoCita(false)}</div>
                {hora}
                {motivo}
                <p className="text-base leading-snug text-pt-texto">{[profesional, variante === "resumen" ? direccion : ""].filter(Boolean).join(" · ")}</p>
                {nota && <p className="text-base text-pt-texto">{nota}</p>}
                {queLlevar}
                {error}
                {acciones}
              </div>
              <div className="mt-auto flex items-center justify-between gap-4 border-t border-pt-borde pt-3">
                <div className="min-w-0">{aviso}</div>
                <VerDetalle className="shrink-0">Ver detalle</VerDetalle>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
