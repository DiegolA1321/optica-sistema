import { describe, it, expect } from "vitest"
import { tendenciaDeCitas, ESCALAS_TENDENCIA, ESCALA_POR_DEFECTO } from "./tendenciaCitas"

const c = (fecha, estado = "Atendida") => ({ fecha, estado })
const HOY = "2026-10-21" // miércoles

describe("tendencia de las citas del paciente", () => {
  it("por defecto es por mes, y hay tres escalas", () => {
    expect(ESCALA_POR_DEFECTO).toBe("mes")
    expect(ESCALAS_TENDENCIA.map((e) => e.id)).toEqual(["semana", "mes", "anio"])
  })
  it("por mes: 12 meses terminando en el de hoy; las canceladas no cuentan", () => {
    const t = tendenciaDeCitas([c("2026-10-02"), c("2026-10-15", "Pendiente"), c("2026-10-20", "Cancelada"), c("2025-11-05"), c("2025-10-30")], "mes", HOY)
    expect(t).toHaveLength(12)
    expect(t[11]).toMatchObject({ clave: "2026-10", total: 2, atendidas: 1 })
    expect(t[0]).toMatchObject({ clave: "2025-11", total: 1 })
  })
  it("por semana: 12 semanas de lunes a domingo, la última es la de hoy", () => {
    const t = tendenciaDeCitas([c("2026-10-19"), c("2026-10-25"), c("2026-10-26"), c("2026-10-12")], "semana", HOY)
    expect(t).toHaveLength(12)
    expect(t[11]).toMatchObject({ clave: "2026-10-19", fin: "2026-10-25", total: 2 })
    expect(t[10].total).toBe(1)
  })
  it("por año: 5 años terminando en el de hoy", () => {
    const t = tendenciaDeCitas([c("2026-01-01"), c("2024-06-06"), c("2020-01-01")], "anio", HOY)
    expect(t.map((x) => x.etiqueta)).toEqual(["2022", "2023", "2024", "2025", "2026"])
    expect(t.map((x) => x.total)).toEqual([0, 0, 1, 0, 1])
  })
})

describe("visitasPorPeriodo", () => {
  const citas = [
    { fecha: "2023-03-01", estado: "Atendida" }, { fecha: "2024-05-01", estado: "Atendida" }, { fecha: "2024-11-10", estado: "Atendida" },
    { fecha: "2025-02-02", estado: "Cancelada" }, { fecha: "2026-04-20", estado: "Atendida" }, { fecha: "2026-10-21", estado: "No Asistió" },
  ]
  it("por año: desde la primera visita hasta hoy, con los años vacíos en 0 y sin contar las canceladas", async () => {
    const { visitasPorPeriodo } = await import("./tendenciaCitas")
    expect(visitasPorPeriodo(citas, "anio", "2026-10-22").map((p) => [p.etiqueta, p.total])).toEqual([["2023", 1], ["2024", 2], ["2025", 0], ["2026", 2]])
  })
  it("por trimestre: los últimos 8 como máximo", async () => {
    const { visitasPorPeriodo } = await import("./tendenciaCitas")
    const t = visitasPorPeriodo(citas, "trimestre", "2026-10-22")
    expect(t).toHaveLength(8)
    expect(t[t.length - 1]).toMatchObject({ etiqueta: "T4 2026", total: 1 })
    expect(t.reduce((s, p) => s + p.total, 0)).toBe(2) // solo las dos de 2026: los 8 trimestres empiezan en 2025
  })
  it("sin citas, un solo período en 0", async () => {
    const { visitasPorPeriodo } = await import("./tendenciaCitas")
    expect(visitasPorPeriodo([], "anio", "2026-10-22")).toEqual([{ clave: "2026", etiqueta: "2026", larga: "2026", total: 0 }])
  })
})
