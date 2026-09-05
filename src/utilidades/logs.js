// Log de actividad por usuario — caso "Usuarios y permisos" de la reunión
// con el ing (punto 8, ver migración 0048_es_optometra_y_logs_optica.sql).
// Cada acción relevante de un asistente/admin dentro de una óptica queda
// registrada para que el administrador principal sepa quién hizo qué —
// ejemplo del propio ing: "tengo tres asistentes, se eliminó un producto de
// inventario, ¿cómo sé quién lo hizo?".
//
// Fire-and-forget a propósito: si el log falla (sin conexión, RLS, etc.) no
// debe romper ni revertir la acción real del usuario, solo se pierde el
// registro de auditoría de esa vez.
import { supabase } from "../lib/supabaseClient"

export async function registrarLog(usuario, modulo, accion, detalle = "") {
  if (!supabase || !usuario?.opticaId || !usuario?.id) return
  try {
    await supabase.from("logs_optica").insert({
      optica_id: usuario.opticaId,
      usuario_id: usuario.id,
      usuario_nombre: usuario.nombre || "Usuario",
      modulo,
      accion,
      detalle,
    })
  } catch {
    // silencioso a propósito — ver nota arriba
  }
}
