// Filtros de la agenda de Citas (reunión 29 sept., R3-R6): estado, origen y
// primera vez/seguimiento. Lógica pura, sin React, para probarla aparte.
import { esHoy, esFutura, horarioEfectivo, diaAbierto, isoAFechaLocal } from "./disponibilidad"
import { sumarDiasISO } from "./controles"

export const ESTADOS_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "enAtencion", etiqueta: "En atención" },
  { id: "atendida", etiqueta: "Atendidas" },
  { id: "noAsistio", etiqueta: "No asistió" },
  { id: "cancelada", etiqueta: "Canceladas" },
]

// Atajos de la Lista, en orden de la jornada: hoy, el siguiente día de atención ("Mañana"; si es otro día, su nombre,
// sin número), lo que viene y todo. "Para reagendar" no es un atajo fijo: solo aparece mientras se llega a él desde
// Inicio (`reagendarActivo`).
export function periodosFiltro(diaConfirmar, hoy, reagendarActivo = false) {
  const nombreDia = isoAFechaLocal(diaConfirmar).toLocaleDateString("es-EC", { weekday: "long" })
  const esManana = !hoy || diaConfirmar === sumarDiasISO(hoy, 1)
  return [
    { id: "hoy", etiqueta: "Hoy" },
    { id: "confirmar", etiqueta: esManana ? "Mañana" : `${nombreDia.charAt(0).toUpperCase()}${nombreDia.slice(1)}` },
    ...(reagendarActivo ? [{ id: "reagendar", etiqueta: "Para reagendar" }] : []),
    { id: "proximas", etiqueta: "Próximas" },
    { id: "todas", etiqueta: "Todas" },
  ]
}

// "Lun 12": el nombre corto del día y su número.
export function etiquetaDiaCorta(iso) {
  const d = isoAFechaLocal(iso)
  const dia = d.toLocaleDateString("es-EC", { weekday: "short" }).replace(".", "")
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getDate()}`
}

// El próximo día en que la óptica atiende (según su horario semanal y sus excepciones), después de hoy: es el día
// cuyas citas recepción necesita confirmar. Un viernes es el lunes. Sin horario cargado, mañana.
export function proximoDiaDeAtencion(disponibilidad, hoy) {
  for (let i = 1; i <= 14; i++) {
    const iso = sumarDiasISO(hoy, i)
    if (diaAbierto(horarioEfectivo(iso, disponibilidad))) return iso
  }
  return sumarDiasISO(hoy, 1)
}

export const ORIGENES_FILTRO = [
  { id: "todos", etiqueta: "Todos" },
  { id: "paciente", etiqueta: "Web" },
  { id: "staff", etiqueta: "Recepción" },
]

export const SEGUIMIENTO_FILTRO = [
  { id: "todos", etiqueta: "Todos" },
  { id: "primera", etiqueta: "Primera vez" },
  { id: "seguimiento", etiqueta: "Seguimiento" },
]

// Estados cuyo historial interesa de la más reciente a la más antigua, sin
// esconder lo pasado en "Anteriores".
export const ESTADOS_DE_HISTORIAL = ["atendida", "cancelada", "noAsistio"]

// Primera vez = el paciente no tenía ninguna atención registrada antes de esta
// cita. La consulta de la propia cita no cuenta, así que la etiqueta no
// desaparece cuando la cita se atiende ni cuando se agenda otra después. Una
// cita sin paciente vinculado no tiene historial: es primera vez.
export function esPrimeraVez(cita, consultas = []) {
  if (!cita.pacienteId) return true
  return !consultas.some(
    (c) => c.pacienteId === cita.pacienteId && c.citaId !== cita.id && c.fecha && c.fecha <= cita.fecha,
  )
}

// Solo se cancela lo que todavía no empezó: no lo atendido, ni lo cancelado, ni lo que no asistió (queda como registro
// de inasistencia), ni lo que está en atención (ahí se "deja de atender").
export const puedeCancelarCita = (cita) => ["Pendiente", "En Espera"].includes(cita.estado)

// Qué acciones ofrece cada estado. Atender solo tiene sentido en lo que sigue abierto; una cita ya atendida o
// cancelada no se edita; una que no asistió solo muestra su estado y ofrece agendar otra.
export const puedeAtenderCita = (cita) => ["Pendiente", "En Espera", "En Atención"].includes(cita.estado)
export const puedeEditarCita = (cita) => !["Atendida", "Cancelada", "No Asistió"].includes(cita.estado)
export const puedeAgendarOtraCita = (cita) => cita.estado === "No Asistió"

export function coincideEstado(cita, estado) {
  switch (estado) {
    case "pendiente": return cita.estado === "Pendiente" || cita.estado === "En Espera"
    case "enAtencion": return cita.estado === "En Atención"
    case "atendida": return cita.estado === "Atendida"
    case "cancelada": return cita.estado === "Cancelada"
    case "noAsistio": return cita.estado === "No Asistió"
    default: return true
  }
}

export const coincideOrigen = (cita, origen) => origen === "todos" || cita.origen === origen

export function coincideSeguimiento(cita, seguimiento, consultas = []) {
  if (seguimiento === "todos") return true
  return esPrimeraVez(cita, consultas) === (seguimiento === "primera")
}

// Filtro por responsable (solo el administrador lo usa): "todos", "ninguno"
// (la cita no tiene a nadie) o el id de una persona del equipo.
export function coincideResponsable(cita, campo, valor) {
  if (valor === "todos") return true
  const actual = cita[campo] || null
  return valor === "ninguno" ? actual === null : actual === valor
}

// ── Filtros combinados y conteos que los reflejan ──
// "Todas" significa las citas activas: las canceladas solo se ven eligiendo el estado "Canceladas",
// igual en Lista, Semana y Mes.
export const coincideEstadoVisible = (cita, estado) => (estado === "todas" ? cita.estado !== "Cancelada" : coincideEstado(cita, estado))

// Búsqueda por nombre del paciente o código de la cita (el que recibe al reservar en línea).
export function coincideTexto(cita, texto) {
  const t = (texto || "").trim().toLowerCase()
  return !t || (cita.paciente || "").toLowerCase().includes(t) || (cita.codigo || "").toLowerCase().includes(t)
}

// f = { estado, origen, seguimiento, asignado, atendido, texto, periodo, ventana, diaConfirmar, idsReagendar }
//   periodo: { filtro: "hoy" | "confirmar" | "reagendar" | "proximas" | "todas", desde, hasta } — solo la Lista; un rango (desde/hasta) manda sobre `filtro`.
//   ventana: { desde, hasta } — el periodo visible de Semana y Mes; en Lista es null.
export function citaPasaFiltros(cita, f, consultas = []) {
  if (f.ventana && (cita.fecha < f.ventana.desde || cita.fecha > f.ventana.hasta)) return false
  const p = f.periodo
  const buscando = Boolean((f.texto || "").trim())
  // "Para reagendar" incluye canceladas y no asistidas aunque el estado esté en "Todas"; con búsqueda no rige el periodo.
  const paraReagendar = !f.ventana && !buscando && p && !p.desde && !p.hasta && p.filtro === "reagendar"
  if (!paraReagendar && !coincideEstadoVisible(cita, f.estado)) return false
  if (!coincideOrigen(cita, f.origen)) return false
  if (!coincideSeguimiento(cita, f.seguimiento, consultas)) return false
  if (!coincideResponsable(cita, "asignadoA", f.asignado)) return false
  if (!coincideResponsable(cita, "atendidoPor", f.atendido)) return false
  if (!coincideTexto(cita, f.texto)) return false
  // La búsqueda mira todas las fechas: el periodo elegido no la limita (al borrarla, vuelve).
  if (!f.ventana && p && !buscando) {
    const { filtro, desde, hasta } = p
    if (desde || hasta) return (!desde || cita.fecha >= desde) && (!hasta || cita.fecha <= hasta)
    if (filtro === "hoy") return esHoy(cita.fecha)
    if (filtro === "proximas") return esFutura(cita.fecha)
    if (filtro === "confirmar") return cita.fecha === f.diaConfirmar
    if (filtro === "reagendar") return Boolean(f.idsReagendar?.has(cita.id))
  }
  return true
}

// Cuántas citas habría si se cambiara un filtro (`cambios`), con todos los demás aplicados.
export const contarCon = (citas, f, consultas, cambios) => {
  const g = { ...f, ...cambios }
  return citas.reduce((n, c) => n + (citaPasaFiltros(c, g, consultas) ? 1 : 0), 0)
}

// Denominador de "Mostrando X de Y": las citas del alcance sin ningún filtro del usuario (en Semana y Mes, las del
// periodo visible). Las canceladas entran solo si se está mirando el estado "Canceladas".
export const totalDelAlcance = (citas, f) =>
  citas.reduce((n, c) => {
    if (f.ventana && (c.fecha < f.ventana.desde || c.fecha > f.ventana.hasta)) return n
    return n + (c.estado !== "Cancelada" || f.estado === "cancelada" ? 1 : 0)
  }, 0)
