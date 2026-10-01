// Costo base de la consulta por motivo (Ronda 4 del flujo de atención).
// Vive en parametrizacion.costosMotivo ({ "Consulta General": 15, ... }), dentro
// de opticas.settings (jsonb) — sin columna nueva. Un motivo sin costo
// configurado cuesta 0: el panel de cobro lo trae precargado y es editable.
export function costoBaseMotivo(parametrizacion, motivo) {
  const v = Number(parametrizacion?.costosMotivo?.[motivo])
  return Number.isFinite(v) && v >= 0 ? v : 0
}

// Al renombrar un motivo en el catálogo, su costo se mueve con él.
export function renombrarCostoMotivo(costos = {}, viejo, nuevo) {
  if (!(viejo in costos) || viejo === nuevo) return costos
  const { [viejo]: valor, ...resto } = costos
  return { ...resto, [nuevo]: valor }
}
