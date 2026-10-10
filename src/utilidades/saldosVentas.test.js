import { describe, it, expect } from "vitest"
import { saldosPorPaciente, totalPorCobrar, filtrarComprobantes } from "./saldosVentas"

const pacientes = [{ id: "p1", nombre: "Ana Pérez", cedula: "0101" }, { id: "p2", nombre: "Luis Mora", cedula: "0202" }]
const f = (id, extra = {}) => ({ id, pacienteId: "p1", numero: 1, estado: "pendiente_pago", montoTotal: 100, creadoEn: "2026-10-01T10:00:00Z", metodoPago: "abonos", lineas: [], facturaElectronica: "", ...extra })
const ab = (facturaId, monto) => ({ id: facturaId + monto, facturaId, monto, fecha: "2026-10-02", creadoEn: "2026-10-02T10:00:00Z" })

describe("saldosPorPaciente", () => {
  it("suma el saldo de cada paciente, descuenta abonos y ordena de mayor a menor", () => {
    const facturas = [f("a", { numero: 1 }), f("b", { numero: 2, pacienteId: "p2", montoTotal: 300 }), f("c", { numero: 3, estado: "pagada" }), f("d", { numero: 4, estado: "anulada" })]
    const r = saldosPorPaciente({ pacientes, facturas, abonos: [ab("a", 30)] })
    expect(r.map((x) => [x.pacienteId, x.saldo])).toEqual([["p2", 300], ["p1", 70]])
    expect(totalPorCobrar(r)).toBe(370)
    expect(r[1].masAntigua).toBe("2026-10-01T10:00:00Z")
  })
  it("no incluye a quien no debe nada", () => {
    expect(saldosPorPaciente({ pacientes, facturas: [f("a", { estado: "pagada" })] })).toEqual([])
  })
})

describe("filtrarComprobantes", () => {
  const facturas = [
    f("a", { numero: 7, facturaElectronica: "001-001-000000123", lineas: [{ descripcion: "Montura Ray" }] }),
    f("b", { numero: 8, pacienteId: "p2", estado: "pagada", creadoEn: "2026-10-03T10:00:00Z" }),
    f("c", { numero: 9, estado: "anulada", creadoEn: "2026-10-02T10:00:00Z" }),
  ]
  const ids = (r) => r.map((x) => x.id)
  it("ordena del más reciente al más antiguo", () => expect(ids(filtrarComprobantes(facturas, { pacientes }))).toEqual(["b", "c", "a"]))
  it("busca por paciente, número CV, factura electrónica y línea, sin tildes", () => {
    expect(ids(filtrarComprobantes(facturas, { texto: "perez", pacientes }))).toEqual(["c", "a"])
    expect(ids(filtrarComprobantes(facturas, { texto: "CV-0008", pacientes }))).toEqual(["b"])
    expect(ids(filtrarComprobantes(facturas, { texto: "8", pacientes }))).toEqual(["b"])
    expect(ids(filtrarComprobantes(facturas, { texto: "000000123", pacientes }))).toEqual(["a"])
    expect(ids(filtrarComprobantes(facturas, { texto: "montura", pacientes }))).toEqual(["a"])
  })
  it("filtra por estado y por los que aún no tienen factura electrónica (sin contar anulados)", () => {
    expect(ids(filtrarComprobantes(facturas, { estado: "pagadas", pacientes }))).toEqual(["b"])
    expect(ids(filtrarComprobantes(facturas, { estado: "saldo", pacientes, abonos: [] }))).toEqual(["a"])
    expect(ids(filtrarComprobantes(facturas, { estado: "anuladas", pacientes }))).toEqual(["c"])
    expect(ids(filtrarComprobantes(facturas, { sinFacturaElectronica: true, pacientes }))).toEqual(["b"])
  })
})

describe("los comprobantes que abre la tarjeta Ventas del Inicio", () => {
  const ahora = new Date().toISOString()
  const antes = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 10).toISOString()
  const facturas = [
    { id: "a", numero: 1, estado: "pagada", montoTotal: 10, creadoEn: ahora },
    { id: "b", numero: 2, estado: "pagada", montoTotal: 20, creadoEn: antes },
    { id: "c", numero: 3, estado: "anulada", montoTotal: 30, creadoEn: ahora },
  ]
  it("'vigentes' deja fuera las anuladas, igual que el total vendido del Inicio", () => {
    expect(filtrarComprobantes(facturas, { estado: "vigentes" }).map((f) => f.id).sort()).toEqual(["a", "b"])
  })
  it("el período 'mes' deja solo las de este mes; con 'vigentes' coincide con el '+N este mes' del Inicio", () => {
    expect(filtrarComprobantes(facturas, { estado: "vigentes", periodo: "mes" }).map((f) => f.id)).toEqual(["a"])
    expect(filtrarComprobantes(facturas, { periodo: "mes" }).map((f) => f.id).sort()).toEqual(["a", "c"]) // sin 'vigentes' entra también la anulada
  })
})
