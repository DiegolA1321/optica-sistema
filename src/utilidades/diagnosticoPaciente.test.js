import { describe, it, expect } from "vitest"
import { filasDeDiagnostico, compararDiagnosticos, tieneRefraccion, rotuloDeConsulta } from "./diagnosticoPaciente"

const conRefraccion = { id: "k1", fecha: "2026-10-20", motivo: "Control", diagnostico: "Miopía", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avSc: "20/40", avCc: "20/20" }, oi: { esfera: "-1.25", avSc: "20/40" }, indicaciones: "Usar siempre.", lenteRecomendado: "Monofocal", medidas: { dp: "62" } }
const sinRefraccion = { id: "k2", fecha: "2026-09-01", motivo: "Dolor de cabeza", diagnostico: "Cefalea tensional", od: { avSc: "20/20" }, oi: { avSc: "20/20" } }

describe("diagnóstico de una consulta", () => {
  it("sabe si la consulta tuvo refracción", () => {
    expect(tieneRefraccion(conRefraccion)).toBe(true)
    expect(tieneRefraccion(sinRefraccion)).toBe(false)
  })
  it("trae solo lo registrado: sin refracción no hay filas de refracción ni vacías", () => {
    const claves = filasDeDiagnostico(sinRefraccion).map(([k]) => k)
    expect(claves).toEqual(["motivo", "diagnostico", "av-od", "av-oi"])
    expect(filasDeDiagnostico(conRefraccion).map(([k]) => k)).toEqual(expect.arrayContaining(["ref-od", "ref-oi", "dp", "lente", "indicaciones"]))
  })
  it("compara dos diagnósticos y marca lo que cambió", () => {
    const filas = compararDiagnosticos(sinRefraccion, conRefraccion)
    expect(filas.find((f) => f.clave === "diagnostico")).toMatchObject({ a: "Cefalea tensional", b: "Miopía", cambio: true })
    expect(filas.find((f) => f.clave === "ref-od")).toMatchObject({ a: "—", cambio: true })
  })
  it("un rótulo corto para el selector", () => {
    expect(rotuloDeConsulta(conRefraccion, true)).toBe("20 oct 2026 · vigente · Miopía")
  })
})
