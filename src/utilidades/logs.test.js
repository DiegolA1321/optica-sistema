import { describe, it, expect } from "vitest"
import { detalleActividad } from "./logs"

describe("detalleActividad", () => {
  it("deja pasar lo que entiende quien administra la óptica", () => {
    expect(detalleActividad("Ana Pérez")).toBe("Ana Pérez")
    expect(detalleActividad("OL-0040 → Entregada")).toBe("OL-0040 → Entregada")
    expect(detalleActividad("40 min")).toBe("40 min")
    expect(detalleActividad("")).toBe("")
    expect(detalleActividad(null)).toBe("")
  })
  it("oculta las notas técnicas, de pruebas y de scripts", () => {
    expect(detalleActividad("Rafael Cedeño · cita antigua sin paciente identificable (limpieza de la Demo)")).toBe("")
    expect(detalleActividad("E2E Montura l8cci")).toBe("")
    expect(detalleActividad("19 feb 2028 · 09:00-13:00 · E2E ausencia de prueba")).toBe("")
    expect(detalleActividad("la inasistencia fue real; no es una cita activa")).toBe("")
    expect(detalleActividad("script de migración 0102")).toBe("")
    expect(detalleActividad("cita 45f4aa4c-23bd-43ca-a18a-27eba20c4945")).toBe("")
  })
})
