import { describe, it, expect } from "vitest"
import { fechaLegible, fechaCorta } from "./formatoFecha"

describe("formatoFecha", () => {
  it("escribe la fecha como 15 sept 2026", () => {
    expect(fechaLegible("2026-09-15")).toBe("15 sept 2026")
    expect(fechaLegible("2027-03-14")).toBe("14 mar 2027")
  })
  it("no corre un día por la zona horaria en fechas sin hora", () => {
    expect(fechaLegible("2026-01-01")).toBe("1 ene 2026")
    expect(fechaLegible("2026-12-31")).toBe("31 dic 2026")
  })
  it("acepta un Date y un texto con hora", () => {
    expect(fechaLegible(new Date(2026, 9, 6))).toBe("6 oct 2026")
    expect(fechaLegible(new Date(2026, 9, 6, 15, 30).toISOString())).toBe("6 oct 2026")
  })
  it("la versión corta no lleva año", () => {
    expect(fechaCorta("2026-09-15")).toBe("15 sept")
  })
  it("sin fecha o inválida devuelve texto vacío", () => {
    expect(fechaLegible("")).toBe("")
    expect(fechaLegible(null)).toBe("")
    expect(fechaLegible("no es fecha")).toBe("")
  })
})
