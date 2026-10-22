import { describe, it, expect } from "vitest"
import { pagadoDeVenta, porVerificarDeVenta, estadoPagoDeVenta, detalleDeVenta, ventaDelDato, resumenDeVentas } from "./ventasLista"

const venta = (id, extra = {}) => ({ id, estado: "pagada", montoTotal: 100, creadoEn: "2026-10-05T10:00:00Z", lineas: [], ...extra })
const abono = (facturaId, monto) => ({ id: `a-${facturaId}-${monto}`, facturaId, monto })
const transferencia = (facturaId, monto) => ({ id: `t-${facturaId}`, facturaId, monto })

describe("lo pagado y el estado del pago de una venta", () => {
  it("lo pagado es el total menos lo que falta; una venta anulada no cobró nada", () => {
    expect(pagadoDeVenta(venta("a"), [])).toBe(100)
    expect(pagadoDeVenta(venta("b", { estado: "pendiente_pago" }), [abono("b", 30)])).toBe(30)
    expect(pagadoDeVenta(venta("c", { estado: "anulada" }), [])).toBe(0)
  })

  it("«Pagada», «Debe $70», «Verificar $30» y «Anulada»", () => {
    const pendiente = venta("b", { estado: "pendiente_pago" })
    expect(estadoPagoDeVenta(venta("a"), [], [])).toMatchObject({ id: "pagada", etiqueta: "Pagada", tono: "verde" })
    expect(estadoPagoDeVenta(pendiente, [abono("b", 30)], [])).toMatchObject({ id: "debe", etiqueta: "Debe", tono: "rojo", monto: 70 })
    expect(estadoPagoDeVenta(pendiente, [abono("b", 30)], [transferencia("b", 30)])).toMatchObject({ id: "verificar", etiqueta: "Verificar", tono: "ambar", monto: 30 })
    expect(estadoPagoDeVenta(venta("c", { estado: "anulada" }), [], [])).toMatchObject({ id: "anulada", tono: "gris" })
  })

  it("lo que se verifica nunca pasa de lo que falta", () => {
    const pendiente = venta("b", { estado: "pendiente_pago" })
    expect(estadoPagoDeVenta(pendiente, [abono("b", 80)], [transferencia("b", 500)]).monto).toBe(20)
    expect(porVerificarDeVenta(pendiente, [transferencia("b", 20), transferencia("otra", 9)])).toBe(20)
  })
})

describe("qué se vendió, en dos líneas", () => {
  it("con lunas: «Lentes progresivos» y debajo la montura y los filtros", () => {
    const f = venta("a", { lineas: [
      { tipo: "producto", descripcion: "Montura Ray-Ban", cantidad: 1 },
      { tipo: "luna", descripcion: "Luna: Progresivo", cantidad: 1, detalle: { tipo_lente: "progresivo", filtro_azul: true } },
    ] })
    expect(detalleDeVenta(f)).toEqual({ titulo: "Lentes progresivos", sub: "Montura Ray-Ban · lunas filtro azul" })
  })
  it("una luna escrita de la forma antigua (servicio de texto) también cuenta como lentes", () => {
    expect(detalleDeVenta(venta("a", { lineas: [{ tipo: "servicio", descripcion: "Luna monofocal", cantidad: 1 }] })).titulo).toBe("Lentes")
  })
  it("sin lunas: lo que se llevó y cuántos productos son", () => {
    expect(detalleDeVenta(venta("a", { lineas: [{ tipo: "producto", descripcion: "Estuche", cantidad: 1 }, { tipo: "producto", descripcion: "Líquido", cantidad: 1 }] }))).toEqual({ titulo: "Estuche y Líquido", sub: "2 productos" })
    expect(detalleDeVenta(venta("a", { lineas: [{ tipo: "producto", descripcion: "Estuche", cantidad: 3 }] }))).toEqual({ titulo: "Estuche", sub: "3 u." })
    expect(detalleDeVenta(venta("a", { lineas: [] }))).toEqual({ titulo: "Venta", sub: "" })
  })
})

describe("la franja de datos", () => {
  const ventas = [
    venta("a", { montoTotal: 80 }),
    venta("b", { estado: "pendiente_pago", montoTotal: 100 }),
    venta("c", { estado: "pendiente_pago", montoTotal: 60 }),
    venta("d", { estado: "anulada", montoTotal: 999 }),
  ]
  const abonos = [abono("b", 30)]
  const transferencias = [transferencia("c", 20), transferencia("d", 5)]
  const ordenes = [
    { id: "o1", facturaId: "a", estado: "enviada", fechaPrometida: "2020-01-01" },
    { id: "o2", facturaId: "b", estado: "enviada", fechaPrometida: "2099-01-01" },
    { id: "o3", facturaId: "b", estado: "lista", fechaPrometida: "2099-01-01" },
    { id: "o4", facturaId: "d", estado: "enviada", fechaPrometida: "2099-01-01" },
    { id: "o5", facturaId: "zzz", estado: "enviada", fechaPrometida: "2099-01-01" },
  ]
  const r = resumenDeVentas({ ventas, abonos, pagosPorVerificar: transferencias, ordenes })

  it("vendido = cobrado + por cobrar, sin las ventas anuladas", () => {
    expect(r.ventas).toBe(3)
    expect(r.vendido).toBe(240)
    expect(r.porCobrar).toBe(130) // b: 70, c: 60
    expect(r.cobrado).toBe(110) // a: 80, b: 30
    expect(r.cobrado + r.porCobrar).toBe(r.vendido)
    expect(r.conSaldo).toBe(2)
    expect(r.cobradas).toBe(1)
  })
  it("los pagos por verificar y los lentes en el laboratorio son solo de las ventas que se ven", () => {
    expect(r.porVerificar).toBe(20) // la transferencia de la venta anulada no cuenta
    expect(r.transferencias).toBe(1)
    expect(r.ventasPorVerificar).toBe(1)
    expect(r.enLaboratorio).toBe(2) // o1 y o2: o3 ya está lista, o4 es de una venta anulada, o5 de una que no se ve
    expect(r.atrasados).toBe(1)
  })
  it("cada dato cuenta las mismas ventas que filtra la lista", () => {
    const vigentes = ventas.filter((f) => f.estado !== "anulada")
    expect(vigentes.filter((f) => ventaDelDato(f, "cobrado", abonos, transferencias)).length).toBe(r.cobradas)
    expect(vigentes.filter((f) => ventaDelDato(f, "porcobrar", abonos, transferencias)).length).toBe(r.conSaldo)
    expect(vigentes.filter((f) => ventaDelDato(f, "verificar", abonos, transferencias)).length).toBe(r.ventasPorVerificar)
    expect(ventaDelDato(ventas[3], "porcobrar", abonos, transferencias)).toBe(false) // una anulada no cuenta en ningún dato
  })
  it("sin ventas todo es cero", () => {
    expect(resumenDeVentas({})).toMatchObject({ ventas: 0, vendido: 0, cobrado: 0, porCobrar: 0, porVerificar: 0, enLaboratorio: 0 })
  })
})
