import { describe, it, expect } from "vitest"
import { revisarPagos, textoPagos, pagosDeAbono, pagosAlContado, modalidadDePagos, totalesPorMetodo, sumaPagos, pagosDeFormulario, SIN_INDICAR } from "./pagos"

describe("pagos divididos", () => {
  it("un pago que suma el total está bien, y se redondea a centavos", () => {
    expect(revisarPagos([{ metodo: "efectivo", monto: "60" }, { metodo: "tarjeta", monto: "40.00" }], 100)).toMatchObject({ error: "", restante: 0 })
    expect(revisarPagos([{ metodo: "efectivo", monto: "33.333" }, { metodo: "tarjeta", monto: "66.667" }], 100).error).toBe("")
  })
  it("dice cuánto falta o cuánto se pasa", () => {
    expect(revisarPagos([{ metodo: "efectivo", monto: "60" }], 100)).toMatchObject({ error: "Faltan $40.00 por repartir entre las formas de pago.", restante: 40 })
    expect(revisarPagos([{ metodo: "efectivo", monto: "70" }, { metodo: "tarjeta", monto: "40" }], 100)).toMatchObject({ error: "Las formas de pago se pasan en $10.00.", restante: -10 })
  })
  it("sin ningún monto, o con un método que no existe, no pasa", () => {
    expect(revisarPagos([{ metodo: "efectivo", monto: "" }], 100).error).toBe("Indica cómo se pagó.")
    expect(revisarPagos([{ metodo: "cheque", monto: "100" }], 100).error).toBe("Elige el método de cada pago.")
  })
  it("un máximo de cuatro formas de pago", () => {
    const filas = ["efectivo", "tarjeta", "transferencia", "efectivo", "tarjeta"].map((metodo) => ({ metodo, monto: "20" }))
    expect(revisarPagos(filas, 100).error).toMatch(/hasta 4/)
  })
  it("ignora las filas vacías", () => {
    expect(pagosDeFormulario([{ metodo: "efectivo", monto: "10" }, { metodo: "tarjeta", monto: "" }, { metodo: "tarjeta", monto: "0" }])).toEqual([{ metodo: "efectivo", monto: 10 }])
  })
  it("el texto de un cobro dividido", () => {
    expect(textoPagos([{ metodo: "efectivo", monto: 60 }, { metodo: "tarjeta", monto: 40 }])).toBe("Efectivo $60.00 + Tarjeta $40.00")
    expect(textoPagos([{ metodo: "transferencia", monto: 10 }])).toBe("Transferencia")
    expect(textoPagos([])).toBe("Sin indicar")
  })
  it("un abono anterior a las formas de pago queda 'sin indicar'", () => {
    expect(pagosDeAbono({ monto: 30 })).toEqual([{ metodo: SIN_INDICAR, monto: 30 }])
    expect(pagosDeAbono({ monto: 30, pagos: [{ metodo: "efectivo", monto: 30 }] })).toEqual([{ metodo: "efectivo", monto: 30 }])
  })
  it("una venta al contado usa su lista; una anterior solo sabe si fue con tarjeta", () => {
    expect(pagosAlContado({ pagos: [{ metodo: "efectivo", monto: 50 }, { metodo: "tarjeta", monto: 50 }] }, 100)).toHaveLength(2)
    expect(pagosAlContado({ metodoPago: "tarjeta" }, 80)).toEqual([{ metodo: "tarjeta", monto: 80 }])
    expect(pagosAlContado({ metodoPago: "directo" }, 80)).toEqual([{ metodo: SIN_INDICAR, monto: 80 }])
  })
  it("la venta se guarda como 'tarjeta' solo si todo fue con tarjeta", () => {
    expect(modalidadDePagos([{ metodo: "tarjeta", monto: 100 }])).toBe("tarjeta")
    expect(modalidadDePagos([{ metodo: "tarjeta", monto: 60 }, { metodo: "efectivo", monto: 40 }])).toBe("directo")
  })
  it("suma por método en un orden fijo y 'sin indicar' solo si hay", () => {
    const t = totalesPorMetodo([[{ metodo: "tarjeta", monto: 40 }, { metodo: "efectivo", monto: 60 }], [{ metodo: "efectivo", monto: 10.5 }]])
    expect(t.map((x) => [x.metodo, x.monto])).toEqual([["efectivo", 70.5], ["tarjeta", 40], ["transferencia", 0]])
    expect(totalesPorMetodo([[{ metodo: SIN_INDICAR, monto: 5 }]]).at(-1)).toMatchObject({ metodo: SIN_INDICAR, etiqueta: "Sin indicar", monto: 5 })
    expect(sumaPagos([{ monto: 0.1 }, { monto: 0.2 }])).toBe(0.3)
  })
})
