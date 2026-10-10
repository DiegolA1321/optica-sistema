"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { ChevronRight, Gift, Cake, Star, Receipt, Calendar, CalendarPlus, Users, Printer, Stethoscope, CheckCircle2, Eye } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaLegible, fechaHoraLegible, formatoFecha } from "../utilidades/formatoFecha"
import { profesionalDeCita } from "../utilidades/profesionalCita"
import { DetalleAtencion, SinInformacion } from "./AtencionPaciente"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Despliegues del Resumen del perfil: cada cuadro, al tocarlo, muestra de dónde sale su número.
// Todos terminan igual cuando no hay información: un mensaje que explica qué falta (SinInformacion).

export function Despliegue({ titulo, onCerrar, children }) {
  return (
    <section aria-label={titulo} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" style={{ animation: "rise-in 220ms ease-out both" }}>
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-2.5">
        <h3 className="text-sm font-bold" style={{ color: INK }}>{titulo}</h3>
        <button type="button" onClick={onCerrar} className="text-xs font-semibold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">Ocultar</button>
      </div>
      {children}
    </section>
  )
}

const Fila = ({ etiqueta, children }) => (
  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 py-2">
    <dt className="w-44 shrink-0 text-xs font-semibold text-slate-500">{etiqueta}</dt>
    <dd className="min-w-0 flex-1 text-sm font-semibold break-words" style={{ color: INK }}>{children}</dd>
  </div>
)

const Boton = ({ onClick, Icono, children, principal }) => (
  <button type="button" onClick={onClick} className={"inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (principal ? "text-white hover:brightness-110" : "border border-slate-200/60 text-slate-700 hover:bg-slate-50")} style={principal ? { background: GRAD } : undefined}>
    {Icono && <Icono size={14} aria-hidden="true" />} {children}
  </button>
)

// ── Última consulta: todo lo de esa atención ──
export function PanelUltimaConsulta({ consulta, cita, equipo, adjuntos, onAbrirVentana }) {
  if (!consulta) return <SinInformacion Icono={Stethoscope} titulo="Todavía no tiene consultas" texto="Cuando se guarde su primera ficha clínica, aquí verás todo lo que pasó en esa atención." />
  const quien = cita ? profesionalDeCita(cita, equipo).nombre : consulta.profesionalNombre
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 text-xs text-slate-500">
        <p>Consulta del <span className="font-semibold text-slate-700">{fechaLegible(consulta.fecha)}</span>{cita?.hora && cita.hora !== "Sin cita" ? " · " + cita.hora : ""}{quien ? " · atendió " + quien : ""}</p>
        <Boton onClick={onAbrirVentana} Icono={Printer}>Abrir en ventana e imprimir receta</Boton>
      </div>
      <div className="p-3"><DetalleAtencion consulta={consulta} adjuntos={adjuntos} compacto /></div>
    </div>
  )
}

// ── Estado de corrección: qué se midió y cómo se calcula ──
const REGLA = {
  "Bien corregido": "Con sus lentes alcanza una agudeza visual de 20/20 a 20/25 en ambos ojos.",
  "Requiere ajuste": "Con sus lentes, al menos un ojo ve peor que 20/25: conviene revisar la graduación.",
  "Sin evaluar": "En la ficha no se anotó qué tan bien ve con sus lentes, así que el sistema no puede calcularlo.",
}
export function PanelCorreccion({ consulta, etiqueta, estado, tendencia }) {
  if (!consulta) return <SinInformacion Icono={Eye} titulo="Todavía no hay estado de corrección" texto="Se calcula con la agudeza visual con lentes que se anota en la ficha clínica." />
  return (
    <dl className="divide-y divide-slate-100 px-4 py-1">
      <Fila etiqueta="Estado">{etiqueta}</Fila>
      <Fila etiqueta="Medido el">{fechaLegible(consulta.fecha)}</Fila>
      <Fila etiqueta="Agudeza visual con lentes">OD {consulta.od?.avCc || "no anotada"} · OI {consulta.oi?.avCc || "no anotada"}</Fila>
      <Fila etiqueta="Agudeza visual sin lentes">OD {consulta.od?.avSc || "no anotada"} · OI {consulta.oi?.avSc || "no anotada"}</Fila>
      <Fila etiqueta="Cómo se calcula">{REGLA[estado] || REGLA["Sin evaluar"]}</Fila>
      {tendencia && <Fila etiqueta="Graduación vs. la consulta anterior">{tendencia.txt}</Fila>}
    </dl>
  )
}

// ── Control: la fecha recomendada y la cita agendada son dos cosas distintas ──
export function PanelControl({ proximoControl, diasControl, inactivo, ultima, citaPendiente, onAgendar }) {
  if (!proximoControl && !citaPendiente) return <SinInformacion Icono={Calendar} titulo="Sin control recomendado" texto="Se calcula con lo que el optómetra indica en la ficha clínica (próximo control)." />
  return (
    <div>
      <dl className="divide-y divide-slate-100 px-4 py-1">
        <Fila etiqueta="Control recomendado">
          {proximoControl ? <>{fechaLegible(proximoControl)}<span className={"ml-2 text-xs font-medium " + (inactivo ? "text-red-600" : "text-slate-500")}>{inactivo ? `vencido hace ${diasControl} día${diasControl === 1 ? "" : "s"}` : (Math.abs(diasControl) === 1 ? "falta 1 día" : `faltan ${Math.abs(diasControl)} días`)}</span></> : "Sin fecha recomendada"}
          {ultima && proximoControl && <span className="block text-xs font-normal text-slate-500">Lo indicó el optómetra en la ficha del {fechaLegible(ultima.fecha)}{ultima.proximoControlDias ? ` (a los ${ultima.proximoControlDias} días)` : ""}.</span>}
        </Fila>
        <Fila etiqueta="Cita agendada">
          {citaPendiente ? <>{fechaLegible(citaPendiente.fecha)} · {citaPendiente.hora}<span className="block text-xs font-normal text-slate-500">{citaPendiente.motivo || "Consulta general"} · {citaPendiente.estado}</span></> : <span className="font-normal text-slate-500">No tiene una cita agendada.</span>}
        </Fila>
      </dl>
      <p className="mx-4 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        {citaPendiente ? "Mientras haya una cita pendiente, el sistema da el control por cubierto y no avisa que falta agendarlo." : "El control recomendado es la fecha sugerida en la ficha. Aún no hay cita para ese control."}
      </p>
      {!citaPendiente && onAgendar && <div className="px-4 pb-3"><Boton onClick={onAgendar} Icono={CalendarPlus} principal>Agendar su control</Boton></div>}
    </div>
  )
}

// ── Compras ──
const descripcionComprobante = (c) => c.factura ? (c.factura.lineas || []).map((l) => l.descripcion).filter(Boolean).join(", ") || "Comprobante de venta" : c.venta?.productoNombre || "Venta"
export function PanelCompras({ comprobantes, onVerProductos }) {
  if (comprobantes.length === 0) return <SinInformacion Icono={Receipt} titulo="Aún no tiene compras" texto="Las ventas de lentes, monturas y servicios aparecerán aquí cuando se cobre la primera."><div className="mt-2"><Boton onClick={onVerProductos} Icono={ChevronRight}>Ir a Productos y servicios</Boton></div></SinInformacion>
  return (
    <div>
      <ul className="divide-y divide-slate-100 px-4">
        {comprobantes.map((c) => {
          const monto = Number((c.factura || c.venta).montoTotal)
          const anulada = c.factura?.estado === "anulada"
          return (
            <li key={c.clave} className="flex flex-wrap items-center gap-x-4 gap-y-0.5 py-2.5 text-sm">
              <span className="w-28 shrink-0 font-semibold text-slate-700">{fechaLegible(String(c.fecha).slice(0, 10))}</span>
              <span className="min-w-0 flex-1 truncate text-slate-600">{descripcionComprobante(c)}</span>
              {anulada && <span className="rounded-full border border-slate-200/60 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">Anulada</span>}
              <span className={"font-bold tabular-nums " + (anulada ? "text-slate-400 line-through" : "")} style={anulada ? undefined : { color: INK }}>{dinero(monto)}</span>
            </li>
          )
        })}
      </ul>
      <div className="px-4 py-3"><Boton onClick={onVerProductos} Icono={ChevronRight}>Ver el detalle en Productos y servicios</Boton></div>
    </div>
  )
}

// ── Fidelización ──
export function PanelPuntaje({ consultas, referidos, frecuente }) {
  const total = consultas.length * 10 + referidos.length * 15
  if (total === 0) return <SinInformacion Icono={Star} titulo="Todavía no suma puntos" texto="Gana 10 puntos por cada consulta registrada y 15 por cada paciente que refiera." />
  return (
    <div>
      <ul className="divide-y divide-slate-100 px-4">
        {consultas.map((c) => (
          <li key={c.id} className="flex items-center gap-3 py-2 text-sm">
            <Stethoscope size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-slate-600">Consulta del {fechaLegible(c.fecha)}{c.motivo ? " · " + c.motivo : ""}</span>
            <span className="font-bold tabular-nums text-emerald-700">+10</span>
          </li>
        ))}
        {referidos.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2 text-sm">
            <Gift size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-slate-600">Refirió a {p.nombre}</span>
            <span className="font-bold tabular-nums text-emerald-700">+15</span>
          </li>
        ))}
        <li className="flex items-center gap-3 py-2.5 text-sm font-bold" style={{ color: INK }}><span className="flex-1">Total</span><span className="tabular-nums">{total} pts</span></li>
      </ul>
      <p className="mx-4 mb-3 flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"><CheckCircle2 size={13} className={frecuente ? "text-emerald-600" : "text-slate-400"} aria-hidden="true" />{frecuente ? "Es cliente frecuente: tiene 3 o más consultas." : `Será cliente frecuente con 3 consultas: ${3 - consultas.length === 1 ? "le falta 1" : `le faltan ${Math.max(0, 3 - consultas.length)}`}.`}</p>
    </div>
  )
}

export function PanelReferidos({ lista, referidoPor, onAbrir }) {
  return (
    <div>
      {referidoPor && <p className="mx-4 mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Este paciente llegó referido por <span className="font-semibold text-slate-800">{referidoPor}</span>.</p>}
      {lista.length === 0 ? (
        <SinInformacion Icono={Users} titulo="Todavía no ha referido a nadie" texto="Cuando un paciente nuevo diga que viene de su parte, aparecerá aquí y sumará 15 puntos." />
      ) : (
        <ul className="divide-y divide-slate-100 px-4">
          {lista.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>{p.nombre.charAt(0).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate font-semibold text-slate-800">{p.nombre}</span><span className="block text-xs text-slate-500">Registrado el {fechaLegible(p.fechaRegistro) || "—"}</span></span>
              {onAbrir && <button type="button" onClick={() => onAbrir(p)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Ver perfil <ChevronRight size={14} aria-hidden="true" /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function PanelCumple({ fechaNacimiento, diasCumple, edad, saludoAnio, anioActual, cumpleAuto, tieneCorreo, onCrm }) {
  if (diasCumple == null) return <SinInformacion Icono={Cake} titulo="Sin fecha de nacimiento" texto="Sin ese dato no se puede saber cuándo cumple años ni enviarle un saludo." />
  const [, mes, dia] = String(fechaNacimiento).split(/[-/T]/).map(Number)
  const cuando = diasCumple === 0 ? "Hoy cumple años" : diasCumple === 1 ? "Mañana cumple años" : diasCumple <= 30 ? `Cumple años en ${diasCumple} días (cerca)` : `Cumple años en ${diasCumple} días (todavía falta)`
  const saludado = saludoAnio === anioActual
  let saludo
  if (saludado) saludo = `Sí: ya se le envió el saludo automático de ${anioActual}.`
  else if (!cumpleAuto) saludo = "No: los saludos automáticos están desactivados. Puedes saludarlo tú desde CRM."
  else if (!tieneCorreo) saludo = "No: no tiene correo registrado, así que el saludo automático no le llega."
  else saludo = diasCumple === 0 ? "Se le enviará hoy el saludo automático." : "Todavía no. El saludo automático se envía el día de su cumpleaños."
  return (
    <div>
      <dl className="divide-y divide-slate-100 px-4 py-1">
        <Fila etiqueta="Cumpleaños">{formatoFecha(`2000-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`, "medioSinAnio")}{edad != null ? ` · cumple ${edad + (diasCumple === 0 ? 0 : 1)} años` : ""}</Fila>
        <Fila etiqueta="Cuánto falta">{cuando}</Fila>
        <Fila etiqueta="¿Ya lo felicitamos?">{saludo}</Fila>
      </dl>
      <p className="mx-4 mb-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">El sistema solo registra los saludos automáticos; un mensaje que envíes a mano por WhatsApp no queda anotado aquí.</p>
      {!saludado && onCrm && <div className="px-4 pb-3"><Boton onClick={onCrm} Icono={ChevronRight}>Ir a CRM</Boton></div>}
    </div>
  )
}

// ── Citas del paciente por estado ──
const TEXTO_ESTADO = {
  pendientes: { vacio: ["Sin citas pendientes", "Cuando se agende una cita nueva aparecerá aquí."] },
  atendidas: { vacio: ["Sin citas atendidas", "Las citas aparecen aquí cuando se guarda su ficha clínica."] },
  noAsistio: { vacio: ["Nunca ha faltado a una cita", "Se marca \"No asistió\" cuando pasan 10 minutos de la hora sin que el paciente llegue."] },
  canceladas: { vacio: ["Sin citas canceladas", "Aquí verás las citas que se cancelaron antes de la fecha."] },
}
const NOTA_ESTADO = {
  noAsistio: "No llegó dentro de los 10 minutos de tolerancia.",
  canceladas: "La cita se canceló antes de la fecha.",
}

export function PanelCitasEstado({ estado, citas, equipo, consultaDe, onVerAtencion }) {
  if (citas.length === 0) {
    const [titulo, texto] = TEXTO_ESTADO[estado].vacio
    return <SinInformacion Icono={Calendar} titulo={titulo} texto={texto} />
  }
  return (
    <ul className="divide-y divide-slate-100 px-4">
      {citas.map((c) => {
        const agendada = c.creadoEn ? fechaHoraLegible(new Date(c.creadoEn), { anio: true }) : null
        const pro = profesionalDeCita(c, equipo).nombre
        const consulta = consultaDe?.(c)
        return (
          <li key={c.id} className="py-3 text-sm">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <p className="min-w-0 flex-1"><span className="font-bold" style={{ color: INK }}>{fechaLegible(c.fecha)} · {c.hora}</span><span className="block truncate text-slate-600">{c.motivo || "Consulta general"}</span></p>
              {estado === "atendidas" && consulta && onVerAtencion && <button type="button" onClick={() => onVerAtencion(c)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Ver atención <ChevronRight size={14} aria-hidden="true" /></button>}
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {[pro && "Profesional: " + pro, "Origen: " + (c.origen === "paciente" ? "Web" : "Recepción"), agendada && "Agendada el " + agendada].filter(Boolean).join(" · ")}
            </p>
            {estado === "atendidas" && consulta && <p className="mt-1 text-xs text-slate-600"><span className="font-semibold">Diagnóstico:</span> {consulta.diagnostico || (consulta.diagnosticoCategorias || []).join(", ") || "sin registrar"}</p>}
            {NOTA_ESTADO[estado] && <p className="mt-1 text-xs text-slate-600">{NOTA_ESTADO[estado]}</p>}
          </li>
        )
      })}
    </ul>
  )
}

