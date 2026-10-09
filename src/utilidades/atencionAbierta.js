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

export const textoAtencionAbierta = (dias) => `Atención abierta desde hace ${dias} día${dias === 1 ? "" : "s"}`

// Deja de atender la cita: vuelve a Pendiente y deja de figurar quien atendía.
// Si su fecha ya pasó, el sistema la marcará como "No asistió" solo.
export async function dejarDeAtenderCita(cita) {
  if (!supabase) return { error: null }
  const { error } = await supabase.from("citas").update({ estado: "Pendiente", atendido_por: null }).eq("id", cita.id)
  return { error }
}
