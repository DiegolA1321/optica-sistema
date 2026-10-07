import { describe, it, expect } from "vitest"
import { numeroComprobante, normalizarFacturaElectronica, descripcionLuna, detalleLuna, lineaLunaDeTexto, datosOrdenDeLinea, montura, lunaDe } from "./comprobantes"

describe("comprobantes", () => {
  it("numera con CV- y ceros", () => {
    expect(numeroComprobante(7)).toBe("CV-0007")
    expect(numeroComprobante(12345)).toBe("CV-12345")
  })
  it("normaliza la factura electrónica del SRI y respeta otros formatos", () => {
    expect(normalizarFacturaElectronica("001001000000123")).toMatchObject({ valor: "001-001-000000123", formatoSri: true })
    expect(normalizarFacturaElectronica(" 001-001-000000123 ").valor).toBe("001-001-000000123")
    expect(normalizarFacturaElectronica("FE-77")).toMatchObject({ valor: "FE-77", formatoSri: false })
    expect(normalizarFacturaElectronica("").valor).toBe("")
    expect(normalizarFacturaElectronica("x".repeat(61)).demasiadoLargo).toBe(true)
  })
  it("describe la luna y arma su detalle", () => {
    const luna = { tipoLente: "monofocal", material: "CR-39", antirreflejo: true, filtroAzul: true }
    expect(descripcionLuna(luna)).toBe("Luna: Monofocal · CR-39 · antirreflejo, filtro azul")
    expect(descripcionLuna({})).toBe("Luna")
    expect(detalleLuna(luna)).toMatchObject({ tipo_lente: "monofocal", material: "CR-39", antirreflejo: true, filtro_azul: true, fotocromatico: false })
  })
  it("la luna de la ficha es texto con precio 0 y sin producto", () => {
    expect(lineaLunaDeTexto(" Progresivo ")).toMatchObject({ tipo: "luna", productoId: null, descripcion: "Luna: Progresivo", precioUnitario: 0 })
    expect(lineaLunaDeTexto("").descripcion).toBe("Luna")
  })
  it("la orden toma tipo, material y tratamientos de la luna", () => {
    const l = { tipo: "luna", detalle: detalleLuna({ tipoLente: "progresivo", material: "Policarbonato", fotocromatico: true }) }
    expect(datosOrdenDeLinea(l)).toMatchObject({ tipoLente: "progresivo", material: "Policarbonato", fotocromatico: true, antirreflejo: false })
    expect(datosOrdenDeLinea({ tipo: "luna", detalle: null })).toEqual({})
  })
  it("separa montura y luna de las líneas", () => {
    const ls = [{ tipo: "servicio" }, { tipo: "producto", descripcion: "M1" }, { tipo: "luna", descripcion: "L" }]
    expect(montura(ls).descripcion).toBe("M1")
    expect(lunaDe(ls).descripcion).toBe("L")
  })
})
