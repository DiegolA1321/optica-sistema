import { fechaLegible } from "./formatoFecha"
import { describe, it, expect } from "vitest"
import { armarHtmlProforma, lineasProformaDeConsulta, datosOpticaProforma } from "./proforma"

const base = {
  opticaNombre: "Óptica Solna Vision",
  paciente: { nombre: "Ana Pérez", cedula: "1710034404" },
  diagnostico: { fecha: "2026-10-06", motivo: "Consulta General", diagnostico: "Miopía leve", diagnosticoCategorias: ["Miopía"], lenteRecomendado: "Monofocal antirreflejo", indicaciones: "Uso permanente", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90" }, oi: { esfera: "-1.00" } },
  lineas: [
    { descripcion: "Montura negra", cantidad: 1, precioUnitario: 60 },
    { descripcion: "Luna: Monofocal antirreflejo", cantidad: 1, precioUnitario: 45.5 },
  ],
  fecha: new Date(2026, 9, 6),
}

describe("lineasProformaDeConsulta", () => {
  it("trae la consulta con su costo y la luna como texto libre sin precio", () => {
    const l = lineasProformaDeConsulta({ motivo: "Consulta General", lenteRecomendado: "Monofocal antirreflejo" }, { costosMotivo: { "Consulta General": 15 } })
    expect(l).toEqual([
      { tipo: "servicio", descripcion: "Consulta — Consulta General", cantidad: 1, precioUnitario: 15 },
      { tipo: "servicio", descripcion: "Luna: Monofocal antirreflejo", cantidad: 1, precioUnitario: 0 },
    ])
  })
  it("sin lente recomendado la luna queda en blanco para escribirla", () => {
    expect(lineasProformaDeConsulta({ motivo: "Control" }, {})[1].descripcion).toBe("Luna")
  })
})

describe("armarHtmlProforma", () => {
  it("lista las líneas, el total y avisa que no es un comprobante ni una factura electrónica", () => {
    const html = armarHtmlProforma(base)
    expect(html).toContain("Montura negra")
    expect(html).toContain("Luna: Monofocal antirreflejo")
    expect(html).toContain("Total: $105.50")
    expect(html).toContain("No es un comprobante de venta ni una factura electrónica")
    expect(html).toContain("6 oct 2026")
  })
  it("incluye el diagnóstico y la receta, pero no las medidas salvo que se pida", () => {
    const sin = armarHtmlProforma(base)
    expect(sin).toContain("Miopía")
    expect(sin).toContain("Monofocal antirreflejo")
    expect(sin).not.toContain("-1.50")
    const con = armarHtmlProforma({ ...base, incluirMedidas: true })
    expect(con).toContain("-1.50 | -0.50 | 90°")
    expect(con).toContain("-1.00 | — | —°")
  })
  it("escapa el texto para que un nombre no inyecte HTML", () => {
    const html = armarHtmlProforma({ ...base, paciente: { nombre: "<script>x</script>" } })
    expect(html).not.toContain("<script>x")
    expect(html).toContain("&lt;script&gt;")
  })
  it("sin diagnóstico no pone esa sección", () => {
    expect(armarHtmlProforma({ ...base, diagnostico: null })).not.toContain("Datos del diagnóstico")
  })
})

describe("datos de la óptica y vigencia", () => {
  it("la vigencia es de 15 días si no se configuró", () => {
    expect(datosOpticaProforma({}).vigenciaDias).toBe(15)
    expect(datosOpticaProforma({ vigenciaProformaDias: 30 }).vigenciaDias).toBe(30)
    expect(datosOpticaProforma({ vigenciaProformaDias: "x" }).vigenciaDias).toBe(15)
  })
  it("imprime dirección, teléfono y 'Válida hasta' sin los datos vacíos", () => {
    const html = armarHtmlProforma({ opticaNombre: "Visión", opticaDatos: { direccion: "Calle 1", telefono: "0999", ruc: "", vigenciaDias: 15 }, paciente: { nombre: "Ana" }, lineas: [], fecha: new Date(2026, 8, 1, 12) })
    expect(html).toContain("Calle 1 · Tel. 0999")
    expect(html).not.toContain("RUC")
    expect(html).toContain("Válida hasta " + fechaLegible(new Date(2026, 8, 16, 12)))
  })
})
