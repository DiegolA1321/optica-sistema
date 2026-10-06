// Equipo de la óptica (admin y asistentes), tal como lo devuelve equipo_optica().

// Nombre de quien tiene ese id, o null si no se conoce (por ejemplo, una
// persona que ya no está en el equipo).
export function nombreDeMiembro(equipo, id) {
  if (!id) return null
  return equipo.find((m) => m.id === id)?.nombre || null
}

// Texto para mostrar: el nombre, o una nota si la persona ya no figura en el equipo.
export function etiquetaMiembro(equipo, id) {
  if (!id) return null
  return nombreDeMiembro(equipo, id) || "Persona que ya no está en el equipo"
}

// Quienes siguen activos (las cuentas desactivadas conservan su nombre en las citas viejas,
// pero ya no se ofrecen en selectores ni en el horario del equipo).
export const miembrosActivos = (equipo) => equipo.filter((m) => m.activo !== false)

// Opciones del selector "Asignado a": solo activos, más la persona ya asignada si fue desactivada.
export function opcionesAsignables(equipo, valorActual) {
  const activos = miembrosActivos(equipo)
  const actual = valorActual && !activos.some((m) => m.id === valorActual) ? equipo.find((m) => m.id === valorActual) : null
  return actual ? [...activos, actual] : activos
}
