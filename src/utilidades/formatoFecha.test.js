import { describe, it, expect } from "vitest"
import { fechaLegible, fechaCorta, horaLegible, fechaHoraLegible } from "./formatoFecha"

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

describe("hora y fecha con hora", () => {
  it("hora en 12 h con cero a la izquierda", () => {
    expect(horaLegible(new Date(2026, 9, 7, 8, 19))).toBe("08:19 AM")
    expect(horaLegible(new Date(2026, 9, 7, 16, 20))).toBe("04:20 PM")
    expect(horaLegible(new Date(2026, 9, 7, 0, 5))).toBe("12:05 AM")
    expect(horaLegible(new Date(2026, 9, 7, 12, 0))).toBe("12:00 PM")
  })
  it("fecha corta con hora, con o sin año", () => {
    expect(fechaHoraLegible(new Date(2026, 9, 7, 8, 19))).toBe("7 oct, 08:19 AM")
    expect(fechaHoraLegible(new Date(2026, 9, 3, 15, 20), { anio: true })).toBe("3 oct 2026, 03:20 PM")
    expect(fechaHoraLegible("nada")).toBe("")
  })
})
