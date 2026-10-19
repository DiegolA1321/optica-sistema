import { describe, it, expect } from "vitest"
import { medidasDelPaciente, mensajeMedidas, mapSolicitudMedidas, medidaConUnidad } from "./medidasMontaje"

describe("medidasDelPaciente", () => {
  it("toma la DP de la receta más reciente que la tenga y la altura de la última orden que la tenga", () => {
    const consultas = [
      { fecha: "2026-01-10", creadoEn: "a", medidas: { dp: "60" } },
      { fecha: "2026-09-01", creadoEn: "b", medidas: { dp: "62" } },
      { fecha: "2026-10-01", creadoEn: "c", medidas: {} },
    ]
    const ordenes = [{ numero: 1, creadaEn: "2026-02-01T10:00:00Z", alturaMontaje: "17" }, { numero: 2, creadaEn: "2026-09-05T10:00:00Z", alturaMontaje: "18" }, { numero: 3, creadaEn: "2026-10-05T10:00:00Z", alturaMontaje: "" }]
    expect(medidasDelPaciente({ consultas, ordenes })).toEqual({ dp: "62", altura: "18", faltan: false, hayAlgo: true })
  })
  it("sin orden de lentes falta la altura; sin nada, no hay qué enviar", () => {
    expect(medidasDelPaciente({ consultas: [{ fecha: "2026-09-01", medidas: { dp: "62" } }], ordenes: [] })).toMatchObject({ dp: "62", altura: "", faltan: true, hayAlgo: true })
    expect(medidasDelPaciente({})).toMatchObject({ faltan: true, hayAlgo: false })
  })
})

describe("mensajeMedidas", () => {
  it("redacta solo las medidas que existen, con unidad", () => {
    const m = mensajeMedidas({ paciente: { nombre: "Rosa Bravo" }, opticaNombre: "Óptica Solna", dp: "62", altura: "18 mm" })
    expect(m).toContain("Hola, Rosa Bravo")
    expect(m).toContain("Óptica Solna")
    expect(m).toContain("Distancia pupilar: 62 mm")
    expect(m).toContain("Altura de montaje: 18 mm")
    expect(m).not.toContain("18 mm mm")
    expect(mensajeMedidas({ paciente: {}, opticaNombre: "", dp: "62", altura: "" })).not.toContain("Altura")
  })
})

describe("mapSolicitudMedidas", () => {
  it("convierte la respuesta de la base", () => {
    expect(mapSolicitudMedidas({ abierta_desde: null, ultima: { resultado: "cita", cerrada: "2026-10-19T10:00:00Z", dp: null, altura: null, cita_fecha: "2026-10-22", cita_hora: "03:00 PM" } }))
      .toEqual({ abiertaDesde: null, ultima: { resultado: "cita", cerrada: "2026-10-19T10:00:00Z", dp: "", altura: "", citaFecha: "2026-10-22", citaHora: "03:00 PM" } })
    expect(mapSolicitudMedidas(null)).toBeNull()
    expect(medidaConUnidad("62")).toBe("62 mm")
  })
})
