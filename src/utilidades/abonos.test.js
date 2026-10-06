import { describe, it, expect } from "vitest"
import { mapAbono, saldoFactura, totalAbonado, saldoPacienteFacturas, abonoSugerido, abonosDeFactura } from "./abonos"

const fac = (extra = {}) => ({ id: "f1", pacienteId: "p1", montoTotal: 100, estado: "pendiente_pago", metodoPago: "abonos", ...extra })
const ab = (monto, extra = {}) => ({ id: "a" + monto, facturaId: "f1", monto, fecha: "2026-10-06", creadoEn: "2026-10-06T10:00:00Z", ...extra })

describe("abonos", () => {
  it("mapea la fila de la base", () => {
    expect(mapAbono({ id: "1", factura_id: "f", monto: "12.50", fecha: "2026-10-06", nota: null, registrado_por: "u", created_at: "t" })).toMatchObject({ facturaId: "f", monto: 12.5, nota: "" })
  })
  it("el saldo es el total menos lo abonado", () => {
    expect(saldoFactura(fac(), [])).toBe(100)
    expect(saldoFactura(fac(), [ab(30), ab(20)])).toBe(50)
    expect(totalAbonado("f1", [ab(30), ab(20.1)])).toBe(50.1)
  })
  it("pagada o anulada no tiene saldo", () => {
    expect(saldoFactura(fac({ estado: "pagada" }), [])).toBe(0)
    expect(saldoFactura(fac({ estado: "anulada" }), [ab(10)])).toBe(0)
  })
  it("suma el saldo de todas las ventas del paciente", () => {
    const fs = [fac(), fac({ id: "f2", montoTotal: 40 }), fac({ id: "f3", pacienteId: "p2" })]
    expect(saldoPacienteFacturas("p1", fs, [ab(10)])).toBe(130)
  })
  it("sugiere la cuota en un plan de cuotas y el saldo exacto en la última", () => {
    const plan = fac({ metodoPago: "cuotas", cuotasTotales: 3, cuotasPagadas: 0 })
    expect(abonoSugerido(plan, [])).toBe(33.33)
    expect(abonoSugerido({ ...plan, cuotasPagadas: 2 }, [ab(33.33), ab(33.33)])).toBe(33.34)
    expect(abonoSugerido(fac(), [ab(30)])).toBe(70)
  })
  it("ordena el historial por fecha", () => {
    expect(abonosDeFactura("f1", [ab(5, { fecha: "2026-10-07" }), ab(9, { fecha: "2026-10-01" })]).map((a) => a.monto)).toEqual([9, 5])
  })
})
