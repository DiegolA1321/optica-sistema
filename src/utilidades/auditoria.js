// Registro de actividad del superadmin (tabla `auditoria`, la que lista el panel "Actividad"). Solo el superadmin puede escribir ahí.
// Fire-and-forget como registrarLog: si falla (sin conexión, permiso) no debe romper la acción real; solo se pierde esa línea.
import { supabase } from "../lib/supabaseClient"

export async function registrarAuditoria(actor, accion, { opticaId = null, opticaNombre, detalle = null }) {
  if (!supabase || !actor?.id) return false
  try {
    const { error } = await supabase.from("auditoria").insert({
      actor_id: actor.id,
      actor_nombre: actor.nombre || "Superadmin",
      accion,
      optica_id: opticaId,
      optica_nombre: opticaNombre || "Óptica",
      detalle,
    })
    if (error) console.warn("[auditoria] no se pudo registrar:", error.message)
    return !error
  } catch {
    return false
  }
}
