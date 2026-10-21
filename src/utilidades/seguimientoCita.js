// «Seguimiento» de una cita como una línea de tiempo: qué pasó, cuándo y quién (agendada —y por dónde—, reagendada, llegó, en atención, atendida,
// cancelada con su motivo, no efectuada con su motivo, contactada, descartada, sin seguimiento). Lógica pura, sin React.
//
// Cada evento: { id?, tipo, en (ISO), quien (texto), datos? }. Salen de la tabla citas_eventos (migración 0134), que escribe un trigger con cada cambio de la cita; las
// citas anteriores a esa migración no tienen todos sus eventos: se arma lo que se sabe de sus propios datos (cuándo y por dónde se agendó, quién la canceló y cómo terminó,
// sin hora porque no se guardó).
import { fechaHoraLegible, formatoFecha } from "./formatoFecha"
import { etiquetaEstadoCita } from "./estadosCita"

export const TITULO_EVENTO = {
  agendada: "Agendada",
  reagendada: "Reagendada",
  llego: "Llegó",
  en_atencion: "En atención",
  atendida: "Atendida",
  cancelada: "Cancelada",
  no_efectuada: "No efectuada",
  volvio_pendiente: "Volvió a pendiente",
  contactada: "Contactada",
  descartada: "Descartada",
  sin_seguimiento: "Sin seguimiento",
  correccion: "Estado corregido",
}

// «Web», «Recepción» o «Portal»: por dónde se agendó (los valores de la base: web, portal, recepcion; y los de la columna origen para las citas anteriores).
export const ORIGEN_AGENDADA = { web: "Web", paciente: "Web", portal: "Portal del paciente", recepcion: "Recepción", staff: "Recepción" }

export const QUIEN_CANCELO = { paciente: "El paciente", recepcion: "El personal" }

const MEDIO = { whatsapp: "por WhatsApp", llamada: "por llamada", otro: "" }

export const cuandoDeEvento = (e) => {
  if (!e.en) return ""
  const d = new Date(e.en)
  return Number.isNaN(d.getTime()) ? "" : fechaHoraLegible(d, { anio: true })
}

// Eventos propios de la cita, del más antiguo al más reciente. `eventos` son los de la tabla (puede venir vacío).
export function seguimientoDeCita(cita, eventos = []) {
  const propios = [...eventos].sort((a, b) => String(a.en || "").localeCompare(String(b.en || "")))
  if (propios.length > 0) {
    if (propios.some((e) => e.tipo === "agendada") || !cita.creadoEn) return propios
    return [{ tipo: "agendada", en: cita.creadoEn, quien: "", datos: { origen: cita.origen } }, ...propios]
  }
  const derivados = []
  if (cita.creadoEn) derivados.push({ tipo: "agendada", en: cita.creadoEn, quien: "", datos: { origen: cita.origen } })
  if (cita.estado === "Cancelada") derivados.push({ tipo: "cancelada", en: null, quien: QUIEN_CANCELO[cita.canceladaPor] || "", datos: {} })
  else if (cita.estado === "Atendida") derivados.push({ tipo: "atendida", en: null, quien: "", datos: {} })
  else if (cita.estado === "No Asistió") derivados.push({ tipo: "no_efectuada", en: null, quien: "", datos: {} })
  else if (cita.estado === "En Atención") derivados.push({ tipo: "en_atencion", en: null, quien: "", datos: {} })
  else if (cita.estado === "En Espera") derivados.push({ tipo: "llego", en: null, quien: "", datos: {} })
  return derivados
}

// Las líneas de detalle de un evento (debajo de su título): «Agendada · Portal del paciente»; el motivo de una cancelación o de una cita no efectuada; «Reagendada desde el …».
export function detalleDeEvento(e) {
  const d = e.datos || {}
  const lineas = []
  if (e.tipo === "reagendada" && d.fecha_anterior) lineas.push(`Reagendada desde el ${formatoFecha(d.fecha_anterior, "calendario", { enFrase: true })}${d.hora_anterior ? ` a las ${d.hora_anterior}` : ""}`)
  if (e.tipo === "correccion" && d.de && d.a) lineas.push(`De «${etiquetaEstadoCita(d.de)}» a «${etiquetaEstadoCita(d.a)}»${d.nota ? ` · ${d.nota}` : ""}`)
  if (e.tipo === "contactada") lineas.push(`Se le escribió ${MEDIO[d.medio] || ""}`.trim())
  if (e.tipo === "sin_seguimiento") lineas.push(`Pasaron ${d.dias || 30} días sin que se atendiera ni se reagendara`)
  if (["cancelada", "no_efectuada", "descartada"].includes(e.tipo) && d.motivo) lineas.push(d.detalle ? `${d.motivo}: ${d.detalle}` : d.motivo)
  if (e.tipo === "volvio_pendiente" && d.de) lineas.push(`Estaba «${etiquetaEstadoCita(d.de)}»`)
  return lineas
}

// Lo que va junto al título: por dónde se agendó.
export const sufijoDeEvento = (e) => (e.tipo === "agendada" ? ORIGEN_AGENDADA[e.datos?.origen] || "" : "")
