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

import { UMBRAL_STOCK_MAXIMO, umbralMaximo, maximoDe, esSobrestock, estadoDeStock, proporcionDeStock, avisoDeSobrestock, productoExistente } from "./inventario"

describe("stock máximo y sobrestock", () => {
  it("el máximo general sale de la parametrización y, sin guardar o con un valor inválido, es el de siempre", () => {
    expect(umbralMaximo({ stockMaximo: 50 })).toBe(50)
    expect(umbralMaximo({ stockMaximo: "40" })).toBe(40)
    for (const malo of [undefined, {}, { stockMaximo: 0 }, { stockMaximo: -3 }, { stockMaximo: "abc" }, { stockMaximo: null }]) expect(umbralMaximo(malo)).toBe(UMBRAL_STOCK_MAXIMO)
  })
  it("cada producto usa el general («usar el general») o el suyo", () => {
    expect(maximoDe({ stock: 5 }, 30)).toBe(30)
    expect(maximoDe({ stock: 5, maximo: null }, 30)).toBe(30)
    expect(maximoDe({ stock: 5, maximo: "" }, 30)).toBe(30)
    expect(maximoDe({ stock: 5, maximo: 20 }, 30)).toBe(20)
    expect(maximoDe({ stock: 5, maximo: 0 }, 30)).toBe(30)
  })
  it("sobrestock es tener más que el máximo; tener justo el máximo no lo es, y el máximo no limita nada", () => {
    expect(esSobrestock({ stock: 31 }, 30, 5)).toBe(true)
    expect(esSobrestock({ stock: 30 }, 30, 5)).toBe(false)
    expect(esSobrestock({ stock: 38, maximo: 50 }, 30, 5)).toBe(false) // su máximo propio manda
    expect(esSobrestock({ stock: 25, maximo: 20 }, 30, 5)).toBe(true)
  })
  it("un producto en stock bajo nunca está en sobrestock", () => {
    expect(esSobrestock({ stock: 4, critico: 5, maximo: 3 }, 30, 10)).toBe(false)
    expect(estadoDeStock({ stock: 4, critico: 5, maximo: 3 }, 10, 30)).toBe("bajo")
  })
  it("el estado es bajo, sobre o normal, con el mínimo y el máximo generales o propios", () => {
    expect(estadoDeStock({ stock: 4, critico: 5 }, 10, 30)).toBe("bajo")
    expect(estadoDeStock({ stock: 38 }, 5, 30)).toBe("sobre")
    expect(estadoDeStock({ stock: 17 }, 5, 30)).toBe("normal")
    expect(estadoDeStock({ stock: 10 }, 10, 30)).toBe("bajo") // el mínimo general entra
  })
  it("la barrita llena la proporción del máximo y nunca pasa del 100 %", () => {
    expect(proporcionDeStock({ stock: 15 }, 30)).toBe(0.5)
    expect(proporcionDeStock({ stock: 38 }, 30)).toBe(1)
    expect(proporcionDeStock({ stock: 0 }, 30)).toBe(0)
    expect(proporcionDeStock({ stock: 10, maximo: 20 }, 30)).toBe(0.5)
  })
})

describe("el aviso de un ingreso que pasa del máximo", () => {
  it("dice con cuánto quedarías y cuánto pasa del máximo, sin bloquear", () => {
    expect(avisoDeSobrestock({ existencia: 38, ingreso: 20, maximo: 30 })).toBe("Quedarías con 58 u., casi el doble de tu máximo (30). Puedes registrarlo igual.")
    expect(avisoDeSobrestock({ existencia: 20, ingreso: 15, maximo: 30 })).toBe("Quedarías con 35 u., más de tu máximo (30). Puedes registrarlo igual.")
    expect(avisoDeSobrestock({ existencia: 30, ingreso: 40, maximo: 30 })).toBe("Quedarías con 70 u., más del doble de tu máximo (30). Puedes registrarlo igual.")
  })
  it("sin aviso si no pasa del máximo, si no hay ingreso o si no hay máximo", () => {
    expect(avisoDeSobrestock({ existencia: 10, ingreso: 20, maximo: 30 })).toBe("") // queda justo en el máximo
    expect(avisoDeSobrestock({ existencia: 38, ingreso: 0, maximo: 30 })).toBe("")
    expect(avisoDeSobrestock({ existencia: 38, ingreso: "", maximo: 30 })).toBe("")
    expect(avisoDeSobrestock({ existencia: 1, ingreso: 99, maximo: undefined })).toBe("")
  })
})

describe("el producto que ya existe", () => {
  const productos = [{ id: "a", nombre: "Estuche rígido", activo: false }, { id: "b", nombre: "Líquido limpiador 60 ml", activo: true }]
  it("se encuentra sin importar mayúsculas, tildes ni espacios, activo o descontinuado", () => {
    expect(productoExistente(productos, "  ESTUCHE   rigido ")?.id).toBe("a")
    expect(productoExistente(productos, "liquido limpiador 60 ML")?.id).toBe("b")
  })
  it("un nombre nuevo o vacío no choca, y al editar un producto no choca consigo mismo", () => {
    expect(productoExistente(productos, "Cordón para gafas")).toBeNull()
    expect(productoExistente(productos, "   ")).toBeNull()
    expect(productoExistente(productos, "Estuche rígido", "a")).toBeNull()
  })
})

import { esErrorDeMaximoNoDisponible, MENSAJE_MAXIMO_NO_DISPONIBLE } from "./inventario"
describe("el máximo propio sin la columna en la base", () => {
  it("se reconoce el error de la columna que falta y se explica sin palabras técnicas", () => {
    expect(esErrorDeMaximoNoDisponible({ message: "Could not find the 'stock_maximo' column of 'inventario' in the schema cache" })).toBe(true)
    expect(esErrorDeMaximoNoDisponible({ message: 'column "stock_maximo" of relation "inventario" does not exist' })).toBe(true)
    expect(esErrorDeMaximoNoDisponible({ message: "permission denied for table inventario" })).toBe(false)
    expect(esErrorDeMaximoNoDisponible(null)).toBe(false)
    expect(MENSAJE_MAXIMO_NO_DISPONIBLE).toMatch(/Déjalo vacío para usar el general/)
  })
})
