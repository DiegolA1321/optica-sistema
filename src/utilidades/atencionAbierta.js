import { ahoraEcuador } from "./horaEcuador"
// Atenciones abiertas de días anteriores: una cita que quedó "En atención" y
// cuya fecha ya pasó (se abrió la ficha y nadie la cerró). Lógica pura, más la
// operación de dejarla de atender.
import { supabase } from "../lib/supabaseClient"
import { fechaAISO, isoAFechaLocal } from "./disponibilidad"

// Días que lleva abierta (mínimo 1), o null si no es una atención abierta antigua.
export function diasAtencionAbierta(cita, hoy = ahoraEcuador()) {
  if (!cita || cita.estado !== "En Atención" || !cita.fecha) return null
  const hoyISO = fechaAISO(hoy)
  if (cita.fecha >= hoyISO) return null
  const dias = Math.round((isoAFechaLocal(hoyISO) - isoAFechaLocal(cita.fecha)) / 86400000)
  return Math.max(1, dias)
}

export function atencionesAbiertasAntiguas(citas = [], hoy = ahoraEcuador()) {
  return citas
    .map((c) => ({ cita: c, dias: diasAtencionAbierta(c, hoy) }))
    .filter((x) => x.dias !== null)
    .sort((a, b) => b.dias - a.dias)
}

export const textoAtencionAbierta = (dias) => `Abierta hace ${dias} día${dias === 1 ? "" : "s"}`

// Qué pasa al «Dejar de atender» (lo decide el servidor, dejar_de_atender_cita, con el día de Ecuador; aquí solo se anticipa para explicarlo en la ventana):
//   · el mismo día de la cita: vuelve a «En espera» (el paciente puede seguir ahí) y el borrador de la ficha se conserva;
//   · si el día ya pasó: queda «No efectuada» con el motivo «La atención se interrumpió» y pasa a «Contactar al paciente».
export const MOTIVO_ATENCION_INTERRUMPIDA = "La atención se interrumpió"
export const destinoAlDejarDeAtender = (cita, hoy = ahoraEcuador()) => (cita?.fecha && cita.fecha < fechaAISO(hoy) ? "No Asistió" : "En Espera")

// Deja de atender la cita. Devuelve { estado } con el estado en que quedó, o { error }. Si la cita ya no estaba «En atención» (otra persona la cerró), no toca nada y lo dice (yaNoEstaba).
export async function dejarDeAtenderCita(cita) {
  if (!supabase) return { estado: destinoAlDejarDeAtender(cita), yaNoEstaba: false }
  const { data, error } = await supabase.rpc("dejar_de_atender_cita", { p_cita_id: cita.id })
  if (error) return { error }
  return { estado: data, yaNoEstaba: data !== "En Espera" && data !== "No Asistió" }
}

// Lo que cambia en la cita de la pantalla tras dejar de atender.
export const cambiosAlDejarDeAtender = (estado) => (estado === "En Espera" ? { estado, atendidoPor: null } : { estado })
