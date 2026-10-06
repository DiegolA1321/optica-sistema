// ¿Puede quien tiene la sesión hacer esto? (para mostrar u ocultar botones; la base lo exige de todos modos)
// El administrador y el superadmin (también al entrar como una óptica) siempre pueden. Quien no
// tiene sus permisos cargados todavía no pierde botones: la base rechazará lo que no corresponda.
import { puedeNivel } from "./roles"

export function puede(usuario, modulo, nivel = "ver") {
  if (!usuario) return false
  if (usuario.rol === "admin" || usuario.rol === "superadmin") return true
  if (!usuario.permisosNivel) return true
  return puedeNivel(usuario.permisosNivel, modulo, nivel)
}
