// Guardado automático de la ficha clínica: mientras el optómetra escribe, la ficha se guarda sola como borrador. Con la base conectada el borrador vive en la base de datos (cifrado como las fichas,
// por paciente y cita): se recupera desde cualquier computadora, dura 7 días y la cita reagendada lo hereda. Se borra al terminar o al descartar la atención. Sin base (pruebas, modo local) queda en este
// navegador, con la clave de abajo, y vence a las 24 horas.
import { supabase } from "../lib/supabaseClient"

const PREFIJO = "ficha-borrador:"
const VIGENCIA_MS = 24 * 60 * 60 * 1000

export const claveBorrador = (usuarioId, pacienteId, citaId) => (usuarioId && pacienteId ? `${PREFIJO}${usuarioId}:${pacienteId}:${citaId || "directa"}` : null)

export function guardarBorrador(clave, datos, ahora = Date.now()) {
  if (!clave) return false
  try { localStorage.setItem(clave, JSON.stringify({ v: 1, guardadoEn: ahora, datos })); return true } catch { return false }
}

// { datos, guardadoEn } o null (sin borrador, vencido o ilegible).
export function leerBorrador(clave, ahora = Date.now()) {
  if (!clave) return null
  try {
    const crudo = localStorage.getItem(clave)
    if (!crudo) return null
    const b = JSON.parse(crudo)
    if (!b || b.v !== 1 || !b.datos || ahora - b.guardadoEn > VIGENCIA_MS) { localStorage.removeItem(clave); return null }
    return { datos: b.datos, guardadoEn: b.guardadoEn }
  } catch { return null }
}

export function borrarBorrador(clave) { try { if (clave) localStorage.removeItem(clave) } catch { /* sin almacenamiento */ } }

// Al cerrar sesión no queda ninguna ficha a medias en el equipo.
export function borrarTodosLosBorradores() {
  try { for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIJO)) localStorage.removeItem(k) } catch { /* sin almacenamiento */ }
}

// «Guardado hace 5 s» · «Guardado hace 2 min».
export function textoGuardado(guardadoEn, ahora = Date.now()) {
  if (guardadoEn == null) return "El borrador se guarda solo mientras escribes"
  const s = Math.max(0, Math.round((ahora - guardadoEn) / 1000))
  if (s < 5) return "Guardado ahora"
  if (s < 60) return `Guardado hace ${s} s`
  const m = Math.floor(s / 60)
  return m < 60 ? `Guardado hace ${m} min` : `Guardado hace ${Math.floor(m / 60)} h`
}

// ── En la base de datos (0138). Los ids reales son uuid; cualquier otro (pruebas) cae al navegador. ──
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const borradorEnBase = (pacienteId, citaId) => Boolean(supabase) && UUID.test(String(pacienteId || "")) && (!citaId || UUID.test(String(citaId)))

// Guarda (o reemplaza) el borrador; devuelve el instante guardado (ms) o null si no se pudo.
export async function guardarBorradorFicha({ usuarioId, pacienteId, citaId }, datos) {
  if (!borradorEnBase(pacienteId, citaId)) return guardarBorrador(claveBorrador(usuarioId, pacienteId, citaId), datos) ? Date.now() : null
  const { data, error } = await supabase.rpc("guardar_borrador_ficha", { p_paciente_id: pacienteId, p_cita_id: citaId || null, p_datos: datos })
  if (error) return null
  return data ? new Date(data).getTime() : Date.now()
}

// { datos, guardadoEn } o null.
export async function leerBorradorFicha({ usuarioId, pacienteId, citaId }) {
  if (!borradorEnBase(pacienteId, citaId)) return leerBorrador(claveBorrador(usuarioId, pacienteId, citaId))
  const { data, error } = await supabase.rpc("leer_borrador_ficha", { p_paciente_id: pacienteId, p_cita_id: citaId || null })
  const fila = Array.isArray(data) ? data[0] : data
  if (error || !fila?.datos) return null
  return { datos: fila.datos, guardadoEn: new Date(fila.guardado_en).getTime() }
}

export async function borrarBorradorFicha({ usuarioId, pacienteId, citaId }) {
  if (!borradorEnBase(pacienteId, citaId)) { borrarBorrador(claveBorrador(usuarioId, pacienteId, citaId)); return }
  await supabase.rpc("borrar_borrador_ficha", { p_paciente_id: pacienteId, p_cita_id: citaId || null })
}

// La cita reagendada (nueva) hereda el borrador de la que no se efectuó. Devuelve si había algo que heredar.
export async function heredarBorradorFicha({ usuarioId, pacienteId, citaOrigenId, citaNuevaId }) {
  if (!borradorEnBase(pacienteId, citaOrigenId) || !UUID.test(String(citaNuevaId || ""))) {
    const origen = claveBorrador(usuarioId, pacienteId, citaOrigenId), destino = claveBorrador(usuarioId, pacienteId, citaNuevaId)
    const b = leerBorrador(origen)
    return Boolean(b && destino && origen !== destino && guardarBorrador(destino, b.datos, b.guardadoEn))
  }
  const { data, error } = await supabase.rpc("heredar_borrador_ficha", { p_cita_origen: citaOrigenId, p_cita_nueva: citaNuevaId })
  return !error && data === true
}
