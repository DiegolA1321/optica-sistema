// Qué estados tiene sentido ponerle a mano a una cita ("Corregir estado (excepción)" en Citas): el estado cambia solo según lo que ocurre en
// la visita, y esto solo sirve para deshacer un error. Una cita de un día que todavía no llega no puede estar en atención, atendida ni
// marcada como "No efectuada": solo pendiente. (Así una cita futura no queda "En atención" por una corrección a mano.)
import { hoyISO } from "./disponibilidad"

// «Cancelada» no está: cancelar es una acción con su motivo («Cancelar cita»), no una corrección. Una cita ya cancelada se ve tal cual y se puede reabrir como pendiente.
export const ESTADOS_DE_CITA = ["En Atención", "Pendiente", "Atendida", "No Asistió"]

export function estadosCorregibles(cita, hoy = hoyISO()) {
  const futura = !!cita?.fecha && cita.fecha > hoy
  const permitidos = futura ? ESTADOS_DE_CITA.filter((e) => e === "Pendiente") : ESTADOS_DE_CITA
  // Un dato viejo que ya está en un estado imposible se sigue viendo tal cual en la lista, pero el único cambio ofrecido es sacarlo de ahí.
  return cita?.estado && !permitidos.includes(cita.estado) ? [cita.estado, ...permitidos] : permitidos
}

export const estadoCorregibleEs = (cita, estado, hoy = hoyISO()) => estado === cita?.estado || estadosCorregibles(cita, hoy).includes(estado)

// Cómo se escribe cada estado de cita en pantalla: una sola fuente, así "No efectuada" es igual en todo el sistema. El valor guardado
// ("No Asistió", "En Atención"...) es un dato interno y no se muestra tal cual.
const ETIQUETA_ESTADO = { Pendiente: "Pendiente", "En Espera": "En espera", "En Atención": "En atención", Atendida: "Atendida", "No Asistió": "No efectuada", Cancelada: "Cancelada" }
export const etiquetaEstadoCita = (estado) => ETIQUETA_ESTADO[estado] || estado || "Pendiente"

// Los colores de cada estado de cita (regla 14): una sola tabla para quien la muestre fuera del módulo de Citas (el portal del paciente la usa).
// Pendiente = naranja, En espera = violeta, En atención = azul, Atendida = verde, No efectuada = rojo, Cancelada = gris.
export const CLASE_ESTADO_CITA = {
  Pendiente: "border-amber-200/60 bg-amber-50 text-amber-700",
  "En Espera": "border-violet-200/60 bg-violet-50 text-violet-700",
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-600",
}
export const claseEstadoCita = (estado) => CLASE_ESTADO_CITA[estado] || CLASE_ESTADO_CITA.Pendiente
