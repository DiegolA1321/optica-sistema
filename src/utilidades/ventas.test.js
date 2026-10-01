import { describe, it, expect } from "vitest"
import { resumenVentasProducto, ventasDeFacturas } from "./ventas"

const factura = (id, estado, lineas, extra = {}) => ({ id, estado, pacienteId: "p1", creadoEn: "2026-10-02T10:00:00Z", lineas, ...extra })
const linea = (productoId, cantidad, precioUnitario, tipo = "producto") => ({ tipo, productoId, cantidad, precioUnitario })

describe("ventasDeFacturas", () => {
  it("toma solo las líneas de producto del producto pedido y omite anuladas", () => {
    const fs = [
      factura("f1", "pagada", [linea("x", 2, 40), linea(null, 1, 15, "servicio"), linea("y", 1, 9)]),
      factura("f2", "anulada", [linea("x", 1, 40)]),
      factura("f3", "pendiente_pago", [linea("x", 1, 40)]),
    ]
    const r = ventasDeFacturas(fs, "x")
    expect(r.map((v) => [v.cantidad, v.montoTotal, v.estado])).toEqual([[2, 80, "completado"], [1, 40, "pendiente"]])
  })
})

describe("resumenVentasProducto con facturas", () => {
  it("suma ventas viejas y líneas de factura", () => {
    const ventas = [{ id: 1, productoId: "x", pacienteId: "p2", cantidad: 1, montoTotal: 40, estado: "completado", creadoEn: "2026-09-01T10:00:00Z" }]
    const r = resumenVentasProducto(ventas, "x", [factura("f1", "pagada", [linea("x", 2, 40)])])
    expect(r.unidades).toBe(3)
    expect(r.ingreso).toBe(120)
    expect(r.pacientes).toBe(2)
    expect(r.pendientes).toBe(0)
  })
})
