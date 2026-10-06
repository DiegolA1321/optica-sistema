// Filtros de la agenda de Citas (reunión 29 sept., R3-R6): estado, origen y
// primera vez/seguimiento. Lógica pura, sin React, para probarla aparte.
import { yaPasoLaHora } from "./agendaCitas"

export const ESTADOS_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "enAtencion", etiqueta: "En atención" },
  { id: "atendida", etiqueta: "Atendidas" },
  { id: "cancelada", etiqueta: "Canceladas" },
  { id: "vencida", etiqueta: "Vencidas", ayuda: "Su hora ya pasó sin atenderse: pendientes que no llegaron y citas marcadas No asistió" },
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
export const ESTADOS_DE_HISTORIAL = ["atendida", "cancelada", "vencida"]

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

export function coincideEstado(cita, estado, ahora = new Date()) {
  switch (estado) {
    case "pendiente": return cita.estado === "Pendiente" || cita.estado === "En Espera"
    case "enAtencion": return cita.estado === "En Atención"
    case "atendida": return cita.estado === "Atendida"
    case "cancelada": return cita.estado === "Cancelada"
    case "vencida": return cita.estado === "No Asistió" || ((cita.estado === "Pendiente" || cita.estado === "En Espera") && yaPasoLaHora(cita, ahora))
    default: return true
  }
}

export const coincideOrigen = (cita, origen) => origen === "todos" || cita.origen === origen

export function coincideSeguimiento(cita, seguimiento, consultas = []) {
  if (seguimiento === "todos") return true
  return esPrimeraVez(cita, consultas) === (seguimiento === "primera")
}
