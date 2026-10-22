import { describe, it, expect } from "vitest"
import { edadEnAnios, fraseCumpleanos, antiguedadEnPalabras } from "./edad"

describe("edadEnAnios", () => {
  const hoy = new Date(2026, 9, 8)
  it("cuenta los años cumplidos", () => {
    expect(edadEnAnios("1992-10-08", hoy)).toBe(34)
    expect(edadEnAnios("1992-10-09", hoy)).toBe(33)
    expect(edadEnAnios("1992-01-01", hoy)).toBe(34)
  })
  it("sin fecha, inválida o futura no inventa una edad", () => {
    expect(edadEnAnios("", hoy)).toBeNull()
    expect(edadEnAnios(null, hoy)).toBeNull()
    expect(edadEnAnios("no", hoy)).toBeNull()
    expect(edadEnAnios("2030-01-01", hoy)).toBeNull()
  })
  it("acepta un Date", () => {
    expect(edadEnAnios(new Date(2000, 0, 1), hoy)).toBe(26)
  })
})

describe("fraseCumpleanos", () => {
  it("dice la edad que cumplirá y cuándo, sin «1 años»", () => {
    expect(fraseCumpleanos(36, 350)).toBe("Cumplirá 37 · en 350 días")
    expect(fraseCumpleanos(0, 1)).toBe("Cumplirá 1 año · en 1 día")
    expect(fraseCumpleanos(36, 0)).toBe("Cumple 36 años · hoy")
    expect(fraseCumpleanos(null, 5)).toBe("Cumple en 5 días")
    expect(fraseCumpleanos(30, null)).toBe("")
  })
})

describe("antiguedadEnPalabras", () => {
  const hoy = new Date(2026, 9, 22)
  it("este mes, meses, años y medio", () => {
    expect(antiguedadEnPalabras("2026-10-05", hoy)).toBe("este mes")
    expect(antiguedadEnPalabras("2026-07-22", hoy)).toBe("3 meses")
    expect(antiguedadEnPalabras("2025-04-10", hoy)).toBe("1 año y medio")
    expect(antiguedadEnPalabras("2024-10-22", hoy)).toBe("2 años")
    expect(antiguedadEnPalabras("", hoy)).toBe("")
  })
})
