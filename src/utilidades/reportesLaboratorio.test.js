import { describe, it, expect } from "vitest"
import { resumenPorLaboratorio, ventasPorTipoLuna, diasDeEntrega, productosMasVendidos } from "./reportesLaboratorio"

const hoy = new Date(2026, 9, 10)
const ord = (o) => ({ id: "x", estado: "enviada", laboratorio: "Lab A", creadaEn: "2026-10-01T10:00:00Z", fechaPrometida: "2026-10-20", historial: [], ...o })
const entregada = (dias, o = {}) => ord({ estado: "entregada", historial: [{ estado: "entregada", cambiadoEn: new Date(Date.parse("2026-10-01T10:00:00Z") + dias * 86400000).toISOString() }], ...o })

describe("resumenPorLaboratorio", () => {
  it("cuenta atrasadas y abiertas, y promedia los días de entrega", () => {
    const r = resumenPorLaboratorio([
      ord({ id: "1", fechaPrometida: "2026-10-05" }),          // atrasada
      ord({ id: "2" }),                                          // abierta a tiempo
      entregada(4, { id: "3" }), entregada(6, { id: "4" }),
      ord({ id: "5", laboratorio: "" , fechaPrometida: "2026-10-01" }),
    ], { hoy })
    const a = r.find((x) => x.laboratorio === "Lab A")
    expect(a).toMatchObject({ abiertas: 2, atrasadas: 1, entregadas: 2 })
    expect(a.promedioDias).toBeCloseTo(5)
    expect(r.find((x) => x.laboratorio === "Sin laboratorio").atrasadas).toBe(1)
    expect(r[0].atrasadas).toBeGreaterThanOrEqual(r[1].atrasadas)
  })

  it("sin entregas el promedio es null; el período limita las entregadas", () => {
    expect(resumenPorLaboratorio([ord()], { hoy })[0].promedioDias).toBeNull()
    expect(resumenPorLaboratorio([entregada(3)], { hoy, enRango: () => false })).toEqual([])
  })

  it("una orden sin historial de entrega no tiene días", () => {
    expect(diasDeEntrega(ord({ estado: "entregada" }))).toBeNull()
  })
})

describe("ventasPorTipoLuna", () => {
  const f = (estado, lineas, creadoEn = "2026-10-02T12:00:00Z") => ({ estado, creadoEn, lineas })
  const luna = (tipo, cantidad = 1, precioUnitario = 50) => ({ tipo: "luna", cantidad, precioUnitario, detalle: tipo ? { tipo_lente: tipo } : null })

  it("agrupa por tipo, ignora anuladas y no-lunas", () => {
    const r = ventasPorTipoLuna([
      f("pagada", [luna("progresivo", 2, 100), { tipo: "producto", cantidad: 1, precioUnitario: 30 }]),
      f("pendiente_pago", [luna("monofocal"), luna(null)]),
      f("anulada", [luna("monofocal", 5)]),
    ])
    expect(r.map((x) => [x.id, x.unidades, x.monto])).toEqual([["progresivo", 2, 200], ["monofocal", 1, 50], ["otro", 1, 50]])
    expect(r[2].etiqueta).toBe("Sin tipo indicado")
  })

  it("respeta el período", () => {
    expect(ventasPorTipoLuna([f("pagada", [luna("monofocal")])], { enRango: () => false })).toEqual([])
  })
})

describe("productosMasVendidos", () => {
  const prod = (descripcion, cantidad = 1) => ({ tipo: "producto", descripcion, cantidad })
  it("suma por unidades los productos de comprobantes no anulados y de ventas sueltas", () => {
    const facturas = [
      { estado: "pagada", creadoEn: "2026-10-01", lineas: [prod("Montura 1"), { tipo: "luna", descripcion: "Luna" }] },
      { estado: "pendiente_pago", creadoEn: "2026-10-02", lineas: [prod("Montura 1"), prod("Estuche", 3)] },
      { estado: "anulada", creadoEn: "2026-10-02", lineas: [prod("Montura 9", 5)] },
    ]
    const r = productosMasVendidos({ facturas, ventas: [{ creadoEn: "2026-10-03", productoNombre: "Estuche", cantidad: 1 }] })
    expect(r).toEqual([{ label: "Estuche", valor: 4 }, { label: "Montura 1", valor: 2 }])
  })
  it("respeta el período", () => {
    expect(productosMasVendidos({ facturas: [{ estado: "pagada", creadoEn: "2026-10-01", lineas: [prod("A")] }], enRango: () => false })).toEqual([])
  })
})
