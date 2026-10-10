import { describe, it, expect } from "vitest"
import { vendidoYCobrado, cobradoDeFactura } from "./vendidoCobrado"

describe("vendido y cobrado", () => {
  const facturas = [
    { id: "a", estado: "pagada", montoTotal: 100, creadoEn: "2026-10-05T10:00:00Z" },
    { id: "b", estado: "pendiente_pago", montoTotal: 200, creadoEn: "2026-10-06T10:00:00Z" },
    { id: "c", estado: "anulada", montoTotal: 999, creadoEn: "2026-10-07T10:00:00Z" },
    { id: "d", estado: "pagada", montoTotal: 50, creadoEn: "2026-08-01T10:00:00Z" },
  ]
  const abonos = [{ facturaId: "b", monto: 60 }, { facturaId: "b", monto: 10 }]
  const octubre = (f) => String(f).startsWith("2026-10")

  it("vendido = el monto total de las ventas del período sin anuladas; cobrado = lo ya pagado de esas ventas", () => {
    expect(vendidoYCobrado({ facturas, abonos, enPeriodo: octubre })).toEqual({ cantidad: 2, vendido: 300, cobrado: 170 })
  })
  it("sin período cuenta todas las ventas vigentes", () => {
    expect(vendidoYCobrado({ facturas, abonos })).toEqual({ cantidad: 3, vendido: 350, cobrado: 220 })
  })
  it("las ventas anteriores cuentan como cobradas por completo", () => {
    expect(vendidoYCobrado({ facturas: [], ventasViejas: [{ montoTotal: 40, creadoEn: "2026-10-01T00:00:00Z" }], enPeriodo: octubre })).toEqual({ cantidad: 1, vendido: 40, cobrado: 40 })
  })
  it("una venta anulada no cobra nada", () => {
    expect(cobradoDeFactura(facturas[2], abonos)).toBe(0)
  })
})
