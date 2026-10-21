import { describe, it, expect } from "vitest"
import { particionarAgenda, agruparPorDia, desplazarRango, yaPasoLaHora, minutosHastaCita, siguienteCitaQueChoca, yaTerminoSuHorario } from "./agendaCitas"

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

describe("siguienteCitaQueChoca", () => {
  const cita = (id, hora, extra = {}) => ({ id, fecha: "2026-10-21", hora, estado: "Pendiente", paciente: "P" + id, ...extra })
  const ahora = (h, m) => new Date(2026, 9, 21, h, m)
  it("a tiempo no avisa: la cita de las 4:00 abierta a las 3:55 o a las 4:00", () => {
    const citas = [cita(1, "04:00 PM"), cita(2, "04:50 PM")]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(15, 55), 50)).toBeNull()
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 0), 50)).toBeNull()
  })
  it("llega a las 4:49 a la cita de las 4:00 y la de las 4:50 ya está agendada: avisa de la siguiente", () => {
    const citas = [cita(1, "04:00 PM", { duracionMinutos: 50 }), cita(2, "04:50 PM")]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 49), 40)?.id).toBe(2)
  })
  it("sin otra cita después, se atiende sin avisar", () => {
    const citas = [cita(1, "04:00 PM"), cita(2, "02:00 PM")]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 30), 50)).toBeNull()
  })
  it("una siguiente que empieza cuando ya habría terminado esta atención no choca", () => {
    const citas = [cita(1, "04:00 PM"), cita(2, "06:00 PM")]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 10), 40)).toBeNull()
  })
  it("solo mira al mismo profesional y a las citas abiertas", () => {
    const citas = [cita(1, "04:00 PM", { asignadoA: "u1" }), cita(2, "04:50 PM", { asignadoA: "u2" }), cita(3, "04:45 PM", { estado: "Cancelada" })]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 30), 40)).toBeNull()
  })
  it("una atención ya abierta no avisa", () => {
    const citas = [cita(1, "04:00 PM", { estado: "En Atención" }), cita(2, "04:50 PM")]
    expect(siguienteCitaQueChoca(citas[0], citas, ahora(16, 40), 40)).toBeNull()
  })
  it("una cita de otro día que se atiende hoy avisa si la siguiente de hoy llega antes de terminar", () => {
    const otra = cita(1, "04:00 PM", { fecha: "2026-10-24" })
    const citas = [otra, cita(2, "04:00 PM")]
    expect(siguienteCitaQueChoca(otra, citas, ahora(15, 40), 40)?.id).toBe(2)
  })
})

describe("yaTerminoSuHorario", () => {
  const cita = (fecha, hora, extra = {}) => ({ id: 1, fecha, hora, ...extra })
  const a = (h, m) => new Date(2026, 9, 21, h, m)
  it("una cita de 4:00 con 50 minutos termina a las 4:50: a las 4:49 todavía no, a las 4:50 sí", () => {
    expect(yaTerminoSuHorario(cita("2026-10-21", "04:00 PM", { duracionMinutos: 50 }), a(16, 49))).toBe(false)
    expect(yaTerminoSuHorario(cita("2026-10-21", "04:00 PM", { duracionMinutos: 50 }), a(16, 50))).toBe(true)
  })
  it("sin duración propia usa la de la óptica", () => {
    expect(yaTerminoSuHorario(cita("2026-10-21", "04:00 PM"), a(16, 39), 40)).toBe(false)
    expect(yaTerminoSuHorario(cita("2026-10-21", "04:00 PM"), a(16, 40), 40)).toBe(true)
  })
  it("un día anterior ya terminó y uno futuro no", () => {
    expect(yaTerminoSuHorario(cita("2026-10-20", "11:00 PM"), a(1, 0))).toBe(true)
    expect(yaTerminoSuHorario(cita("2026-10-22", "08:00 AM"), a(23, 0))).toBe(false)
  })
})
