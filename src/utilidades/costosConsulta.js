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

// Líneas con las que arranca el panel de cobro de una consulta: la consulta
// (costo base del motivo, editable, puede ser 0) y el lente recomendado si
// quedó vinculado a un producto de inventario (consultas.datos_clinicos
// .lente_producto_id). Compartido por la ficha, Citas y el perfil, para que
// cobrar "más tarde" no pierda el lente.
export function lineasCobroConsulta({ motivo, lenteProductoId }, parametrizacion) {
  return [
    { tipo: "servicio", descripcion: `Consulta${motivo ? ` — ${motivo}` : ""}`, cantidad: 1, precioUnitario: costoBaseMotivo(parametrizacion, motivo) },
    ...(lenteProductoId ? [{ tipo: "producto", productoId: lenteProductoId, cantidad: 1 }] : []),
  ]
}
