"use client"

import { etiquetaEstadoCita } from "../utilidades/estadosCita"
import { formatoFecha } from "../utilidades/formatoFecha"
import { useState } from "react"
import { X, User, Stethoscope, CalendarPlus, Receipt, AlertTriangle, ExternalLink, CalendarClock, LogOut, UserX, DoorOpen, Undo2, Loader2, UserRoundPlus, Repeat, UserCheck } from "lucide-react"
import { INK } from "@/lib/tema"
import { hoyISO, etiquetaFecha } from "../utilidades/disponibilidad"
import { Cascaron } from "./AtencionPaciente"
import { urlPerfilPaciente } from "./calendarioComun"
import { profesionalDeCita, mostrarProfesional, esReasignable, esTomable } from "../utilidades/profesionalCita"
import { edadEnAnios } from "../utilidades/edad"
import { puedeCancelarCita, puedeIngresarCita, puedeEditarCita, puedeAgendarOtraCita } from "../utilidades/filtrosCitas"
import { seguimientoDeCita, cuandoDeEvento, detalleDeEvento, sufijoDeEvento, TITULO_EVENTO } from "../utilidades/seguimientoCita"
import { useEventosDeCita } from "../utilidades/eventosCita"
import { yaTerminoSuHorario } from "../utilidades/agendaCitas"
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

function Dato({ etiqueta, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
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

// Detalle completo de una cita (reunión del 20 oct., CIT-11): tres columnas en el orden de lo que se pregunta —quién (Paciente, con «Ver perfil» debajo), qué
// (Cita) y qué pasó (Seguimiento, una línea de tiempo con fecha, hora y quién)— y abajo TODAS las acciones. «Atender» / «Seguir atendiendo» entran directo a la
// ficha (la guardia de otro día y de la siguiente cita la hace quien recibe onIngresar); «Llegó» pasa la cita a «En espera» (lo usa recepción, que no atiende).
// «Ver perfil» abre el paciente en otra pestaña para no perder el lugar en la agenda. Cada acción solo aparece si se pasa su función (permisos) y la cita está
// en un estado que la admite.
export default function DetalleCitaModal({ cita, paciente = null, vistaPropia = false, equipo = [], fechaAtencionReal, cobroPendiente, marcandoEstado = false, eventos: eventosPropios, duracionDefault = 40, onCerrar, onIngresar, onAgendarOtra, onCobrar, onEditar, onCancelar, onDejarDeAtender, onLlego, onNoLlego, onNoAsistio, personasAsignables = [], ausenteEnLaHora, onReasignar, onTomar, onRegistrarPaciente, onConfirmarDatos, sinAnimarFondo = false }) {
  // "Reasignar": quien tiene permiso de editar citas con alcance "todo" (lo decide Citas.jsx pasando onReasignar). Un clic en la persona.
  const [reasignando, setReasignando] = useState(false)
  const puedeReasignar = !!onReasignar && esReasignable(cita)
  const puedeTomar = !!onTomar && esTomable(cita)
  const destinos = personasAsignables.filter((m) => m.id !== cita.asignadoA)
  // «Atender» pasa por la guardia del sistema (otro día, siguiente cita ya agendada): la pregunta no vive aquí, la hace quien recibe onIngresar.
  const puedeIngresar = puedeIngresarCita(cita) && !!onIngresar
  const puedeAgendarOtra = puedeAgendarOtraCita(cita) && !!onAgendarOtra
  // El seguimiento sale de la base; quien abre el detalle puede pasar los eventos ya leídos (o las pruebas, los suyos).
  const eventosLeidos = useEventosDeCita(cita, eventosPropios === undefined)
  const seguimiento = seguimientoDeCita(cita, eventosPropios ?? eventosLeidos)
  const triage = cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle)
    ? [cita.triage.sintomas?.join(", "), cita.triage.desdeCuando, cita.triage.detalle].filter(Boolean).join(" · ")
    : null
  // Cambios de estado a mano (la recepción): "Llegó" solo el día de la cita; "No efectuada" solo mientras sigue pendiente y
  // terminó su horario (el sistema la marca sola en ese momento; "En espera" y "En atención" no se marcan solas durante su horario).
  const puedeLlego = !!onLlego && cita.estado === "Pendiente" && cita.fecha === hoyISO()
  const puedeNoLlego = !!onNoLlego && cita.estado === "En Espera"
  // «No efectuada» a mano: solo cuando ya terminó el horario de la cita (el servidor lo exige igual).
  const puedeNoAsistio = !!onNoAsistio && cita.estado === "Pendiente" && yaTerminoSuHorario(cita, undefined, duracionDefault)
  const hayCambioDeEstado = puedeLlego || puedeNoLlego || puedeNoAsistio
  const etiquetaEstado = etiquetaEstadoCita(cita.estado)
  // Datos del paciente (la cita guarda los del momento de agendar; el expediente trae la edad y, a veces, el correo).
  const edad = edadEnAnios(paciente?.fecha_nacimiento || paciente?.fechaNacimiento)
  const correoBruto = cita.correo || paciente?.correo || ""
  const correo = correoBruto && correoBruto !== "Sin Correo" ? correoBruto : ""
  const cedula = cita.cedula || paciente?.cedula
  const telefono = cita.telefono || paciente?.telefono
  const profesional = profesionalDeCita(cita, equipo)
  // Sin ninguna acción para esta persona en este estado (p. ej. una cita cancelada vista por quien solo mira), no se dibuja una franja de pie vacía.
  const hayAcciones = Boolean(
    (cita.pacienteId && onConfirmarDatos && paciente?.origen === "paciente" && !paciente.confirmadoRecepcion)
    || (!cita.pacienteId && onRegistrarPaciente) || puedeReasignar || (puedeEditarCita(cita) && onEditar)
    || !!cita.pacienteId
    || (cita.estado === "En Atención" && onDejarDeAtender) || (puedeCancelarCita(cita) && onCancelar)
    || puedeTomar || puedeAgendarOtra || (cobroPendiente && onCobrar) || (!cobroPendiente && puedeIngresar),
  )

  return (
    <Cascaron
      titulo={cita.paciente}
      subtitulo={<>Detalle de la cita{cita.codigo && <> · <span className="font-mono">{cita.codigo}</span></>}</>}
      ancho="max-w-3xl"
      capa="z-[60]"
      sinAnimarFondo={sinAnimarFondo}
      onCerrar={onCerrar}
      marca={
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
          {cita.iniciales || <User size={18} />}
        </div>
      }
      derecha={<span role="status" aria-label={"Estado: " + etiquetaEstado} className={"shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (BADGE_ESTADO[cita.estado] || BADGE_PENDIENTE)}>{etiquetaEstado}</span>}
      pie={!hayAcciones ? undefined : <>
        {reasignando && puedeReasignar && (
          <div className="w-full rounded-lg bg-slate-50 px-3 py-2">
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
    
        <div className="flex w-full flex-wrap items-center gap-2" role="group" aria-label="Acciones de la cita">
          {cita.pacienteId && (
            <a href={urlPerfilPaciente(cita.pacienteId)} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}>
              <ExternalLink size={14} aria-hidden="true" /> Ver perfil
            </a>
          )}
          {cita.pacienteId && onConfirmarDatos && paciente?.origen === "paciente" && !paciente.confirmadoRecepcion && (
            <button type="button" onClick={() => onConfirmarDatos(cita)} title="El paciente se registró solo por la web: la recepción debe verificar sus datos en su primera visita." className={BOTON_SECUNDARIO}>
              <UserCheck size={14} aria-hidden="true" /> Verificar datos (registro web)
            </button>
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
            {cobroPendiente && onCobrar ? (
              <button type="button" onClick={() => onCobrar(cita)} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
                <Receipt size={14} aria-hidden="true" /> Cobrar
              </button>
            ) : !cobroPendiente && puedeIngresar && (
              <button type="button" onClick={() => onIngresar(cita)} className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                <Stethoscope size={14} aria-hidden="true" /> {cita.estado === "En Atención" ? "Seguir atendiendo" : "Atender"}
              </button>
            )}
          </div>
        </div>
      </>}
    >
      <div className="px-6 py-5">
      <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-3">
        <Columna titulo="Paciente">
          {cedula && <Dato etiqueta="Cédula"><span className="font-mono">{cedula}</span></Dato>}
          {telefono && <Dato etiqueta="Teléfono">{telefono}</Dato>}
          {edad !== null && <Dato etiqueta="Edad">{edad} {edad === 1 ? "año" : "años"}</Dato>}
          {correo && <Dato etiqueta="Correo">{correo}</Dato>}
          {!cedula && !telefono && edad === null && !correo && <Dato etiqueta="Contacto"><Vacio>Sin datos</Vacio></Dato>}
        </Columna>

        <Columna titulo="Cita">
          <Dato etiqueta="Fecha">
            {cita.fecha ? formatoFecha(cita.fecha, "largo") : "Sin fecha"}
            {["Hoy", "Mañana", "Ayer"].includes(etiquetaFecha(cita.fecha)) && <span className="mt-0.5 block text-xs font-normal text-slate-500">{etiquetaFecha(cita.fecha)}</span>}
          </Dato>
          <Dato etiqueta="Hora">{cita.hora}</Dato>
          <Dato etiqueta="Motivo">
            {cita.motivo || <Vacio>Sin motivo</Vacio>}
            {cita.motivoPublico && <span className="mt-0.5 block text-xs font-normal text-slate-500">Indicado en línea: {cita.motivoPublico}</span>}
          </Dato>
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
          <ol aria-label="Línea de tiempo de la cita" className="space-y-2.5 border-l border-slate-200 pl-3.5">
            {seguimiento.map((e, i) => (
              <li key={e.id || i} className="relative min-w-0">
                <span className="absolute -left-[1.1rem] top-1.5 h-2 w-2 rounded-full bg-slate-400" aria-hidden="true" />
                <p className="text-sm font-semibold" style={{ color: INK }}>
                  {TITULO_EVENTO[e.tipo] || e.tipo}
                  {sufijoDeEvento(e) && <span className="font-normal text-slate-500"> · {sufijoDeEvento(e)}</span>}
                </p>
                {(cuandoDeEvento(e) || e.quien) && <p className="text-xs text-slate-500">{[cuandoDeEvento(e), e.quien && "por " + e.quien].filter(Boolean).join(" · ")}</p>}
                {detalleDeEvento(e).map((l) => <p key={l} className="text-xs text-slate-600">{l}</p>)}
              </li>
            ))}
          </ol>
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
                <UserX size={14} aria-hidden="true" /> No efectuada
              </button>
            )}
          </div>
        )}
      </section>
      )}
      </div>
    </Cascaron>
  )
}
