import { describe, it, expect } from "vitest"
import { nivelCarga, citasQueCuentan } from "./cargaCitas"

describe("nivelCarga", () => {
  it("un día sin citas es nivel 0", () => {
    expect(nivelCarga(0, 8)).toBe(0)
    expect(nivelCarga(3, 0)).toBe(0)
  })
  it("el día más cargado es nivel 4", () => {
    expect(nivelCarga(8, 8)).toBe(4)
  })
  it("reparte los días intermedios en niveles de 1 a 4", () => {
    expect(nivelCarga(1, 8)).toBe(1)
    expect(nivelCarga(2, 8)).toBe(1)
    expect(nivelCarga(3, 8)).toBe(2)
    expect(nivelCarga(5, 8)).toBe(3)
    expect(nivelCarga(7, 8)).toBe(4)
  })
  it("con una sola cita en todo el mes, ese día es nivel 4", () => {
    expect(nivelCarga(1, 1)).toBe(4)
  })
})

describe("citasQueCuentan", () => {
  it("no cuenta las canceladas", () => {
    expect(citasQueCuentan([{ estado: "Pendiente" }, { estado: "Cancelada" }, { estado: "Atendida" }])).toHaveLength(2)
  })
})
