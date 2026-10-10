import { describe, it, expect } from "vitest"
import { detalleActividad, moduloDeRegistro, NOMBRE_MODULO } from "./logs"

describe("detalleActividad", () => {
  it("deja pasar lo que entiende quien administra la óptica", () => {
    expect(detalleActividad("Ana Pérez")).toBe("Ana Pérez")
    expect(detalleActividad("OL-0040 → Entregada")).toBe("OL-0040 → Entregada")
    expect(detalleActividad("40 min")).toBe("40 min")
    expect(detalleActividad("")).toBe("")
    expect(detalleActividad(null)).toBe("")
  })
  it("las fechas salen con el formato del sistema, no como 2028-02-19", () => {
    expect(detalleActividad("2028-02-19")).toBe("19 feb 2028")
    expect(detalleActividad("Ana Pérez · 2026-09-05 · 09:00")).toBe("Ana Pérez · 5 sept 2026 · 09:00")
    expect(detalleActividad("OL-0040 → Entregada")).toBe("OL-0040 → Entregada")
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

describe("moduloDeRegistro", () => {
  it("las órdenes de laboratorio, las ventas y los abonos son de Ventas, aunque se hayan guardado como Pacientes", () => {
    for (const accion of ["Cambió el estado de una orden de laboratorio", "Creó una orden de laboratorio", "Avisó al paciente que sus lentes están listos", "Registró un abono", "Anuló una venta", "Registró una venta", "Registró la factura electrónica de una venta"]) {
      expect(moduloDeRegistro({ modulo: "pacientes", accion }), accion).toBe("ventas")
    }
    expect(moduloDeRegistro({ modulo: "consultas", accion: "Cobró la atención desde la ficha clínica" })).toBe("ventas")
    expect(NOMBRE_MODULO.ventas).toBe("Ventas")
  })
  it("lo demás conserva su módulo", () => {
    expect(moduloDeRegistro({ modulo: "pacientes", accion: "Registró un paciente nuevo" })).toBe("pacientes")
    expect(moduloDeRegistro({ modulo: "consultas", accion: "Registró una ficha clínica" })).toBe("consultas")
    expect(moduloDeRegistro({ modulo: "citas", accion: "Canceló una cita" })).toBe("citas")
    expect(moduloDeRegistro({ modulo: "inventario", accion: "Agregó un producto al inventario" })).toBe("inventario")
  })
})
