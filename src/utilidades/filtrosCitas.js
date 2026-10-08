// Filtros de la agenda de Citas (reunión 29 sept., R3-R6): estado, origen y
// primera vez/seguimiento. Lógica pura, sin React, para probarla aparte.
import { esHoy } from "./disponibilidad"

export const ESTADOS_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "enEspera", etiqueta: "En espera" },
  { id: "enAtencion", etiqueta: "En atención" },
  { id: "atendida", etiqueta: "Atendidas" },
  { id: "noAsistio", etiqueta: "No asistió" },
  { id: "cancelada", etiqueta: "Canceladas" },
]

// Periodos de la Lista, los mismos que las vistas Semana y Mes: un día, una semana (de lunes a domingo) o un mes, que se
// mueven con las flechas de la barra. El rango libre de fechas es un filtro del panel "Filtrar". "Para reagendar" y
// "Todas" no son atajos fijos: aparecen solo mientras están activos (se llega a ellos desde las tarjetas de Inicio;
// `activo` es el periodo elegido).
export const periodosFiltro = (activo = "") => [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "semana", etiqueta: "Semana" },
  { id: "mes", etiqueta: "Mes" },
  ...(activo === "reagendar" ? [{ id: "reagendar", etiqueta: "Para reagendar" }] : []),
  ...(activo === "todas" ? [{ id: "todas", etiqueta: "Todas" }] : []),
]

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
// Una cita de otro día (la de mañana que se atiende hoy, o una de ayer) pide una confirmación liviana antes de entrar a la
// ficha: se atiende hoy y su fecha agendada no cambia. Las de hoy entran directo, y retomar una atención abierta no pregunta.
export const requiereConfirmarOtroDia = (cita, hoy) => cita.estado !== "En Atención" && Boolean(cita.fecha) && cita.fecha !== hoy
export const puedeEditarCita = (cita) => !["Atendida", "Cancelada", "No Asistió"].includes(cita.estado)
export const puedeAgendarOtraCita = (cita) => cita.estado === "No Asistió"

export function coincideEstado(cita, estado) {
  switch (estado) {
    case "pendiente": return cita.estado === "Pendiente"
    case "enEspera": return cita.estado === "En Espera"
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

// Responsable de una cita: quien la atendió y, mientras no se atiende, a quien está asignada (lo mismo que dice la
// tarjeta: "Atendió: …" o "Asignada a: …"). Cada cita tiene uno solo, así que los resultados por persona no se repiten.
export const responsableDeCita = (cita) => cita.atendidoPor || cita.asignadoA || null

// Filtro por responsable (solo el administrador lo usa): "todos", "ninguno" (la cita no tiene a nadie) o el id de
// una persona del equipo.
export function coincideResponsable(cita, valor) {
  if (valor === "todos") return true
  const responsable = responsableDeCita(cita)
  return valor === "ninguno" ? responsable === null : responsable === valor
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

// f = { estado, origen, seguimiento, responsable, texto, periodo, ventana, rangos, idsReagendar }
//   rangos: { hoy, semana, mes } — cada uno { desde, hasta }: el día, la semana y el mes que se están viendo en la Lista.
//   periodo: { filtro: "hoy" | "semana" | "mes" | "reagendar" | "todas", desde, hasta } — solo la Lista; un rango (desde/hasta) manda sobre `filtro`.
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
  if (!coincideResponsable(cita, f.responsable)) return false
  if (!coincideTexto(cita, f.texto)) return false
  // La búsqueda mira todas las fechas: el periodo elegido no la limita (al borrarla, vuelve).
  if (!f.ventana && p && !buscando) {
    const { filtro, desde, hasta } = p
    if (desde || hasta) return (!desde || cita.fecha >= desde) && (!hasta || cita.fecha <= hasta)
    if (filtro === "hoy" && !f.rangos?.hoy) return esHoy(cita.fecha)
    if (filtro === "hoy" || filtro === "semana" || filtro === "mes") { const r = f.rangos?.[filtro]; return Boolean(r) && cita.fecha >= r.desde && cita.fecha <= r.hasta }
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
