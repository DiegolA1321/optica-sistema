// Umbral único de "stock bajo" — antes Inventario.jsx usaba 3 y Inicio.jsx/Dashboard.jsx
// usaban 5 (su propio valor por defecto), así que un mismo producto podía verse "sano" en
// un módulo y disparar alertas en otro. Un solo lugar para este número.
export const UMBRAL_STOCK_BAJO = 3

export function esStockBajo(producto) {
  const stock = Number(producto?.stock) || 0
  const critico = Number(producto?.critico || producto?.minimo || UMBRAL_STOCK_BAJO) || UMBRAL_STOCK_BAJO
  return stock <= critico
}
