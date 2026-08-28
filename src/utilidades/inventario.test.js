import { describe, it, expect } from "vitest"
import { esStockBajo, UMBRAL_STOCK_BAJO } from "./inventario"

describe("esStockBajo", () => {
  it("usa el umbral por defecto si el producto no define uno propio", () => {
    expect(esStockBajo({ stock: UMBRAL_STOCK_BAJO })).toBe(true)
    expect(esStockBajo({ stock: UMBRAL_STOCK_BAJO + 1 })).toBe(false)
  })

  it("respeta un umbral crítico propio del producto", () => {
    expect(esStockBajo({ stock: 10, critico: 12 })).toBe(true)
    expect(esStockBajo({ stock: 10, critico: 5 })).toBe(false)
  })

  it("acepta `minimo` como alias de `critico`", () => {
    expect(esStockBajo({ stock: 4, minimo: 5 })).toBe(true)
  })

  it("stock/producto vacío o inválido no revienta", () => {
    expect(esStockBajo({})).toBe(true) // stock 0 <= umbral por defecto
    expect(esStockBajo(null)).toBe(true)
    expect(esStockBajo(undefined)).toBe(true)
  })
})
