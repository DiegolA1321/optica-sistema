import { describe, it, expect } from "vitest"
import { brutoLinea, descuentoLinea, subtotalLinea, totalesDeLineas, errorDeDescuento, lineaParaRpc } from "./descuentos"

const l = (extra = {}) => ({ tipo: "servicio", descripcion: "Consulta", cantidad: 2, precioUnitario: 50, ...extra })

describe("descuentos por línea", () => {
  it("sin descuento el subtotal es cantidad por precio", () => {
    expect(brutoLinea(l())).toBe(100)
    expect(subtotalLinea(l())).toBe(100)
  })
  it("en porcentaje y en monto", () => {
    expect(descuentoLinea(l({ descuentoTipo: "porcentaje", descuentoValor: 10 }))).toBe(10)
    expect(subtotalLinea(l({ descuentoTipo: "monto", descuentoValor: 15.5 }))).toBe(84.5)
    expect(descuentoLinea(l({ descuentoTipo: "porcentaje", descuentoValor: 12.5 }))).toBe(12.5)
  })
  it("el descuento nunca pasa del valor de la línea", () => {
    expect(descuentoLinea(l({ descuentoTipo: "monto", descuentoValor: 500 }))).toBe(100)
  })
  it("si la base ya calculó el descuento, ese manda", () => {
    expect(descuentoLinea(l({ descuentoTipo: "porcentaje", descuentoValor: 10, descuentoMonto: 12 }))).toBe(12)
  })
  it("los totales: bruto, descuento y lo que se cobra", () => {
    const lineas = [l(), l({ descripcion: "Luna", cantidad: 1, precioUnitario: 80, descuentoTipo: "porcentaje", descuentoValor: 25, descuentoMotivo: "Promoción" })]
    expect(totalesDeLineas(lineas)).toEqual({ bruto: 180, descuento: 20, total: 160 })
  })
  it("el motivo es obligatorio y el descuento tiene que tener sentido", () => {
    expect(errorDeDescuento(l())).toBe("")
    expect(errorDeDescuento(l({ descuentoTipo: "monto", descuentoValor: 5, descuentoMotivo: "" }))).toMatch(/motivo/)
    expect(errorDeDescuento(l({ descuentoTipo: "monto", descuentoValor: 0, descuentoMotivo: "Amigo" }))).toMatch(/cuánto se descuenta/)
    expect(errorDeDescuento(l({ descuentoTipo: "porcentaje", descuentoValor: 120, descuentoMotivo: "Amigo" }))).toMatch(/100 %/)
    expect(errorDeDescuento(l({ descuentoTipo: "monto", descuentoValor: 101, descuentoMotivo: "Amigo" }))).toMatch(/mayor que su valor/)
    expect(errorDeDescuento(l({ descuentoTipo: "monto", descuentoValor: 30, descuentoMotivo: "Amigo" }))).toBe("")
  })
  it("el descuento viaja a la base solo si la línea lo lleva", () => {
    expect(lineaParaRpc(l({ productoId: null }))).not.toHaveProperty("descuento_tipo")
    expect(lineaParaRpc(l({ productoId: null, descuentoTipo: "monto", descuentoValor: "5", descuentoMotivo: " Amigo " }))).toMatchObject({ descuento_tipo: "monto", descuento_valor: 5, descuento_motivo: "Amigo" })
  })
})
