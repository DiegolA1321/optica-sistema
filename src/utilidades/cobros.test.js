import { describe, it, expect } from "vitest"
import { cobrosDelDia, saldosConEntrega } from "./cobros"
import { pagosDeFacturas } from "./reportesDatos"

const f = (id, extra = {}) => ({ id, numero: Number(id.slice(1)), pacienteId: "p1", estado: "pagada", montoTotal: 100, metodoPago: "directo", creadoEn: "2026-10-12T15:00:00Z", ...extra })
const ab = (id, facturaId, monto, extra = {}) => ({ id, facturaId, monto, fecha: "2026-10-12", creadoEn: "2026-10-12T16:00:00Z", ...extra })

describe("cobrado en un día", () => {
  const facturas = [
    f("f1", { pagos: [{ metodo: "efectivo", monto: 60 }, { metodo: "tarjeta", monto: 40 }] }),
    f("f2", { estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 200 }),
    f("f3", { metodoPago: "tarjeta", montoTotal: 50 }),
    f("f4", { metodoPago: "directo", montoTotal: 30 }),
    f("f5", { estado: "anulada", montoTotal: 999 }),
    f("f6", { creadoEn: "2026-10-10T15:00:00Z", montoTotal: 70 }),
  ]
  const abonos = [
    ab("a1", "f2", 50, { pagos: [{ metodo: "efectivo", monto: 20 }, { metodo: "transferencia", monto: 30 }] }),
    ab("a2", "f2", 10),
    ab("a3", "f2", 25, { fecha: "2026-10-11" }),
  ]
  const dia = cobrosDelDia({ facturas, abonos, dia: "2026-10-12" })

  it("suma lo de la venta al contado y los abonos de ese día, sin anuladas ni otros días", () => {
    expect(dia.total).toBe(100 + 50 + 30 + 50 + 10)
    expect(dia.cantidad).toBe(5)
  })
  it("lo reparte por método, con lo anterior a las formas de pago como 'sin indicar'", () => {
    expect(dia.porMetodo.map((x) => [x.metodo, x.monto])).toEqual([["efectivo", 80], ["tarjeta", 90], ["transferencia", 30], ["sin_indicar", 40]])
  })
  it("los métodos suman exactamente el total", () => {
    expect(Math.round(dia.porMetodo.reduce((s, x) => s + x.monto, 0) * 100) / 100).toBe(dia.total)
  })
  it("otro día cuenta lo suyo", () => {
    expect(cobrosDelDia({ facturas, abonos, dia: "2026-10-11" }).total).toBe(25)
    expect(cobrosDelDia({ facturas, abonos, dia: "2026-10-10" }).total).toBe(70)
    expect(cobrosDelDia({ facturas, abonos, dia: "2026-10-01" })).toMatchObject({ total: 0, cantidad: 0 })
  })
  it("es la misma lista de pagos que usa Reportes para 'Cobros del período'", () => {
    const deReportes = pagosDeFacturas(facturas, abonos).filter((p) => p.fecha === "2026-10-12").reduce((s, p) => s + p.monto, 0)
    expect(dia.total).toBe(deReportes)
  })
  it("un abono anulado deja de contar", () => {
    const sin = abonos.filter((a) => a.id !== "a1")
    expect(cobrosDelDia({ facturas, abonos: sin, dia: "2026-10-12" }).total).toBe(dia.total - 50)
  })
})

describe("saldos con sus lentes listos", () => {
  const saldos = [
    { pacienteId: "p1", saldo: 300, ventasPendientes: [{ id: "f1" }] },
    { pacienteId: "p2", saldo: 50, ventasPendientes: [{ id: "f2" }] },
    { pacienteId: "p3", saldo: 120, ventasPendientes: [{ id: "f3" }] },
  ]
  const ordenes = [{ id: "o1", facturaId: "f2", estado: "lista" }, { id: "o2", facturaId: "f1", estado: "enviada" }, { id: "o3", facturaId: "f3", estado: "entregada" }]
  it("los que tienen lentes listos van primero; luego, el que más debe", () => {
    expect(saldosConEntrega(saldos, ordenes).map((s) => s.pacienteId)).toEqual(["p2", "p1", "p3"])
  })
  it("sin órdenes se queda el orden por saldo", () => {
    expect(saldosConEntrega(saldos, []).map((s) => s.pacienteId)).toEqual(["p1", "p3", "p2"])
  })
})
