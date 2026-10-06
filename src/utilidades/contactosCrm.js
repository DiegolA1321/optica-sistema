// Pacientes a los que ya se les escribió hoy desde el CRM. Límite "de buena
// fe" por navegador (no por servidor): el CRM solo abre WhatsApp, no manda
// nada solo. Lo comparten el CRM y el perfil del paciente, para que enviar un
// mensaje desde cualquiera de los dos quede reflejado en el otro.
import { hoyISO } from "./disponibilidad"

export const CLAVE_CONTACTOS_HOY = "optica_crm_contactos_hoy"

// { [pacienteId]: true } de hoy (hoyISO usa la fecha local: en Ecuador, UTC-5,
// toISOString reseteaba el límite 5 horas antes de la medianoche).
export function leerContactadosHoy() {
  try {
    const raw = JSON.parse(localStorage.getItem(CLAVE_CONTACTOS_HOY) || "{}")
    return raw[hoyISO()] || {}
  } catch {
    return {}
  }
}

// Marca al paciente como contactado hoy y devuelve el mapa actualizado.
export function marcarContactadoHoy(id) {
  const actual = leerContactadosHoy()
  if (id == null) return actual
  const siguiente = { ...actual, [id]: true }
  try { localStorage.setItem(CLAVE_CONTACTOS_HOY, JSON.stringify({ [hoyISO()]: siguiente })) } catch { /* sin almacenamiento: el límite solo se pierde */ }
  return siguiente
}
