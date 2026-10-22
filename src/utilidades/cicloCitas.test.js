import { describe, it, expect } from "vitest"
import { asistenciaDeCitas, faltasSeguidas, cicloDeControl, promedioEntreConsultas } from "./cicloCitas"

const c = (id, fecha, estado, hora = "10:00 AM") => ({ id, fecha, estado, hora })

describe("asistenciaDeCitas", () => {
  it("«N de M atendidas (X %)»: M son las resueltas y los pendientes van aparte", () => {
    const r = asistenciaDeCitas([c(1, "2026-10-07", "Atendida"), c(2, "2026-10-21", "No Asistió"), c(3, "2026-04-20", "No Asistió"), c(4, "2026-12-01", "Pendiente")])
    expect(r).toMatchObject({ atendidas: 1, noEfectuadas: 2, canceladas: 0, pendientes: 1, resueltas: 3, porcentaje: 33 })
  })
  it("las canceladas cuentan en M y sin citas resueltas no hay porcentaje", () => {
    expect(asistenciaDeCitas([c(1, "2026-10-07", "Atendida"), c(2, "2026-10-08", "Cancelada")])).toMatchObject({ resueltas: 2, porcentaje: 50 })
    expect(asistenciaDeCitas([c(1, "2026-12-01", "Pendiente")]).porcentaje).toBeNull()
  })
})

describe("faltasSeguidas", () => {
  it("devuelve las dos últimas si ambas son no efectuadas", () => {
    const l = faltasSeguidas([c(1, "2026-04-20", "Atendida"), c(2, "2026-09-01", "No Asistió"), c(3, "2026-10-21", "No Asistió")])
    expect(l.map((x) => x.id)).toEqual([3, 2])
  })
  it("una atendida entre medias, una cancelada o una sola falta no cuentan como «dos seguidas»", () => {
    expect(faltasSeguidas([c(1, "2026-09-01", "No Asistió"), c(2, "2026-10-21", "Atendida")])).toEqual([])
    expect(faltasSeguidas([c(1, "2026-09-01", "No Asistió"), c(2, "2026-10-01", "Cancelada"), c(3, "2026-10-21", "No Asistió")]).map((x) => x.id)).toEqual([3, 1])
    expect(faltasSeguidas([c(1, "2026-10-21", "No Asistió")])).toEqual([])
    expect(faltasSeguidas([c(1, "2026-10-21", "No Asistió"), c(2, "2026-10-22", "Pendiente")])).toEqual([])
  })
})

describe("cicloDeControl", () => {
  it("los días para el control y dónde está hoy entre la última consulta y el control", () => {
    expect(cicloDeControl({ inicio: "2026-10-07", control: "2027-04-05", hoy: "2026-10-22" })).toEqual({ diasParaControl: 165, avance: 8, vencido: false })
  })
  it("vencido: días negativos y la barra llena", () => {
    expect(cicloDeControl({ inicio: "2026-01-01", control: "2026-04-01", hoy: "2026-05-01" })).toMatchObject({ diasParaControl: -30, avance: 100, vencido: true })
  })
  it("sin control o sin inicio no hay ciclo", () => {
    expect(cicloDeControl({ inicio: "2026-01-01", control: null, hoy: "2026-05-01" })).toBeNull()
  })
})

describe("promedioEntreConsultas", () => {
  it("solo con dos o más consultas, en meses (mínimo 1)", () => {
    expect(promedioEntreConsultas([{ fecha: "2026-04-20" }])).toBeNull()
    expect(promedioEntreConsultas([{ fecha: "2026-10-07" }, { fecha: "2026-04-20" }])).toBe(6)
    expect(promedioEntreConsultas([{ fecha: "2026-10-07" }, { fecha: "2026-10-01" }])).toBe(1)
  })
  it("dos atenciones el mismo día son una sola visita: no hay promedio ni se achica", () => {
    expect(promedioEntreConsultas([{ fecha: "2026-10-07" }, { fecha: "2026-10-07" }])).toBeNull()
    expect(promedioEntreConsultas([{ fecha: "2026-10-07" }, { fecha: "2026-10-07" }, { fecha: "2026-04-20" }])).toBe(6)
  })
})
