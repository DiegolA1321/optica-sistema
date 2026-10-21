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

// Texto para mostrar cuando una llamada a la base falla. Nunca deja pasar un error crudo de la base en inglés ("permission denied for
// table roles"): un permiso negado se dice en español y cualquier otro error técnico cae al texto de la acción. Los mensajes que
// escriben nuestras propias funciones (en español) sí se muestran, porque explican qué pasó.
export function mensajeDeError(error, porDefecto = "No se pudo completar la acción. Intenta de nuevo.") {
  if (!error) return porDefecto
  if (esErrorSinPermiso(error)) return MENSAJE_SIN_PERMISO
  const mensaje = String(error.message || "").trim()
  if (!mensaje) return porDefecto
  const tecnico = /^(permission|relation|function|column|violates|duplicate key|null value|invalid input|syntax error|new row|could not|operator|type|JWT|FetchError|Failed to fetch|NetworkError|TypeError)/i.test(mensaje) || /\b(violates|constraint|schema cache|PGRST\d+)\b/i.test(mensaje)
  return tecnico ? porDefecto : mensaje
}
