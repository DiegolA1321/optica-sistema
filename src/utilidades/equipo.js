// Equipo de la óptica (admin y asistentes), tal como lo devuelve equipo_optica().

// Nombre de quien tiene ese id, o null si no se conoce (por ejemplo, una
// persona que ya no está en el equipo).
export function nombreDeMiembro(equipo, id) {
  if (!id) return null
  return equipo.find((m) => m.id === id)?.nombre || null
}
