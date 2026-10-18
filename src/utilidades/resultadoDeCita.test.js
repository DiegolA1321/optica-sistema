import { describe, it, expect } from "vitest"
import { resultadoDeCita } from "./resultadoDeCita"

const consulta = { id: "k1", citaId: "c1", diagnosticoCategorias: ["Miopía", "Astigmatismo"], diagnostico: "", od: { esfera: "-1.75", cilindro: "-0.50", eje: "90" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80" } }
const factura = { id: "f1", citaId: "c1", estado: "pagada", lineas: [{ descripcion: "Montura Ray-Ban" }, { descripcion: "Lunas progresivas" }] }

describe("resultadoDeCita", () => {
  it("el personal ve el diagnóstico, la receta emitida (OD y OI) y lo que compró", () => {
    const r = resultadoDeCita({ cita: { id: "c1" }, consulta, facturas: [factura] })
    expect(r.map((x) => x.clave)).toEqual(["diagnostico", "receta", "compra"])
    expect(r[0].texto).toBe("Miopía, Astigmatismo")
    expect(r[1].texto).toBe("OD −1.75 −0.50 x90 · OI −1.25 −0.75 x80")
    expect(r[2]).toMatchObject({ etiqueta: "Compró", texto: "Montura Ray-Ban, Lunas progresivas" })
  })
  it("el paciente lo lee en palabras simples", () => {
    const r = resultadoDeCita({ cita: { id: "c1" }, consulta, facturas: [factura], estilo: "paciente" })
    expect(r.map((x) => x.etiqueta)).toEqual(["Lo que encontramos", "Tu receta", "Lo que compraste"])
    expect(r[0].texto).toBe("miopía, Astigmatismo")
    expect(r[1].texto).toBe("derecho −1.75 · izquierdo −1.25")
  })
  it("sin consulta, sin medidas o sin compras no inventa nada; una factura anulada o de otra cita no cuenta", () => {
    expect(resultadoDeCita({ cita: { id: "c1" } })).toEqual([])
    expect(resultadoDeCita({ cita: { id: "c1" }, consulta: { id: "k", od: {}, oi: {} } })).toEqual([])
    const r = resultadoDeCita({ cita: { id: "c1" }, consulta, facturas: [{ ...factura, estado: "anulada" }, { ...factura, id: "f2", citaId: "otra", lineas: [{ descripcion: "Estuche" }] }] })
    expect(r.map((x) => x.clave)).toEqual(["diagnostico", "receta"])
  })
  it("una compra ligada a la consulta (sin cita) también cuenta", () => {
    const r = resultadoDeCita({ cita: { id: "c1" }, consulta, facturas: [{ ...factura, citaId: null, consultaId: "k1" }] })
    expect(r.at(-1).texto).toContain("Montura Ray-Ban")
  })
})
