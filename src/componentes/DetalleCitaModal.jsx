"use client"

import { fechaHoraLegible, formatoFecha } from "../utilidades/formatoFecha"
import { useState } from "react"
import { createPortal } from "react-dom"
import { X, User, Stethoscope, CalendarPlus, Receipt, AlertTriangle, ExternalLink, CalendarClock, LogOut, UserX, DoorOpen, Undo2, CheckCircle2, Loader2, UserRoundPlus, Repeat } from "lucide-react"
import { INK } from "@/lib/tema"
import { hoyISO, etiquetaFecha } from "../utilidades/disponibilidad"
import { yaPasoLaHora } from "../utilidades/agendaCitas"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { urlPerfilPaciente } from "./calendarioComun"
import { profesionalDeCita, mostrarProfesional, esReasignable, esTomable } from "../utilidades/profesionalCita"
import { edadEnAnios } from "../utilidades/edad"
import { puedeCancelarCita, puedeAtenderCita, puedeEditarCita, puedeAgendarOtraCita, requiereConfirmarOtroDia } from "../utilidades/filtrosCitas"
import { diasAtencionAbierta, textoAtencionAbierta } from "../utilidades/atencionAbierta"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const BADGE_ESTADO = {
  "En Espera": "border-violet-200/60 bg-violet-50 text-violet-700",
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-600",
}
const BADGE_PENDIENTE = "border-amber-200/60 bg-amber-50 text-amber-700"
const ETIQUETA_ESTADO = { "En Espera": "En espera", "En Atención": "En atención", "No Asistió": "No asistió" }

// "4 oct 2026, 03:20 PM" a partir del created_at de la cita (timestamptz).
function fechaHoraAgendada(iso) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return fechaHoraLegible(d, { anio: true })
}

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold" style={{ color: INK }}>{children}</dd>
    </div>
  )
}

const Vacio = ({ children }) => <span className="font-normal text-slate-500">{children}</span>

function Columna({ titulo, children }) {
  return (
    <section aria-label={titulo} className="min-w-0 space-y-3">
      <h5 className="border-b border-slate-100 pb-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{titulo}</h5>
      <dl className="space-y-3">{children}</dl>
    </section>
  )
}

const BOTON_SECUNDARIO = "inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"

// Detalle completo de una cita (R12-R15, C15 de la reunión del 7 oct.): se abre al hacer clic en la cita. Va en tres
// columnas (la cita · el profesional · el paciente y su motivo), abajo el estado con la opción de cambiarlo y, al
// final, TODAS las acciones de la cita. "Atender"/"Retomar" entran directo a la ficha; "Llegó" pasa la cita a
// "En espera" (lo usa recepción, que no atiende) y "Ver perfil" abre el paciente en otra pestaña para no perder el
// lugar en la agenda. Cada acción solo aparece si se pasa su función (permisos) y la cita está en un estado que la admite.
export default function DetalleCitaModal({ cita, paciente = null, vistaPropia = false, equipo = [], fechaAtencionReal, cobroPendiente, marcandoEstado = false, preguntarOtroDia = false, onCerrar, onIngresar, onAgendarOtra, onCobrar, onEditar, onCancelar, onDejarDeAtender, onLlego, onNoLlego, onNoAsistio, onConfirmar, personasAsignables = [], ausenteEnLaHora, onReasignar, onTomar, onRegistrarPaciente, sinAnimarFondo = false }) {
  const refModal = useModalAccesible(true, onCerrar)
  // Cita de otro día: "Atender" pide un clic más ("¿Atenderla hoy?"); las de hoy entran directo a la ficha.
  const [confirmandoOtroDia, setConfirmandoOtroDia] = useState(preguntarOtroDia)
  // "Reasignar": quien tiene permiso de editar citas con alcance "todo" (lo decide Citas.jsx pasando onReasignar). Un clic en la persona.
  const [reasignando, setReasignando] = useState(false)
  const puedeReasignar = !!onReasignar && esReasignable(cita)
  const puedeTomar = !!onTomar && esTomable(cita)
  const destinos = personasAsignables.filter((m) => m.id !== cita.asignadoA)
  const otroDia = requiereConfirmarOtroDia(cita, hoyISO())
  const diaDeLaCita = cita.fecha ? formatoFecha(cita.fecha, "calendario", { enFrase: true }) : ""
  const alAtender = () => { if (otroDia && !confirmandoOtroDia) setConfirmandoOtroDia(true); else onIngresar(cita) }
  const puedeIngresar = puedeAtenderCita(cita) && !!onIngresar
  const puedeAgendarOtra = puedeAgendarOtraCita(cita) && !!onAgendarOtra
  const agendada = fechaHoraAgendada(cita.creadoEn)
  const triage = cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle)
    ? [cita.triage.sintomas?.join(", "), cita.triage.desdeCuando, cita.triage.detalle].filter(Boolean).join(" · ")
    : null
  // Cambios de estado a mano (la recepción): "Llegó" solo el día de la cita; "No asistió" solo mientras sigue pendiente y
  // ya pasó su hora (el sistema la marca sola a los 10 minutos; "En espera" no se marca sola).
  const puedeLlego = !!onLlego && cita.estado === "Pendiente" && cita.fecha === hoyISO()
  const puedeNoLlego = !!onNoLlego && cita.estado === "En Espera"
  const puedeNoAsistio = !!onNoAsistio && cita.estado === "Pendiente" && yaPasoLaHora(cita)
  const puedeConfirmar = !!onConfirmar && ["Pendiente", "En Espera"].includes(cita.estado) && !cita.confirmadaAt
  const hayCambioDeEstado = puedeLlego || puedeNoLlego || puedeNoAsistio || puedeConfirmar
  const etiquetaEstado = ETIQUETA_ESTADO[cita.estado] || cita.estado || "Pendiente"
  // Datos del paciente (la cita guarda los del momento de agendar; el expediente trae la edad y, a veces, el correo).
  const edad = edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento)
  const correoBruto = cita.correo || paciente?.correo || ""
  const correo = correoBruto && correoBruto !== "Sin Correo" ? correoBruto : ""
  const cedula = cita.cedula || paciente?.cedula
  const telefono = cita.telefono || paciente?.telefono
  const profesional = profesionalDeCita(cita, equipo)

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: sinAnimarFondo ? "none" : "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="detalle-cita-titulo"
        className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
              {cita.iniciales || <User size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <h4 id="detalle-cita-titulo" className="min-w-0 truncate text-lg font-bold" style={{ color: INK }}>{cita.paciente}</h4>
                <span role="status" aria-label={"Estado: " + etiquetaEstado} className={"shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (BADGE_ESTADO[cita.estado] || BADGE_PENDIENTE)}>{etiquetaEstado}</span>
              </div>
              <p className="truncate text-xs text-slate-500">Detalle de la cita{cita.codigo && <> · <span className="font-mono">{cita.codigo}</span></>}</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
            <Columna titulo="La cita">
              <Dato etiqueta="Fecha">
                {cita.fecha ? formatoFecha(cita.fecha, "largo") : "Sin fecha"}
                {["Hoy", "Mañana", "Ayer"].includes(etiquetaFecha(cita.fecha)) && <span className="mt-0.5 block text-xs font-normal text-slate-500">{etiquetaFecha(cita.fecha)}</span>}
              </Dato>
              <Dato etiqueta="Hora">{cita.hora}</Dato>
              <Dato etiqueta="Motivo">
                {cita.motivo || <Vacio>Sin motivo</Vacio>}
                {cita.motivoPublico && <span className="mt-0.5 block text-xs font-normal text-slate-500">Indicado en línea: {cita.motivoPublico}</span>}
              </Dato>
              <Dato etiqueta="Origen">{cita.origen === "paciente" ? "Web (agendó el paciente)" : "Recepción"}</Dato>
            </Columna>

            <Columna titulo="Seguimiento">
              {mostrarProfesional(cita, vistaPropia) && (
                <Dato etiqueta="Profesional">
                  {profesional.tipo === "sinAsignar" ? (
                    <span className="inline-flex items-center rounded-md border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">Sin asignar</span>
                  ) : profesional.tipo === "enLugarDe" ? (
                    <>
                      {profesional.verbo} {profesional.nombre}
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">en lugar de {profesional.enLugarDe}</span>
                    </>
                  ) : (
                    <>
                      {profesional.nombre}
                      {profesional.reasignadaDe && <span className="mt-0.5 block text-xs font-normal text-slate-500">Reasignada de {profesional.reasignadaDe}</span>}
                    </>
                  )}
                </Dato>
              )}
              {fechaAtencionReal && fechaAtencionReal !== cita.fecha && <Dato etiqueta="Atendida el">{formatoFecha(fechaAtencionReal, "largo")}</Dato>}
              <Dato etiqueta="Agendada el">{agendada || <Vacio>Sin registro</Vacio>}</Dato>
              {cita.confirmadaAt && <Dato etiqueta="Confirmada el">{fechaHoraAgendada(cita.confirmadaAt) || "Sí"}</Dato>}
              {cita.estado === "Cancelada" && cita.canceladaPor && (
                <Dato etiqueta="Cancelada por">{cita.canceladaPor === "recepcion" ? "Recepción" : "El paciente"}</Dato>
              )}
            </Columna>

            <Columna titulo="Paciente">
              {cedula && <Dato etiqueta="Cédula"><span className="font-mono">{cedula}</span></Dato>}
              {telefono && <Dato etiqueta="Teléfono">{telefono}</Dato>}
              {edad !== null && <Dato etiqueta="Edad">{edad} {edad === 1 ? "año" : "años"}</Dato>}
              {correo && <Dato etiqueta="Correo">{correo}</Dato>}
              {!cedula && !telefono && edad === null && !correo && <Dato etiqueta="Contacto"><Vacio>Sin datos</Vacio></Dato>}
            </Columna>
          </div>

          {(triage || diasAtencionAbierta(cita) !== null || cobroPendiente) && (
            <div className="mt-5 space-y-2">
              {triage && (
                <p className="flex items-start gap-1.5 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Pre-triage: {triage}
                </p>
              )}
              {diasAtencionAbierta(cita) !== null && (
                <p className="flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                  <AlertTriangle size={13} aria-hidden="true" /> {textoAtencionAbierta(diasAtencionAbierta(cita))}
                </p>
              )}
              {cobroPendiente && (
                <p className="flex items-center gap-1.5 rounded-lg border border-amber-300/70 bg-amber-100 px-3 py-2 text-xs font-bold text-amber-800">
                  <Receipt size={13} aria-hidden="true" /> Cobro pendiente
                </p>
              )}
            </div>
          )}

          {hayCambioDeEstado && (
          <section aria-label="Cambiar el estado de la cita" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl border border-slate-200/60 bg-slate-50/60 px-4 py-3">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Estado</span>
            {hayCambioDeEstado && (
              <div className="flex flex-wrap items-center gap-2 sm:ml-auto" role="group" aria-label="Cambiar el estado">
                {marcandoEstado && <Loader2 size={15} className="animate-spin text-slate-500" aria-hidden="true" />}
                {puedeLlego && (
                  <button type="button" disabled={marcandoEstado} onClick={() => onLlego(cita)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200/70 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                    <DoorOpen size={14} aria-hidden="true" /> Llegó
                  </button>
                )}
                {puedeNoLlego && (
                  <button type="button" disabled={marcandoEstado} onClick={() => onNoLlego(cita)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                    <Undo2 size={14} aria-hidden="true" /> Aún no llegó
                  </button>
                )}
                {puedeNoAsistio && (
                  <button type="button" disabled={marcandoEstado} onClick={() => onNoAsistio(cita)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200/70 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                    <UserX size={14} aria-hidden="true" /> No asistió
                  </button>
                )}
                {puedeConfirmar && (
                  <button type="button" onClick={() => onConfirmar(cita)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer">
                    <CheckCircle2 size={14} aria-hidden="true" /> Marcar como confirmada
                  </button>
                )}
              </div>
            )}
          </section>
          )}
        </div>

        {confirmandoOtroDia && otroDia && puedeIngresar && (
          <div role="group" aria-label="Atender una cita de otro día" className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-blue-100 bg-blue-50/70 px-6 py-3">
            <p className="text-sm font-semibold text-blue-900">
              Esta cita es del {diaDeLaCita}. ¿Atenderla hoy?
              <span className="ml-1 text-xs font-normal text-blue-800/80">La fecha agendada no cambia.</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setConfirmandoOtroDia(false)} className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">No</button>
              <button type="button" onClick={() => onIngresar(cita)} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                <Stethoscope size={14} aria-hidden="true" /> Atenderla hoy
              </button>
            </div>
          </div>
        )}

        {reasignando && puedeReasignar && (
          <div className="shrink-0 border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Pasar la cita a</p>
            <div className="flex flex-wrap gap-2">
              {destinos.length === 0 && <span className="text-sm text-slate-500">No hay otra persona activa a quien pasarla.</span>}
              {destinos.map((m) => {
                const ausente = !!ausenteEnLaHora?.(m.id, cita)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => { setReasignando(false); onReasignar(cita, m.id) }}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-blue-50 cursor-pointer"
                  >
                    {m.nombre}
                    {ausente && <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">ausente a esa hora</span>}
                  </button>
                )
              })}
              {cita.asignadoA && (
                <button
                  type="button"
                  onClick={() => { setReasignando(false); onReasignar(cita, null) }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
                >
                  Dejar sin asignar
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 px-6 py-4" role="group" aria-label="Acciones de la cita">
          {cita.pacienteId && (
            <a href={urlPerfilPaciente(cita.pacienteId)} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}>
              <ExternalLink size={14} aria-hidden="true" /> Ver perfil
            </a>
          )}
          {!cita.pacienteId && onRegistrarPaciente && (
            <button type="button" onClick={() => onRegistrarPaciente(cita)} className={BOTON_SECUNDARIO}>
              <UserRoundPlus size={14} aria-hidden="true" /> Registrar paciente
            </button>
          )}
          {puedeReasignar && (
            <button type="button" onClick={() => setReasignando((v) => !v)} aria-expanded={reasignando} className={BOTON_SECUNDARIO}>
              <Repeat size={14} aria-hidden="true" /> Reasignar
            </button>
          )}
          {puedeEditarCita(cita) && onEditar && (
            <button type="button" onClick={() => onEditar(cita)} className={BOTON_SECUNDARIO}>
              <CalendarClock size={14} aria-hidden="true" /> Editar cita
            </button>
          )}
          {cita.estado === "En Atención" && onDejarDeAtender && (
            <button type="button" onClick={() => onDejarDeAtender(cita)} className={BOTON_SECUNDARIO}>
              <LogOut size={14} aria-hidden="true" /> Dejar de atender
            </button>
          )}
          {puedeCancelarCita(cita) && onCancelar && (
            <button type="button" onClick={() => onCancelar(cita)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200/70 bg-white px-3.5 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
              <X size={14} aria-hidden="true" /> Cancelar cita
            </button>
          )}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {puedeTomar && (
              <button type="button" onClick={() => onTomar(cita)} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200/70 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer">
                <UserRoundPlus size={14} aria-hidden="true" /> Tomar esta cita
              </button>
            )}
            {puedeAgendarOtra && (
              <button type="button" onClick={() => onAgendarOtra(cita)} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200/70 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer">
                <CalendarPlus size={14} aria-hidden="true" /> Agendar otra cita
              </button>
            )}
            {cobroPendiente ? (
              <button type="button" onClick={() => onCobrar(cita)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
                <Receipt size={14} aria-hidden="true" /> Cobrar
              </button>
            ) : puedeIngresar && (
              <button type="button" onClick={alAtender} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                <Stethoscope size={14} aria-hidden="true" /> {cita.estado === "En Atención" ? "Retomar" : "Atender"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
