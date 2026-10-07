// Umbral único de "stock bajo" para todo el inventario: lo fija el administrador en Configuración
// (parametrizacion.stockMinimo) y por defecto es 10, como pidió el ingeniero en la reunión del 29 de
// septiembre ("el stock mínimo va a ser 10: cualquiera de 10 para abajo es de stock bajo").
// Ya no hay un mínimo distinto por producto: un mismo número alerta igual en Inicio, Inventario y avisos.
export const UMBRAL_STOCK_BAJO = 10

export function umbralStock(parametrizacion) {
  const n = Number(parametrizacion?.stockMinimo)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : UMBRAL_STOCK_BAJO
}

export function esStockBajo(producto, umbral = UMBRAL_STOCK_BAJO) {
  const stock = Number(producto?.stock) || 0
  return stock <= umbral
}
