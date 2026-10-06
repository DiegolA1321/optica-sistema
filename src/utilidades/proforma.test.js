import { describe, it, expect } from "vitest"
import { armarHtmlProforma, lineasProformaDeConsulta } from "./proforma"

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
  it("lista las líneas, el total y avisa que no es una factura", () => {
    const html = armarHtmlProforma(base)
    expect(html).toContain("Montura negra")
    expect(html).toContain("Luna: Monofocal antirreflejo")
    expect(html).toContain("Total: $105.50")
    expect(html).toContain("No es una factura")
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
