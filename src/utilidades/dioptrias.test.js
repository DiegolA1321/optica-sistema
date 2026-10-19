import { describe, it, expect } from "vitest"
import { formatoDioptria, normalizarDioptria, conSigno, pasoDioptria, normalizarEje, pasoEje, redondearCuarto } from "./dioptrias"

describe("dioptrías: de 0,25 en 0,25 y con signo", () => {
  it("lleva lo escrito al cuarto más cercano", () => {
    expect(normalizarDioptria("1.3")).toBe("+1.25")
    expect(normalizarDioptria("-0.6")).toBe("-0.50")
    expect(normalizarDioptria("-0,87")).toBe("-0.75")
    expect(normalizarDioptria("2")).toBe("+2.00")
    expect(normalizarDioptria("0.1")).toBe("0.00")
    expect(normalizarDioptria("−1.75")).toBe("-1.75")
  })
  it("sin número queda vacío", () => {
    for (const t of ["", " ", "+", "-", "abc"]) expect(normalizarDioptria(t)).toBe("")
  })
  it("cada valor ya válido se queda igual", () => {
    for (const v of ["+0.25", "-0.25", "+10.00", "-12.50", "0.00"]) expect(normalizarDioptria(v)).toBe(v)
  })
  it("el signo se pone fácil: + y − fijan el signo sin tocar la cifra", () => {
    expect(conSigno("1.25", -1)).toBe("-1.25")
    expect(conSigno("-1.25", 1)).toBe("+1.25")
    expect(conSigno("", -1)).toBe("-")
    expect(conSigno("0,5", 1)).toBe("+0.5")
  })
  it("↑ y ↓ suben o bajan un cuarto", () => {
    expect(pasoDioptria("+0.25", 0.25)).toBe("+0.50")
    expect(pasoDioptria("0.00", -0.25)).toBe("-0.25")
    expect(pasoDioptria("-0.25", 0.25)).toBe("0.00")
    expect(pasoDioptria("", 0.25)).toBe("+0.25")
  })
  it("redondea al cuarto", () => { expect(redondearCuarto(0.37)).toBe(0.25); expect(redondearCuarto(0.38)).toBe(0.5) })
  it("formatoDioptria con un valor que no es número", () => expect(formatoDioptria(NaN)).toBe(""))
})

describe("eje de 0 a 180", () => {
  it("solo dígitos, máximo 180", () => {
    expect(normalizarEje("90")).toBe("90")
    expect(normalizarEje("200")).toBe("180")
    expect(normalizarEje("1a8")).toBe("18")
    expect(normalizarEje("")).toBe("")
    expect(normalizarEje("007")).toBe("7")
  })
  it("↑ y ↓ de uno en uno, sin salirse del rango", () => {
    expect(pasoEje("179", 1)).toBe("180")
    expect(pasoEje("180", 1)).toBe("180")
    expect(pasoEje("0", -1)).toBe("0")
    expect(pasoEje("", 1)).toBe("1")
  })
})
