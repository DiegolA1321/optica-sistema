// Vistas (R50): una persona con más de un rol, o administrador que también atiende, puede cambiar de
// vista desde el menú de usuario para enfocarse en lo suyo (menú, Inicio y alcance de Citas y Reportes).
// La vista NO es una frontera de seguridad: la base aplica la suma de los permisos de todos sus roles.
import { permisosCompletos } from "./roles"

export const VISTA_ADMIN_ID = "administrador"

export function construirVistas(usuario, rolesDetalle = []) {
  const vistas = []
  if (usuario?.rol === "admin") {
    vistas.push({ id: VISTA_ADMIN_ID, nombre: "Administrador", tipo: "admin", inicio: "administrador", permisos: permisosCompletos(), alcance: {}, atiende: false })
  }
  const ids = new Set((usuario?.roles || []).map((r) => r.id))
  for (const r of rolesDetalle) {
    if (!ids.has(r.id)) continue
    vistas.push({ id: r.id, nombre: r.nombre, tipo: "rol", inicio: r.inicio || "general", permisos: r.permisos || {}, alcance: r.alcance || {}, atiende: !!r.atiende_pacientes })
  }
  return vistas
}

export const clavePreferenciaVista = (usuarioId) => `optica_vista_${usuarioId}`

// La vista guardada si todavía existe; si no, la primera (Administrador, o el primer rol).
export function elegirVista(vistas, guardadaId) {
  return vistas.find((v) => v.id === guardadaId) || vistas[0] || null
}
