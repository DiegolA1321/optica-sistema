// Compartido entre SuperadminPanel.jsx y Usuarios.jsx (los dos puntos que
// llaman a la Edge Function eliminar-cuenta-auth) — antes esta misma
// función vivía copiada tal cual dentro de SuperadminPanel.jsx; al
// extender el Punto 02 para que Usuarios.jsx también use la Edge Function
// (2026-09-10), se movió acá para no duplicar la lógica de parseo de error
// en el segundo lugar que la necesita.
//
// Cuando la función responde con un status que no es 2xx, supabase-js no
// mete el cuerpo JSON en `data` — hay que leerlo aparte de `error.context`
// (la Response cruda) para mostrar el mensaje real en vez de un genérico
// "non-2xx status code".
export async function mensajeErrorEdgeFunction(errorInvoke, data) {
  if (!errorInvoke) return data?.error || null
  if (errorInvoke.context?.json) {
    try {
      const cuerpo = await errorInvoke.context.json()
      if (cuerpo?.error) return cuerpo.error
    } catch { /* respuesta sin cuerpo JSON legible */ }
  }
  return errorInvoke.message || "No se pudo completar la eliminación."
}
