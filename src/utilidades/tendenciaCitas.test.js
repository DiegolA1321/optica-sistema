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
