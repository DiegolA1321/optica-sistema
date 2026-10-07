// Umbral único de "stock bajo" para todo el inventario: lo fija el administrador en Configuración
// (parametrizacion.stockMinimo) y por defecto es 10, como pidió el ingeniero en la reunión del 29 de
// septiembre ("el stock mínimo va a ser 10: cualquiera de 10 para abajo es de stock bajo").
// Un producto puede tener su propio mínimo (campo opcional "critico"): si lo tiene, reemplaza al general solo para ese producto.
export const UMBRAL_STOCK_BAJO = 10

export function umbralStock(parametrizacion) {
  const n = Number(parametrizacion?.stockMinimo)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : UMBRAL_STOCK_BAJO
}

// Mínimo que vale para un producto: el suyo si lo definió; si no, el general.
export function minimoDe(producto, umbral = UMBRAL_STOCK_BAJO) {
  const propio = producto?.critico
  if (propio === null || propio === undefined || propio === "") return umbral
  const n = Number(propio)
  return Number.isFinite(n) && n >= 0 ? n : umbral
}

export function esStockBajo(producto, umbral = UMBRAL_STOCK_BAJO) {
  const stock = Number(producto?.stock) || 0
  return stock <= minimoDe(producto, umbral)
}
