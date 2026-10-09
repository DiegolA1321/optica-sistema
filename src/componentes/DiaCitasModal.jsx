"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, CalendarPlus, Sparkles, Moon, LockOpen, Lock, Loader2 } from "lucide-react"
import AbrirDiaForm from "./AbrirDiaForm"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { formatoFecha } from "../utilidades/formatoFecha"
import { hoyISO, etiquetaFecha, minutosDesdeMedianoche, horaA12, diaTieneCupo, horarioEfectivo, diaAbierto, abiertoPorExcepcion, citasQueBloqueanCierre, mensajeCierreBloqueado, nombreDeDiaCerrado } from "../utilidades/disponibilidad"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { colorDe } from "./calendarioComun"
import { profesionalDeCita, mostrarProfesional } from "../utilidades/profesionalCita"

// Modal "Citas del día": se abre al hacer clic en un día (encabezado o zona libre de la Semana, o una casilla del Mes). Muestra
// las citas en orden de hora, con el color de su estado; un clic en una abre su detalle. Sin citas, un mensaje amable.
// "Agendar" abre el formulario con ese día (y la hora, si se hizo clic en una hora libre) ya elegidos; solo se ofrece si el día
// es de atención y todavía quedan horarios (hoy, si la jornada ya terminó, no se puede agendar).
// Un día cerrado se puede abrir solo para esa fecha (quien tiene "Mi horario: editar"): elige mañana y/o tarde y si admite reservas web.
// Un día abierto así se puede volver a cerrar mientras no tenga citas por atender.
export default function DiaCitasModal({ iso, minutos = null, citas = [], citasTodas = [], disponibilidad, equipo = [], vistaPropia = false, filtrado = false, puedeEditarHorario = false, abrirDirecto = false, onCerrar, onAbrirDetalle, onAgendar, onAbrirDia, onCerrarDia, onCerrarDiaConNombre }) {
  const refModal = useModalAccesible(true, onCerrar)
  const [abriendo, setAbriendo] = useState(abrirDirecto && puedeEditarHorario)
  const [guardando, setGuardando] = useState(false)
  const [cerrando, setCerrando] = useState(false) // cerrar un día de atención solo por esa fecha (feriado, por ejemplo)
  const [nombreCierre, setNombreCierre] = useState("")
  const hoy = hoyISO()
  const ordenadas = [...citas].sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
  const [diaSem] = formatoFecha(iso, "diaNumero").split(" ")
  const referencia = etiquetaFecha(iso)
  const caption = ["Hoy", "Mañana", "Ayer"].includes(referencia) ? referencia : null
  const esPasado = iso < hoy
  const diaLaborable = diaAbierto(horarioEfectivo(iso, disponibilidad))
  const hayCupo = diaTieneCupo(iso, disponibilidad, citasTodas)
  const puedeAgendar = !!onAgendar && !esPasado && hayCupo
  const puedeAbrir = puedeEditarHorario && !!onAbrirDia && !esPasado && !diaLaborable
  const cerradoSinPermiso = !puedeEditarHorario && !esPasado && !diaLaborable
  const bloquean = citasQueBloqueanCierre(citasTodas, iso)
  const puedeVolverACerrar = puedeEditarHorario && !!onCerrarDia && !esPasado && abiertoPorExcepcion(iso, disponibilidad)
  const nombreDelDia = nombreDeDiaCerrado(iso, disponibilidad)
  const puedeCerrarPuntual = puedeEditarHorario && !!onCerrarDiaConNombre && !esPasado && diaLaborable && !abiertoPorExcepcion(iso, disponibilidad)
  const confirmarApertura = async (sesiones, agendar) => {
    setGuardando(true)
    const ok = await onAbrirDia(iso, sesiones, agendar)
    setGuardando(false)
    if (ok) setAbriendo(false)
  }
  const confirmarCierre = async () => {
    setGuardando(true)
    const ok = await onCerrarDiaConNombre(iso, nombreCierre.trim())
    setGuardando(false)
    if (ok) { setCerrando(false); setNombreCierre("") }
  }
  const porEstado = ordenadas.reduce((acc, c) => { const k = colorDe(c.estado).etiqueta; acc[k] = (acc[k] || { n: 0, color: colorDe(c.estado) }); acc[k].n++; return acc }, {})
  const resumenHoras = ordenadas.length > 0 ? ` · de ${ordenadas[0].hora} a ${ordenadas[ordenadas.length - 1].hora}` : ""
  const horaSugerida = minutos != null ? horaA12(`${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`) : null

  const mensaje = filtrado
    ? { titulo: "Ninguna cita con estos filtros", texto: "Hay otros filtros activos: quítalos para ver todas las citas de este día." }
    : esPasado
      ? { titulo: "Sin citas este día", texto: "No hubo pacientes agendados en esta fecha." }
      : !diaLaborable
        ? { titulo: nombreDelDia || "Día sin atención", texto: "La óptica no atiende este día, así que no hay pacientes agendados." }
        : iso === hoy && !hayCupo
          ? { titulo: "La jornada de hoy ya terminó", texto: "No hubo pacientes agendados en lo que quedaba del día. Puedes agendar desde mañana." }
          : iso === hoy
            ? { titulo: "Hoy no hay pacientes agendados", texto: "La agenda de hoy está libre. Si alguien llega sin cita, puedes agendarlo ahora." }
            : { titulo: "Un día despejado", texto: "Todavía no hay pacientes agendados para este día. Es un buen momento para ofrecer un control o un seguimiento." }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="citas-modal-dia-titulo"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-[3.25rem] w-[3.25rem] shrink-0 flex-col items-center justify-center rounded-2xl text-white" style={{ background: GRAD_MARCA }} aria-hidden="true">
            <span className="text-[9px] font-bold uppercase leading-none tracking-widest">{diaSem}</span>
            <span className="text-xl font-bold leading-tight">{formatoFecha(iso, "dia").replace(/^0/, "")}</span>
            <span className="text-[9px] font-bold uppercase leading-none tracking-widest">{formatoFecha(iso, "mes")}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 id="citas-modal-dia-titulo" className="flex flex-wrap items-center gap-x-2 text-lg font-bold" style={{ color: INK }}>
              {abriendo ? `Abrir el ${formatoFecha(iso, "calendario").toLowerCase()}` : cerrando ? `Cerrar el ${formatoFecha(iso, "calendario").toLowerCase()}` : formatoFecha(iso, "calendario")}
              {!abriendo && !cerrando && caption && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: GRAD_MARCA }}>{caption}</span>}
            </h4>
            <p className="text-xs text-slate-500">
              {abriendo || cerrando ? "Solo este día · no cambia el horario de los demás días" : !diaLaborable && ordenadas.length === 0 ? (nombreDelDia ? `Cerrado · ${nombreDelDia}` : "Cerrado · día sin atención") : ordenadas.length === 0 ? "Sin citas" : `${ordenadas.length} ${ordenadas.length === 1 ? "cita" : "citas"}${resumenHoras}`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {cerrando ? (
            <div className="px-5 py-5">
              {bloquean.length > 0 ? (
                <p role="alert" className="rounded-xl bg-amber-50 px-3.5 py-3 text-sm font-medium text-amber-800">{mensajeCierreBloqueado(bloquean.length)}</p>
              ) : (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del día <span className="font-normal text-slate-500">(opcional)</span></span>
                  <input
                    type="text"
                    value={nombreCierre}
                    maxLength={60}
                    onChange={(e) => setNombreCierre(e.target.value)}
                    placeholder="Ej.: Feriado: Día de los Difuntos"
                    className="w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                  <span className="mt-1.5 block text-xs text-slate-500">Se muestra en el calendario y en Mi horario en lugar de solo «Cerrado».</span>
                </label>
              )}
              <div className="mt-5 flex items-center justify-between gap-2">
                <button type="button" onClick={() => setCerrando(false)} disabled={guardando} className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
                {bloquean.length === 0 && (
                  <button type="button" onClick={confirmarCierre} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                    {guardando ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />} Cerrar este día
                  </button>
                )}
              </div>
            </div>
          ) : abriendo ? (
            <AbrirDiaForm iso={iso} disponibilidad={disponibilidad} puedeAgendar={!!onAgendar} guardando={guardando} onConfirmar={confirmarApertura} onCancelar={() => setAbriendo(false)} />
          ) : ordenadas.length === 0 ? (
            <div className="px-8 py-10 text-center">
              {!diaLaborable && !esPasado && !filtrado ? (
                <div className="mx-auto mb-4 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-slate-100 text-slate-500"><Moon size={30} aria-hidden="true" /></div>
              ) : (
                <div className="mx-auto mb-4 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 text-blue-600">
                  <Sparkles size={30} aria-hidden="true" />
                </div>
              )}
              <p className="text-base font-bold" style={{ color: INK }}>{mensaje.titulo}</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">{mensaje.texto}</p>
              {puedeAbrir && !filtrado && (
                <button type="button" onClick={() => setAbriendo(true)} className="mt-5 inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD_MARCA }}>
                  <LockOpen size={14} aria-hidden="true" /> Abrir este día
                </button>
              )}
              {cerradoSinPermiso && !filtrado && <p className="mx-auto mt-4 max-w-xs text-xs text-slate-500">Pídele a un administrador que abra este día.</p>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-2.5">
                {Object.entries(porEstado).map(([etiqueta, { n, color }]) => (
                  <span key={etiqueta} className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: color.fondo, color: color.texto }}>{n} {etiqueta}</span>
                ))}
              </div>
              <ul>
                {ordenadas.map((c) => {
                  const color = colorDe(c.estado)
                  const prof = mostrarProfesional(c, vistaPropia) ? profesionalDeCita(c, equipo) : null
                  const nombreProf = prof && prof.tipo !== "sinAsignar" ? prof.nombre : null
                  return (
                    <li key={c.id} className="relative border-b border-slate-50 last:border-b-0">
                      <span className="absolute inset-y-2 left-0 w-1 rounded-r" style={{ backgroundColor: color.linea }} aria-hidden="true" />
                      <button
                        type="button"
                        onClick={() => onAbrirDetalle?.(c)}
                        className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <span className="w-[4.25rem] shrink-0 text-xs font-bold tabular-nums text-slate-700">{c.hora}</span>
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: GRAD_MARCA }} aria-hidden="true">{c.iniciales || "·"}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold" style={{ color: INK }}>{c.paciente}</span>
                          <span className="block truncate text-xs text-slate-500">{[c.motivo, nombreProf].filter(Boolean).join(" · ") || "Sin motivo"}</span>
                        </span>
                        <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ backgroundColor: color.fondo, color: color.texto }}>{color.etiqueta}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        {!abriendo && !cerrando && puedeCerrarPuntual && (
          <div className="flex shrink-0 items-center justify-center border-t border-slate-100 px-5 py-3">
            <button type="button" onClick={() => setCerrando(true)} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 underline-offset-2 transition-colors hover:text-slate-800 hover:underline cursor-pointer">
              <Lock size={12} aria-hidden="true" /> Cerrar este día (feriado u otro motivo)…
            </button>
          </div>
        )}

        {!abriendo && !cerrando && puedeVolverACerrar && (
          <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1 border-t border-slate-100 px-5 py-3 text-xs">
            <span className="text-slate-500">Este día se abrió solo para esta fecha.</span>
            <button
              type="button"
              disabled={bloquean.length > 0}
              onClick={() => onCerrarDia(iso)}
              className="inline-flex items-center gap-1 font-semibold text-slate-600 underline-offset-2 transition-colors hover:text-slate-800 hover:underline cursor-pointer disabled:cursor-not-allowed disabled:no-underline disabled:opacity-60"
            >
              <Lock size={12} aria-hidden="true" /> Volver a cerrarlo
            </button>
            {bloquean.length > 0 && <span role="note" className="basis-full text-center text-amber-700">{mensajeCierreBloqueado(bloquean.length)}</span>}
          </div>
        )}

        {!abriendo && !cerrando && puedeAgendar && (
          <div className="flex shrink-0 items-center justify-center border-t border-slate-100 px-5 py-4">
            <button type="button" onClick={() => onAgendar(iso, minutos)} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD_MARCA }}>
              <CalendarPlus size={14} aria-hidden="true" /> {horaSugerida ? `Agendar a las ${horaSugerida}` : "Agendar en este día"}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
