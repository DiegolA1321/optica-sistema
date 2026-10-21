// «Seguimiento» de una cita como una línea de tiempo: qué pasó, cuándo y quién (agendada —y por dónde—, reagendada, llegó, en atención, atendida,
// cancelada con su motivo, no efectuada con su motivo, contactada, descartada, sin seguimiento). Lógica pura, sin React.
//
// Cada evento: { tipo, en (ISO), quien (texto), detalle (texto) }. Salen de la tabla de eventos de la cita (citas_eventos) cuando existe; mientras
// una cita no tenga eventos guardados (las anteriores a esta función), se arma lo que se puede saber de sus propios datos: cuándo y por dónde se
// agendó, quién la canceló y, si ya terminó, cómo terminó (sin hora, porque no se guardó).
import { fechaHoraLegible, formatoFecha } from "./formatoFecha"

export const TITULO_EVENTO = {
  agendada: "Agendada",
  reagendada: "Reagendada",
  llego: "Llegó",
  en_atencion: "En atención",
  atendida: "Atendida",
  cancelada: "Cancelada",
  no_efectuada: "No efectuada",
  contactada: "Contactada",
  descartada: "Descartada",
  sin_seguimiento: "Sin seguimiento",
  correccion: "Estado corregido",
}

// «Web», «Recepción» o «Portal»: por dónde se agendó.
export const ORIGEN_AGENDADA = { paciente: "Web", portal: "Portal del paciente", staff: "Recepción" }

export const QUIEN_CANCELO = { paciente: "El paciente", recepcion: "El personal" }

const aTexto = (iso) => {
  if (!iso) return ""
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : fechaHoraLegible(d, { anio: true })
}
export const cuandoDeEvento = (e) => aTexto(e.en)

// Eventos propios de la cita, en orden cronológico (el más antiguo primero). `eventos` son los de la tabla (puede venir vacío).
export function seguimientoDeCita(cita, eventos = []) {
  const propios = [...eventos].sort((a, b) => String(a.en || "").localeCompare(String(b.en || "")))
  if (propios.length > 0) return propios
  const derivados = []
  if (cita.creadoEn) derivados.push({ tipo: "agendada", en: cita.creadoEn, quien: "", detalle: ORIGEN_AGENDADA[cita.origen] || "" })
  if (cita.estado === "Cancelada") derivados.push({ tipo: "cancelada", en: null, quien: QUIEN_CANCELO[cita.canceladaPor] || "", detalle: "" })
  else if (cita.estado === "Atendida") derivados.push({ tipo: "atendida", en: null, quien: "", detalle: "" })
  else if (cita.estado === "No Asistió") derivados.push({ tipo: "no_efectuada", en: null, quien: "", detalle: "" })
  else if (cita.estado === "En Atención") derivados.push({ tipo: "en_atencion", en: null, quien: "", detalle: "" })
  else if (cita.estado === "En Espera") derivados.push({ tipo: "llego", en: null, quien: "", detalle: "" })
  return derivados
}

// «Reagendada desde el jueves, 22 de octubre a las 04:00 PM», o null si la cita nunca se movió.
export function textoReagendadaDesde(eventos = []) {
  const e = [...eventos].reverse().find((x) => x.tipo === "reagendada" && x.detalle_fecha_anterior)
  if (!e) return null
  return `Reagendada desde el ${formatoFecha(e.detalle_fecha_anterior, "calendario", { enFrase: true })}${e.detalle_hora_anterior ? ` a las ${e.detalle_hora_anterior}` : ""}`
}
