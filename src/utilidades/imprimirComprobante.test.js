import { describe, it, expect } from "vitest"
import { armarHtmlComprobante, textoFormaDePago } from "./imprimirComprobante"

const factura = {
  id: "f1", numero: 7, pacienteId: "p1", estado: "pagada", montoTotal: 90, metodoPago: "directo", creadoEn: "2026-10-12T15:00:00Z", facturaElectronica: "001-001-000000123",
  pagos: [{ metodo: "efectivo", monto: 60 }, { metodo: "tarjeta", monto: 30 }],
  lineas: [
    { id: "l1", tipo: "servicio", descripcion: "Consulta <b>", cantidad: 2, precioUnitario: 50, descuentoTipo: "porcentaje", descuentoValor: 10, descuentoMonto: 10, descuentoMotivo: "Cliente frecuente" },
  ],
}

describe("imprimir un comprobante guardado", () => {
  const html = armarHtmlComprobante({ opticaNombre: "Óptica Demo", opticaDatos: { telefono: "0999" }, paciente: { nombre: "Ana Pérez", cedula: "0101" }, factura, abonos: [], vendedor: "Vera" })
  it("lleva el número, la fecha, el paciente y la factura electrónica", () => {
    expect(html).toContain("CV-0007")
    expect(html).toContain("12 oct 2026")
    expect(html).toContain("Ana Pérez")
    expect(html).toContain("001-001-000000123")
    expect(html).toContain("Documento interno")
  })
  it("muestra el descuento con su motivo y los totales", () => {
    expect(html).toContain("Subtotal: $100.00")
    expect(html).toContain("Descuento: -$10.00")
    expect(html).toContain("Cliente frecuente")
    expect(html).toContain("Total: $90.00")
  })
  it("dice cómo se pagó, dividido", () => {
    expect(html).toContain("Forma de pago: Efectivo $60.00 + Tarjeta $30.00")
  })
  it("escapa lo que escribió la persona", () => {
    expect(html).toContain("Consulta &lt;b&gt;")
    expect(html).not.toContain("Consulta <b>")
  })
  it("con saldo, lista los abonos y el saldo pendiente; una venta anulada se marca", () => {
    const conSaldo = { ...factura, estado: "pendiente_pago", metodoPago: "abonos", pagos: null }
    const abonos = [{ id: "a1", facturaId: "f1", monto: 30, fecha: "2026-10-13", pagos: [{ metodo: "transferencia", monto: 30 }] }]
    const h = armarHtmlComprobante({ opticaNombre: "Ó", paciente: { nombre: "Ana" }, factura: conSaldo, abonos })
    expect(h).toContain("Saldo pendiente: $60.00")
    expect(h).toContain("Transferencia")
    expect(armarHtmlComprobante({ opticaNombre: "Ó", paciente: { nombre: "Ana" }, factura: { ...factura, estado: "anulada", anuladaMotivo: "Error de precio" } })).toContain("VENTA ANULADA · Error de precio")
  })
  it("una venta anterior a las formas de pago dice lo que decía su método", () => {
    expect(textoFormaDePago({ ...factura, pagos: null, metodoPago: "directo" }, [])).toBe("Pago directo")
    expect(textoFormaDePago({ ...factura, pagos: null, metodoPago: "tarjeta" }, [])).toBe("Tarjeta")
  })
})
