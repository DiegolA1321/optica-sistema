// Qué estados tiene sentido ponerle a mano a una cita ("Corregir estado (excepción)" en Citas): el estado cambia solo según lo que ocurre en
// la visita, y esto solo sirve para deshacer un error. Una cita de un día que todavía no llega no puede estar en atención, atendida ni
// marcada como "No asistió": solo pendiente o cancelada. (Así una cita futura no queda "En atención" por una corrección a mano.)
import { hoyISO } from "./disponibilidad"

export const ESTADOS_DE_CITA = ["En Atención", "Pendiente", "Atendida", "No Asistió", "Cancelada"]

export function estadosCorregibles(cita, hoy = hoyISO()) {
  const futura = !!cita?.fecha && cita.fecha > hoy
  const permitidos = futura ? ESTADOS_DE_CITA.filter((e) => e === "Pendiente" || e === "Cancelada") : ESTADOS_DE_CITA
  // Un dato viejo que ya está en un estado imposible se sigue viendo tal cual en la lista, pero el único cambio ofrecido es sacarlo de ahí.
  return cita?.estado && !permitidos.includes(cita.estado) ? [cita.estado, ...permitidos] : permitidos
}

export const estadoCorregibleEs = (cita, estado, hoy = hoyISO()) => estado === cita?.estado || estadosCorregibles(cita, hoy).includes(estado)
