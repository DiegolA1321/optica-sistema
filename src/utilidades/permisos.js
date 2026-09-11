// Si el admin le revoca un módulo a un asistente mientras tiene sesión
// abierta, RLS corta la escritura en el próximo request (tiene_permiso_modulo
// se evalúa en cada uno). Pero eso se ve distinto según el tipo de operación:
// un INSERT rechazado por el WITH CHECK sí lanza un error real de Postgres
// (código 42501), mientras que un UPDATE/DELETE bloqueado por el USING no
// lanza ningún error — simplemente afecta 0 filas en silencio. Por eso cada
// UPDATE/DELETE de un módulo gateado por permiso debe agregar `.select()` y
// tratar "sin error pero 0 filas" como el mismo caso que un 42501 explícito.
export const MENSAJE_SIN_PERMISO = "Ya no tienes permiso para esta acción. Contacta a tu administrador."

export function esErrorSinPermiso(error) {
  if (!error) return false
  if (error.code === "42501") return true
  const mensaje = String(error.message || "").toLowerCase()
  return mensaje.includes("row-level security") || mensaje.includes("permission denied")
}

// Para UPDATE/DELETE: agrega `.select()` a la llamada y pasa aquí { error, data }.
// Sin error pero 0 filas afectadas = bloqueado por RLS, no "nada que actualizar".
export function fueBloqueadoPorPermiso({ error, data }) {
  if (esErrorSinPermiso(error)) return true
  return !error && Array.isArray(data) && data.length === 0
}
