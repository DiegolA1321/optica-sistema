// Calendario por intensidad (R9): cuánta atención tuvo o tendrá cada día.
// Las citas canceladas no cuentan: no ocupan agenda.

export const NIVELES_CARGA = 4

// Citas que cuentan para la carga de un día.
export const citasQueCuentan = (citas = []) => citas.filter((c) => c.estado !== "Cancelada")

// 0 si el día no tiene citas; de 1 a 4 según qué tan cerca está del día más
// cargado del mes (el día con más citas es siempre nivel 4).
export function nivelCarga(cantidad, maximo) {
  if (!cantidad || !maximo) return 0
  return Math.min(NIVELES_CARGA, Math.max(1, Math.ceil((cantidad / maximo) * NIVELES_CARGA)))
}
