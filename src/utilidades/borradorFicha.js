// Guardado automático de la ficha clínica: mientras el optómetra escribe, la ficha se guarda sola como borrador en ESTE navegador (no en la base): si se corta la luz, se cierra la pestaña o
// se recarga la página, al volver a abrir la ficha de ese paciente y esa cita recupera todo. Se borra al terminar la atención, al dejar de atender y a las 24 horas; no sale del equipo.
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
