// Búsqueda de texto sin tildes ni mayúsculas, compartida por las listas de Ventas (cola de pacientes y
// órdenes de laboratorio). Un texto vacío no filtra nada.
export const normalizarTexto = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export function coincideTexto(texto, ...campos) {
  const q = normalizarTexto(texto)
  if (!q) return true
  return campos.some((c) => normalizarTexto(c).includes(q))
}
