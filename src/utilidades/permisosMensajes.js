// Los dos permisos que cada paciente da para recibir mensajes: "Recordatorios de salud" (control, citas) y "Promociones".
// Los cambia el personal (desde el perfil o el CRM) o el propio paciente (desde "Mis datos" del portal); el servidor anota quién y cuándo.
import { supabase } from "../lib/supabaseClient"

const TEXTO_RED = "No se pudo guardar. Revisa tu conexión e intenta de nuevo."
const textoDeError = (e) => (e?.message && !/fetch|network|JWT|permission denied|violates|relation/i.test(e.message) ? e.message : TEXTO_RED)

export const ETIQUETA_PERMISO = {
  recordatorios: { titulo: "Recordatorios de salud", ayuda: "Avisos de su control y de sus citas, y cómo le fue con sus lentes." },
  promociones: { titulo: "Promociones y saludos", ayuda: "Ofertas, novedades y saludos de la óptica, como el de cumpleaños." },
}

// Personal: cambia uno o los dos permisos de un paciente (null = no tocar). origen: "personal" (el perfil) o "crm".
export async function cambiarPermisosPaciente(pacienteId, { recordatorios = null, promociones = null }, origen = "personal") {
  if (!supabase) return { ok: true }
  const { error } = await supabase.rpc("cambiar_consentimiento_paciente", { p_paciente_id: pacienteId, p_recordatorios: recordatorios, p_promociones: promociones, p_origen: origen })
  return error ? { ok: false, error: textoDeError(error) } : { ok: true }
}

// Portal: lo que el paciente tiene dado hoy.
export async function leerMisPermisos(pacienteId, token) {
  if (!supabase) return { ok: true, recordatorios: true, promociones: false, actualizadoEn: null }
  const { data, error } = await supabase.rpc("mis_permisos_mensajes", { p_paciente_id: pacienteId, p_token: token })
  if (error || !data) return { ok: false, error: "No pudimos cargar tus permisos. Revisa tu conexión." }
  if (data.ok !== true) return { ok: false, error: data.error === "sesion" ? "Tu sesión venció. Cierra sesión y vuelve a entrar." : data.error || "No pudimos cargar tus permisos." }
  return { ok: true, recordatorios: data.recordatorios, promociones: data.promociones, actualizadoEn: data.actualizado_en || null }
}

// Portal: el paciente cambia sus permisos.
export async function cambiarMisPermisos(pacienteId, token, { recordatorios = null, promociones = null }) {
  if (!supabase) return { ok: true }
  const { data, error } = await supabase.rpc("actualizar_consentimiento_paciente", { p_paciente_id: pacienteId, p_token: token, p_recordatorios: recordatorios, p_promociones: promociones })
  if (error || !data) return { ok: false, error: TEXTO_RED }
  if (data.ok !== true) return { ok: false, error: data.error === "sesion" ? "Tu sesión venció. Cierra sesión y vuelve a entrar." : data.error || TEXTO_RED }
  return { ok: true, recordatorios: data.recordatorios, promociones: data.promociones, actualizadoEn: data.actualizado_en || null }
}
