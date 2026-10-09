import { describe, it, expect } from "vitest"
import { contarCitas, citasPorMes, diaMasFrecuente } from "./resumenCitas"

const c = (estado, fecha = "2026-10-01") => ({ estado, fecha })

describe("contarCitas", () => {
  it("separa atendidas, no asistió, pendientes y canceladas", () => {
    const r = contarCitas([c("Atendida"), c("Atendida"), c("No Asistió"), c("Pendiente"), c("En Espera"), c("En Atención"), c("Cancelada")])
    expect(r).toEqual({ atendidas: 2, noAsistio: 1, pendientes: 3, canceladas: 1 })
  })
  it("sin citas todo es cero", () => {
    expect(contarCitas([])).toEqual({ atendidas: 0, noAsistio: 0, pendientes: 0, canceladas: 0 })
  })
})

describe("citasPorMes", () => {
  it("devuelve 12 meses terminando en el actual, de más antiguo a más reciente", () => {
    const m = citasPorMes([], "2026-10-09")
    expect(m).toHaveLength(12)
    expect(m[0].clave).toBe("2025-11")
    expect(m[11].clave).toBe("2026-10")
    expect(m[11].etiqueta).toBe("oct")
  })
  it("cuenta las citas de cada mes, ignora las canceladas y las de fuera del rango", () => {
    const m = citasPorMes([c("Atendida", "2026-10-02"), c("Pendiente", "2026-10-20"), c("Cancelada", "2026-10-05"), c("Atendida", "2026-03-10"), c("Atendida", "2024-01-01")], "2026-10-09")
    expect(m.find((x) => x.clave === "2026-10")).toMatchObject({ total: 2, atendidas: 1 })
    expect(m.find((x) => x.clave === "2026-03")).toMatchObject({ total: 1, atendidas: 1 })
    expect(m.reduce((a, x) => a + x.total, 0)).toBe(3)
  })
})

describe("diaMasFrecuente", () => {
  it("devuelve el día en que más vino", () => {
    // 2026-10-06 y 2026-09-29 son martes; 2026-10-01 es jueves
    expect(diaMasFrecuente([c("Atendida", "2026-10-06"), c("Atendida", "2026-09-29"), c("Atendida", "2026-10-01")])).toEqual({ dia: "martes", veces: 2 })
  })
  it("sin datos suficientes o con empate, nada", () => {
    expect(diaMasFrecuente([c("Atendida", "2026-10-06")])).toBeNull()
    expect(diaMasFrecuente([c("Atendida", "2026-10-06"), c("Atendida", "2026-10-01")])).toBeNull()
  })
})
