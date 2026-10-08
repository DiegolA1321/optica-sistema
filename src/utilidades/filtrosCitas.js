// Filtros de la agenda de Citas (reunión 29 sept., R3-R6): estado, origen y
// primera vez/seguimiento. Lógica pura, sin React, para probarla aparte.

export const ESTADOS_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "enAtencion", etiqueta: "En atención" },
  { id: "atendida", etiqueta: "Atendidas" },
  { id: "noAsistio", etiqueta: "No asistió" },
  { id: "cancelada", etiqueta: "Canceladas" },
]

export const PERIODOS_FILTRO = [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "proximas", etiqueta: "Próximas" },
  { id: "todas", etiqueta: "Todas" },
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
