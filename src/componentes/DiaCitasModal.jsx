"use client"

import { createPortal } from "react-dom"
import { X, CalendarPlus, CalendarDays, Sparkles } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { formatoFecha } from "../utilidades/formatoFecha"
import { hoyISO, etiquetaFecha, minutosDesdeMedianoche, horaA12 } from "../utilidades/disponibilidad"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { colorDe } from "./calendarioComun"
import { profesionalDeCita, mostrarProfesional } from "../utilidades/profesionalCita"

// Modal "Citas del día": se abre al hacer clic en un día (encabezado o zona libre de la Semana, o una casilla del Mes). Muestra
// las citas en orden de hora, con el color de su estado; un clic en una abre su detalle. Sin citas, un mensaje amable.
// "Agendar" abre el formulario con ese día (y la hora, si se hizo clic en una hora libre) ya elegidos.
export default function DiaCitasModal({ iso, minutos = null, citas = [], equipo = [], vistaPropia = false, filtrado = false, onCerrar, onAbrirDetalle, onAgendar, onVerSemana }) {
  const refModal = useModalAccesible(true, onCerrar)
  const hoy = hoyISO()
  const ordenadas = [...citas].sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
  const [diaSem] = formatoFecha(iso, "diaNumero").split(" ")
  const referencia = etiquetaFecha(iso)
  const caption = ["Hoy", "Mañana", "Ayer"].includes(referencia) ? referencia : null
  const esPasado = iso < hoy
  const porEstado = ordenadas.reduce((acc, c) => { const k = colorDe(c.estado).etiqueta; acc[k] = (acc[k] || { n: 0, color: colorDe(c.estado) }); acc[k].n++; return acc }, {})
  const resumenHoras = ordenadas.length > 0 ? ` · de ${ordenadas[0].hora} a ${ordenadas[ordenadas.length - 1].hora}` : ""
  const horaSugerida = minutos != null ? horaA12(`${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`) : null

  const mensaje = filtrado
    ? { titulo: "Ninguna cita con estos filtros", texto: "Hay otros filtros activos: quítalos para ver todas las citas de este día." }
    : esPasado
      ? { titulo: "Sin citas este día", texto: "No hubo pacientes agendados en esta fecha." }
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
              {formatoFecha(iso, "calendario")}
              {caption && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: GRAD_MARCA }}>{caption}</span>}
            </h4>
            <p className="text-xs text-slate-500">
              {ordenadas.length === 0 ? "Sin citas" : `${ordenadas.length} ${ordenadas.length === 1 ? "cita" : "citas"}${resumenHoras}`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {ordenadas.length === 0 ? (
            <div className="px-8 py-10 text-center">
              <div className="mx-auto mb-4 grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 text-blue-600">
                <Sparkles size={30} aria-hidden="true" />
              </div>
              <p className="text-base font-bold" style={{ color: INK }}>{mensaje.titulo}</p>
              <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-slate-500">{mensaje.texto}</p>
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

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
          {onVerSemana ? (
            <button type="button" onClick={onVerSemana} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
              <CalendarDays size={14} aria-hidden="true" /> Ver esta semana
            </button>
          ) : <span />}
          {onAgendar && !esPasado && (
            <button type="button" onClick={() => onAgendar(iso, minutos)} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD_MARCA }}>
              <CalendarPlus size={14} aria-hidden="true" /> {horaSugerida ? `Agendar a las ${horaSugerida}` : "Agendar en este día"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
