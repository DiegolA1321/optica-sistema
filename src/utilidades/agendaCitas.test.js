import { describe, it, expect } from "vitest"
import { particionarAgenda, agruparPorDia, desplazarRango, yaPasoLaHora, minutosHastaCita } from "./agendaCitas"

const c = (id, fecha, hora) => ({ id, fecha, hora })

describe("particionarAgenda", () => {
  it("separa hoy en adelante (ascendente) de anteriores (la más reciente primero)", () => {
    const citas = [
      c(1, "2026-09-03", "09:00 AM"),
      c(2, "2026-09-30", "03:00 PM"),
      c(3, "2026-09-30", "09:00 AM"),
      c(4, "2026-10-02", "10:00 AM"),
      c(5, "2026-09-20", "10:00 AM"),
    ]
    const { proximas, anteriores } = particionarAgenda(citas, "2026-09-30")
    expect(proximas.map((x) => x.id)).toEqual([3, 2, 4])
    expect(anteriores.map((x) => x.id)).toEqual([5, 1])
  })
})

describe("agruparPorDia", () => {
  it("agrupa conservando el orden recibido", () => {
    const g = agruparPorDia([c(1, "2026-09-30", "09:00 AM"), c(2, "2026-09-30", "10:00 AM"), c(3, "2026-10-01", "09:00 AM")])
    expect(g.map(([dia, cs]) => [dia, cs.length])).toEqual([["2026-09-30", 2], ["2026-10-01", 1]])
  })
})

describe("desplazarRango", () => {
  it("sin rango previo parte de la semana que empieza hoy", () => {
    expect(desplazarRango("", "", 1, "2026-09-30")).toEqual({ desde: "2026-10-07", hasta: "2026-10-13" })
    expect(desplazarRango("", "", -1, "2026-09-30")).toEqual({ desde: "2026-09-23", hasta: "2026-09-29" })
  })
  it("mueve un rango existente de a una semana", () => {
    expect(desplazarRango("2026-10-07", "2026-10-13", -1, "2026-09-30")).toEqual({ desde: "2026-09-30", hasta: "2026-10-06" })
  })
})

describe("minutosHastaCita", () => {
  const ahora = new Date(2026, 8, 30, 14, 0) // 30 sep 2026, 2:00 PM
  it("entiende la hora en 12 h (AM y PM)", () => {
    expect(minutosHastaCita(c(1, "2026-09-30", "05:00 PM"), ahora)).toBe(180)
    expect(minutosHastaCita(c(1, "2026-10-01", "09:40 AM"), ahora)).toBe(24 * 60 - 14 * 60 + 9 * 60 + 40)
    expect(minutosHastaCita(c(1, "2026-10-01", "12:00 AM"), ahora)).toBe(600)
    expect(minutosHastaCita(c(1, "2026-09-30", "12:30 PM"), ahora)).toBe(-90)
  })
  it("es negativo si la cita ya pasó, también de otro día", () => {
    expect(minutosHastaCita(c(1, "2026-09-29", "02:00 PM"), ahora)).toBe(-1440)
  })
  it("cruza de mes y de año", () => {
    expect(minutosHastaCita(c(1, "2027-01-01", "02:00 PM"), new Date(2026, 11, 31, 14, 0))).toBe(1440)
  })
})

describe("yaPasoLaHora", () => {
  const ahora = new Date(2026, 8, 30, 14, 0) // 30 sep 2026, 2:00 PM
  it("fechas pasadas sí, futuras no", () => {
    expect(yaPasoLaHora(c(1, "2026-09-29", "09:00 AM"), ahora)).toBe(true)
    expect(yaPasoLaHora(c(1, "2026-10-01", "09:00 AM"), ahora)).toBe(false)
  })
  it("hoy compara la hora", () => {
    expect(yaPasoLaHora(c(1, "2026-09-30", "01:30 PM"), ahora)).toBe(true)
    expect(yaPasoLaHora(c(1, "2026-09-30", "05:00 PM"), ahora)).toBe(false)
  })
})
