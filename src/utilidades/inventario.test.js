import { describe, it, expect } from "vitest"
import { esStockBajo, minimoDe, umbralStock, UMBRAL_STOCK_BAJO } from "./inventario"

describe("esStockBajo", () => {
  it("por defecto el umbral es 10: con 10 o menos es stock bajo", () => {
    expect(UMBRAL_STOCK_BAJO).toBe(10)
    expect(esStockBajo({ stock: 10 })).toBe(true)
    expect(esStockBajo({ stock: 11 })).toBe(false)
  })
  it("un mínimo propio del producto reemplaza al general, para más o para menos", () => {
    expect(esStockBajo({ stock: 8, critico: 3 })).toBe(false)
    expect(esStockBajo({ stock: 3, critico: 3 })).toBe(true)
    expect(esStockBajo({ stock: 12, critico: 20 })).toBe(true)
    expect(esStockBajo({ stock: 12, critico: 20 }, 5)).toBe(true)
  })
  it("sin mínimo propio (vacío, nulo o inválido) vale el general", () => {
    for (const critico of [null, undefined, "", "abc", -2]) expect(minimoDe({ critico }, 7)).toBe(7)
    expect(minimoDe({ critico: 0 }, 7)).toBe(0)
    expect(minimoDe({ critico: "4" }, 7)).toBe(4)
  })
  it("usa el umbral que se le pase", () => {
    expect(esStockBajo({ stock: 5 }, 4)).toBe(false)
    expect(esStockBajo({ stock: 4 }, 4)).toBe(true)
  })
  it("sin stock cuenta como bajo y no revienta con datos vacíos", () => {
    expect(esStockBajo({})).toBe(true)
    expect(esStockBajo(null)).toBe(true)
  })
})

describe("umbralStock", () => {
  it("sale de Configuración (stockMinimo) y por defecto es 10", () => {
    expect(umbralStock({ stockMinimo: 15 })).toBe(15)
    expect(umbralStock({ stockMinimo: 0 })).toBe(0)
    expect(umbralStock({})).toBe(10)
    expect(umbralStock(null)).toBe(10)
    expect(umbralStock({ stockMinimo: "abc" })).toBe(10)
    expect(umbralStock({ stockMinimo: -3 })).toBe(10)
  })
})
