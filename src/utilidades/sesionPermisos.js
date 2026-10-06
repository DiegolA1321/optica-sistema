// Permisos de quien inició sesión (mis_permisos, migración 0090): niveles por módulo, roles,
// alcance y si la cuenta sigue activa. Se pide al entrar y se refresca mientras la sesión sigue abierta.
import { modulosVisibles, permisosCompletos, normalizarPermisosRol } from "./roles"

// Devuelve { activo, permisosNivel, roles, alcance, permisos } o null si no se pudo consultar.
// `permisos` (módulo → true/false) es lo que usa el menú; sale de los niveles ("ver").
export function extrasDePermisos(m) {
  if (!m) return null
  const permisosNivel = m.rol === "admin" || m.rol === "superadmin" ? permisosCompletos() : normalizarPermisosRol(m.permisos || {})
  return {
    activo: m.activo !== false,
    permisosNivel,
    permisos: modulosVisibles(permisosNivel),
    roles: Array.isArray(m.roles) ? m.roles : [],
    alcance: m.alcance || {},
  }
}

export async function cargarMisPermisos(supabase) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc("mis_permisos")
  if (error || !data) return null
  return extrasDePermisos(data)
}

export const MENSAJE_CUENTA_DESACTIVADA = "Tu cuenta fue desactivada. Contacta al administrador de tu óptica."
