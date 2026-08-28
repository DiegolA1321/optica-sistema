import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  fechaAISO,
  isoAFechaLocal,
  horaA12,
  minutosDesde24h,
  minutosDesdeMedianoche,
  generarSlots,
  diaAbierto,
  horarioEfectivo,
  resumenHorarioSemanal,
  parseFechaFlexible,
  esHoy,
  esPasada,
  esFutura,
  etiquetaFecha,
  slotsDisponibles,
  diaTieneCupo,
} from "./disponibilidad"

const SESION = (activo, inicio, fin) => ({ activo, inicio, fin })

describe("fechaAISO / isoAFechaLocal", () => {
  it("da la vuelta completa sin desfase de zona horaria", () => {
    const d = new Date(2026, 2, 5) // 5 de marzo de 2026 (mes 0-indexado)
    expect(fechaAISO(d)).toBe("2026-03-05")
    expect(isoAFechaLocal("2026-03-05").getTime()).toBe(d.getTime())
  })
})

describe("horaA12", () => {
  it("convierte horas 24h a formato 12h con AM/PM", () => {
    expect(horaA12("09:00")).toBe("09:00 AM")
    expect(horaA12("13:30")).toBe("01:30 PM")
    expect(horaA12("00:00")).toBe("12:00 AM")
    expect(horaA12("12:00")).toBe("12:00 PM")
  })
  it("vacío da string vacío", () => {
    expect(horaA12("")).toBe("")
  })
})

describe("minutosDesde24h / minutosDesdeMedianoche", () => {
  it("minutosDesde24h convierte HH:MM a minutos", () => {
    expect(minutosDesde24h("09:30")).toBe(570)
    expect(minutosDesde24h("00:00")).toBe(0)
  })
  it("minutosDesdeMedianoche ordena cronológicamente aunque el string no ordene alfabéticamente", () => {
    // "09:00 AM" > "01:00 PM" alfabéticamente, pero las 9am son antes que la 1pm.
    expect(minutosDesdeMedianoche("09:00 AM")).toBeLessThan(minutosDesdeMedianoche("01:00 PM"))
    expect(minutosDesdeMedianoche("12:00 AM")).toBe(0)
    expect(minutosDesdeMedianoche("12:00 PM")).toBe(720)
  })
})

describe("diaAbierto", () => {
  it("true si mañana o tarde están activas", () => {
    expect(diaAbierto({ manana: SESION(true, "09:00", "13:00"), tarde: SESION(false, "14:00", "18:00") })).toBe(true)
  })
  it("false si ninguna sesión está activa", () => {
    expect(diaAbierto({ manana: SESION(false, "09:00", "13:00"), tarde: SESION(false, "14:00", "18:00") })).toBe(false)
  })
  it("false con horario vacío/undefined", () => {
    expect(diaAbierto(undefined)).toBe(false)
  })
})

describe("generarSlots", () => {
  it("genera slots cada `duracion` minutos dentro del rango, sin pasarse del límite", () => {
    const slots = generarSlots({ manana: SESION(true, "09:00", "10:20"), tarde: SESION(false), duracion: 40 })
    expect(slots).toEqual(["09:00 AM", "09:40 AM"])
  })
  it("junta mañana y tarde cuando ambas están activas", () => {
    const slots = generarSlots({ manana: SESION(true, "09:00", "10:00"), tarde: SESION(true, "14:00", "15:00"), duracion: 60 })
    expect(slots).toEqual(["09:00 AM", "02:00 PM"])
  })
  it("sesión inactiva no aporta slots", () => {
    expect(generarSlots({ manana: SESION(false, "09:00", "13:00"), tarde: SESION(false, "14:00", "18:00") })).toEqual([])
  })
})

describe("horarioEfectivo", () => {
  const disponibilidad = {
    horarioSemanal: {
      lunes: { manana: SESION(true, "09:00", "13:00"), tarde: SESION(true, "14:00", "18:00") },
      domingo: { manana: SESION(false, "09:00", "13:00"), tarde: SESION(false, "14:00", "18:00") },
    },
    excepciones: {
      "2026-03-02": { manana: SESION(false), tarde: SESION(false) }, // cierra ese lunes puntual
    },
  }

  it("usa el horario semanal del día si no hay excepción", () => {
    // 2026-03-09 es lunes.
    expect(horarioEfectivo("2026-03-09", disponibilidad)).toEqual(disponibilidad.horarioSemanal.lunes)
  })
  it("una excepción puntual manda sobre el horario semanal habitual", () => {
    expect(horarioEfectivo("2026-03-02", disponibilidad)).toEqual(disponibilidad.excepciones["2026-03-02"])
  })
  it("día sin configuración devuelve cerrado por defecto", () => {
    expect(diaAbierto(horarioEfectivo("2026-03-08", disponibilidad))).toBe(false) // domingo, cerrado
  })
})

describe("resumenHorarioSemanal", () => {
  it("agrupa días consecutivos con el mismo horario", () => {
    const igual = { manana: SESION(true, "09:00", "13:00"), tarde: SESION(true, "14:00", "18:00") }
    const horarioSemanal = {
      lunes: igual, martes: igual, miercoles: igual, jueves: igual, viernes: igual,
      sabado: { manana: SESION(false), tarde: SESION(false) },
      domingo: { manana: SESION(false), tarde: SESION(false) },
    }
    const resumen = resumenHorarioSemanal(horarioSemanal)
    expect(resumen).toEqual([
      { etiqueta: "Lunes a Viernes", horario: "09:00 AM - 01:00 PM y 02:00 PM - 06:00 PM" },
    ])
  })
  it("vacío si no hay horario", () => {
    expect(resumenHorarioSemanal(null)).toEqual([])
  })
})

describe("parseFechaFlexible", () => {
  it("interpreta AAAA-MM-DD", () => {
    const f = parseFechaFlexible("2026-03-05")
    expect(f.getFullYear()).toBe(2026)
    expect(f.getMonth()).toBe(2)
    expect(f.getDate()).toBe(5)
  })
  it("interpreta DD/MM/AAAA (formato legado)", () => {
    const f = parseFechaFlexible("05/03/2026")
    expect(f.getFullYear()).toBe(2026)
    expect(f.getMonth()).toBe(2)
    expect(f.getDate()).toBe(5)
  })
  it("valores no reconocibles devuelven null en vez de reventar", () => {
    expect(parseFechaFlexible("")).toBeNull()
    expect(parseFechaFlexible(null)).toBeNull()
    expect(parseFechaFlexible(undefined)).toBeNull()
  })
})

describe("esHoy / esPasada / esFutura / etiquetaFecha (con fecha fija)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0)) // 10 de marzo de 2026, mediodía
  })
  afterEach(() => vi.useRealTimers())

  it("esHoy reconoce la fecha de hoy", () => {
    expect(esHoy("2026-03-10")).toBe(true)
    expect(esHoy("2026-03-11")).toBe(false)
  })
  it("esPasada / esFutura son estrictas (excluyen hoy)", () => {
    expect(esPasada("2026-03-09")).toBe(true)
    expect(esPasada("2026-03-10")).toBe(false)
    expect(esFutura("2026-03-11")).toBe(true)
    expect(esFutura("2026-03-10")).toBe(false)
  })
  it("etiquetaFecha da Hoy/Mañana/Ayer para los días cercanos", () => {
    expect(etiquetaFecha("2026-03-10")).toBe("Hoy")
    expect(etiquetaFecha("2026-03-11")).toBe("Mañana")
    expect(etiquetaFecha("2026-03-09")).toBe("Ayer")
  })
})

describe("slotsDisponibles / diaTieneCupo", () => {
  const disponibilidad = {
    horarioSemanal: {
      lunes: { manana: SESION(true, "09:00", "11:00"), tarde: SESION(false) },
    },
    duracionCita: 60,
  }

  it("marca como ocupado un slot con una cita existente", () => {
    // 2026-03-09 es lunes; slots esperados: 09:00 AM, 10:00 AM.
    const citas = [{ fecha: "2026-03-09", hora: "09:00 AM" }]
    const slots = slotsDisponibles("2026-03-09", disponibilidad, citas)
    expect(slots).toEqual([
      { hora: "09:00 AM", libre: false },
      { hora: "10:00 AM", libre: true },
    ])
  })

  it("diaTieneCupo es false si todos los slots del día están ocupados", () => {
    const citas = [
      { fecha: "2026-03-09", hora: "09:00 AM" },
      { fecha: "2026-03-09", hora: "10:00 AM" },
    ]
    expect(diaTieneCupo("2026-03-09", disponibilidad, citas)).toBe(false)
  })

  it("día cerrado (domingo, sin horario configurado) no tiene slots", () => {
    expect(slotsDisponibles("2026-03-08", disponibilidad, [])).toEqual([])
  })

  it("si la fecha es hoy, descarta los horarios que ya pasaron", () => {
    vi.useFakeTimers()
    // 2026-03-09 es lunes; fija "ahora" a las 09:30 AM ese mismo día.
    vi.setSystemTime(new Date(2026, 2, 9, 9, 30, 0))
    const slots = slotsDisponibles("2026-03-09", disponibilidad, [])
    expect(slots).toEqual([
      { hora: "09:00 AM", libre: false }, // ya pasó
      { hora: "10:00 AM", libre: true },
    ])
    vi.useRealTimers()
  })
})
