// Lo que el portal le pide a la base sobre los lentes, el control y el detalle de las citas del paciente (migraciones 0123 y 0125). Mismo token de sesión que las demás
// funciones del portal. Si una función todavía no existe o algo falla, simplemente no hay ese dato que mostrar: el resto del portal sigue igual.
import { supabase } from "../lib/supabaseClient"
import { mapOrdenPaciente } from "./portalPaciente"

// Con ?_muestra=detalle (solo en desarrollo) el detalle de las citas es de ejemplo, para revisar la pantalla antes de aplicar la migración 0125.
export const modoMuestraPortal = () => {
  if (!import.meta.env?.DEV || typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("_muestra")
  return v === "detalle" ? v : null
}

export async function misOrdenes(pacienteId, token) {
  if (!supabase) return { ordenes: [], disponible: false }
  const { data, error } = await supabase.rpc("mis_ordenes_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { ordenes: [], disponible: false }
  return { ordenes: data.map(mapOrdenPaciente), disponible: true }
}

export async function miControl(pacienteId, token) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc("mi_control_paciente", { p_paciente_id: pacienteId, p_token: token })
  return error || !data ? null : data
}

// { [citaId]: { profesional, confirmadaAt, consultaId, calificacion } } y si la base ya lo entrega.
export async function misCitasDetalle(pacienteId, token, citas = []) {
  if (modoMuestraPortal()) {
    return { disponible: true, porCita: Object.fromEntries(citas.map((c, i) => [c.id, { profesional: "Paula Optómetra Demo", confirmadaAt: null, consultaId: c.estado === "Atendida" ? "muestra-" + i : null, calificacion: null }])) }
  }
  if (!supabase) return { disponible: false, porCita: {} }
  const { data, error } = await supabase.rpc("mis_citas_detalle_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { disponible: false, porCita: {} }
  return { disponible: true, porCita: Object.fromEntries(data.map((d) => [d.cita_id, { profesional: d.profesional || "", confirmadaAt: d.confirmada_at, consultaId: d.consulta_id, calificacion: d.calificacion, enCalendarioAt: d.en_calendario_at || null }])) }
}

export async function confirmarAsistencia(pacienteId, token, citaId) {
  if (modoMuestraPortal()) return { ok: true }
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { data, error } = await supabase.rpc("confirmar_asistencia_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId })
  return error || data !== true ? { ok: false, error: "No pudimos confirmar tu asistencia. Intenta de nuevo en un momento." } : { ok: true }
}

export async function calificarAtencion(pacienteId, token, citaId, puntaje, comentario) {
  if (modoMuestraPortal()) return { ok: true }
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { data, error } = await supabase.rpc("calificar_atencion_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId, p_puntaje: puntaje, p_comentario: comentario || null })
  return error || data !== true ? { ok: false, error: "No pudimos guardar tu calificación. Es posible que ya la hayas enviado." } : { ok: true }
}

// Cuántos pacientes refirió este paciente (migración 0128): el único dato de sus puntos que el portal no puede contar solo. Sin la función, 0: los puntos salen solo de sus consultas.
export async function misReferidos(pacienteId, token) {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc("mis_referidos_paciente", { p_paciente_id: pacienteId, p_token: token })
  return error || typeof data !== "number" ? 0 : data
}

// Marca en la base que el paciente agregó la cita a su calendario (migración 0127): así vale en todos sus aparatos. Devuelve { ok }.
export async function marcarCitaEnCalendario(pacienteId, token, citaId) {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId })
  return { ok: !error && data === true }
}
