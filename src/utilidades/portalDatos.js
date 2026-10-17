// Lo que el portal le pide a la base sobre los lentes y el control del paciente (migración 0123). Mismo token de sesión que las demás funciones del
// portal. Mientras la migración no esté aplicada, o si algo falla, simplemente no hay lentes ni control que mostrar: el resto del portal sigue igual.
import { supabase } from "../lib/supabaseClient"
import { hoyISO, isoAFechaLocal, fechaAISO } from "./disponibilidad"
import { mapOrdenPaciente } from "./portalPaciente"

const sumarDias = (iso, dias) => { const d = isoAFechaLocal(iso); d.setDate(d.getDate() + dias); return fechaAISO(d) }

// Con ?_muestra=lentes (solo en desarrollo) se usan datos de ejemplo, para revisar la pantalla antes de aplicar la migración.
export const modoMuestraPortal = () => {
  if (!import.meta.env?.DEV || typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("_muestra")
  return v === "lentes" || v === "listos" ? v : null
}
const ordenDeMuestra = (modo) => {
  const hoy = hoyISO()
  return modo === "listos"
    ? { id: "muestra-1", numero: 12, estado: "lista", fecha_prometida: sumarDias(hoy, -1), tipo_lente: "progresivo", montura: "Ray-Ban Aviator", factura_id: "muestra-f", creada_en: `${sumarDias(hoy, -9)}T15:00:00Z`, lista_el: `${hoy}T14:00:00Z`, entregada_el: null }
    : { id: "muestra-1", numero: 12, estado: "enviada", fecha_prometida: sumarDias(hoy, 6), tipo_lente: "progresivo", montura: "Ray-Ban Aviator", factura_id: "muestra-f", creada_en: `${sumarDias(hoy, -2)}T15:00:00Z`, lista_el: null, entregada_el: null }
}

export async function misOrdenes(pacienteId, token) {
  const modo = modoMuestraPortal()
  if (modo) return { ordenes: [ordenDeMuestra(modo)].map(mapOrdenPaciente), disponible: true }
  if (!supabase) return { ordenes: [], disponible: false }
  const { data, error } = await supabase.rpc("mis_ordenes_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { ordenes: [], disponible: false }
  return { ordenes: data.map(mapOrdenPaciente), disponible: true }
}

export async function miControl(pacienteId, token) {
  const modo = modoMuestraPortal()
  if (modo) return { ultima_consulta: sumarDias(hoyISO(), -150), proximo_control_dias: 180, de_alta: false }
  if (!supabase) return null
  const { data, error } = await supabase.rpc("mi_control_paciente", { p_paciente_id: pacienteId, p_token: token })
  return error || !data ? null : data
}
