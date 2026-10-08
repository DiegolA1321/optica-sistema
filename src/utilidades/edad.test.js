import { describe, it, expect } from "vitest"
import { edadEnAnios } from "./edad"

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
