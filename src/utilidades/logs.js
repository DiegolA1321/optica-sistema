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
import { formatoFecha } from "./formatoFecha"

export const NOMBRE_MODULO = { pacientes: "Pacientes", consultas: "Ficha clínica", citas: "Citas médicas", crm: "CRM", inventario: "Inventario", ventas: "Ventas", reportes: "Reportes", horario: "Mi horario", mensajes: "Mensajes", configuracion: "Configuración", usuarios: "Usuarios y permisos" }

// El detalle de una línea de actividad, solo si lo entiende quien administra la óptica: un nombre, una fecha, un valor. Las notas técnicas
// (pruebas, scripts, migraciones, ids) no se muestran (regla 40).
export function detalleActividad(detalle) {
  const t = String(detalle || "").trim()
  if (!t) return ""
  if (/\be2e\b|limpieza|script|migraci[oó]n|\buuid\b|[0-9a-f]{8}-[0-9a-f]{4}-|no es una cita activa|identificable/i.test(t)) return ""
  // Las fechas con el formato del sistema ("19 feb 2028"), también en los registros viejos que se guardaron como "2028-02-19".
  return t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, (iso) => formatoFecha(iso, "medio") || iso)
}

// Acciones de ventas que las versiones anteriores guardaron bajo "pacientes" o "consultas": se muestran en "Ventas", que es su módulo.
const ACCIONES_DE_VENTAS = /orden(es)? de laboratorio|lentes están listos|abono|venta|factura electr|cobró la atención/i
export function moduloDeRegistro(log) {
  if ((log?.modulo === "pacientes" || log?.modulo === "consultas") && ACCIONES_DE_VENTAS.test(log.accion || "")) return "ventas"
  return log?.modulo
}

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
