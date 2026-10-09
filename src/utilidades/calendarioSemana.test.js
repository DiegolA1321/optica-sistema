import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { lunesDeSemana, diasDeSemana, rangoHoras, franjasSombreadas, bloquesDelDia, validarMovimiento, celdaLibre } from "./calendarioSemana"

const sesion = (inicio, fin) => ({ activo: true, inicio, fin })
const cerrado = { manana: { activo: false }, tarde: { activo: false } }
const jornada = { manana: sesion("09:00", "13:00"), tarde: sesion("14:00", "18:00") }
const disp = (extra = {}) => ({
  duracionCita: 30,
  horarioSemanal: { lunes: jornada, martes: jornada, miercoles: jornada, jueves: jornada, viernes: jornada, sabado: cerrado, domingo: cerrado },
  excepciones: {},
  ...extra,
})
// 2026-10-05 es lunes.
const AHORA = new Date(2026, 9, 5, 8, 0)

describe("lunesDeSemana / diasDeSemana", () => {
  it("devuelve el lunes de cualquier día de la semana", () => {
    expect(lunesDeSemana("2026-10-05")).toBe("2026-10-05")
    expect(lunesDeSemana("2026-10-08")).toBe("2026-10-05")
    expect(lunesDeSemana("2026-10-11")).toBe("2026-10-05")
  })
  it("muestra siempre los siete días, de lunes a domingo, aunque el domingo esté cerrado", () => {
    expect(diasDeSemana("2026-10-05", disp(), [])).toEqual(["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10", "2026-10-11"])
    expect(diasDeSemana("2026-10-05", disp(), [{ fecha: "2026-10-11" }])).toHaveLength(7)
  })
})

describe("franjasSombreadas: día cerrado con nombre", () => {
  it("un feriado cerrado a mano lleva su nombre en la franja", () => {
    const d = disp({ excepciones: { "2026-11-02": { manana: { activo: false }, tarde: { activo: false }, nombre: "Feriado: Día de los Difuntos" } } })
    const franjas = franjasSombreadas("2026-11-02", d, { inicio: 480, fin: 1080 })
    expect(franjas).toHaveLength(1)
    expect(franjas[0]).toMatchObject({ tipo: "cerrado", etiqueta: "Feriado: Día de los Difuntos" })
    expect(franjasSombreadas("2026-11-03", d, { inicio: 480, fin: 1080 })[0].etiqueta).toBeUndefined()
  })
})

describe("rangoHoras", () => {
  it("va de la apertura al cierre", () => {
    expect(rangoHoras(["2026-10-05"], disp())).toEqual({ inicio: 540, fin: 1080 })
  })
  it("se amplía si una cita cae fuera de horario", () => {
    const r = rangoHoras(["2026-10-05"], disp(), [{ fecha: "2026-10-05", hora: "07:00 AM" }])
    expect(r.inicio).toBe(420)
  })
  it("sin horario ni citas usa un rango por defecto", () => {
    expect(rangoHoras(["2026-10-10"], disp())).toEqual({ inicio: 480, fin: 1080 })
  })
})

describe("franjasSombreadas", () => {
  const rango = { inicio: 480, fin: 1140 }
  it("sombrea fuera de horario y almuerzo", () => {
    const f = franjasSombreadas("2026-10-05", disp(), rango)
    expect(f).toEqual([
      { inicio: 480, fin: 540, tipo: "cerrado", motivo: undefined },
      { inicio: 780, fin: 840, tipo: "almuerzo", motivo: undefined },
      { inicio: 1080, fin: 1140, tipo: "cerrado", motivo: undefined },
    ])
  })
  it("un día cerrado se sombrea completo", () => {
    expect(franjasSombreadas("2026-10-10", disp(), rango)).toEqual([{ inicio: 480, fin: 1140, tipo: "cerrado", motivo: undefined }])
  })
  it("incluye las ausencias de Mi horario", () => {
    const d = disp({ excepciones: { "2026-10-05": { ...jornada, ausencias: [{ inicio: "10:00", fin: "11:00", motivo: "Trámite" }] } } })
    expect(franjasSombreadas("2026-10-05", d, rango).find((x) => x.tipo === "ausencia")).toEqual({ inicio: 600, fin: 660, tipo: "ausencia", motivo: "Trámite" })
  })
})

describe("bloquesDelDia", () => {
  it("reparte en columnas las citas solapadas y deja a las canceladas aparte", () => {
    const citas = [
      { id: 1, fecha: "2026-10-05", hora: "09:00 AM", duracionMinutos: 60, estado: "Pendiente" },
      { id: 2, fecha: "2026-10-05", hora: "09:30 AM", estado: "Pendiente" },
      { id: 3, fecha: "2026-10-05", hora: "11:00 AM", estado: "Pendiente" },
      { id: 4, fecha: "2026-10-05", hora: "09:00 AM", estado: "Cancelada" },
      { id: 5, fecha: "2026-10-06", hora: "09:00 AM", estado: "Pendiente" },
    ]
    const b = Object.fromEntries(bloquesDelDia(citas, "2026-10-05", 30).map((x) => [x.cita.id, x]))
    expect([b[1].col, b[1].cols, b[2].col, b[2].cols]).toEqual([0, 2, 1, 2])
    expect([b[3].col, b[3].cols]).toEqual([0, 1])
    expect(b[4].cancelada).toBe(true)
    expect(b[4].cols).toBe(1)
    expect(b[5]).toBeUndefined()
  })
  it("la altura sale de la duración real", () => {
    const [b] = bloquesDelDia([{ id: 1, fecha: "2026-10-05", hora: "10:00 AM", duracionMinutos: 45, estado: "Pendiente" }], "2026-10-05", 30)
    expect(b.fin - b.inicio).toBe(45)
  })
})

describe("validarMovimiento", () => {
  // La validación de disponibilidad también mira el reloj real: se fija para que la prueba no dependa de la hora en que corre.
  beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(AHORA) })
  afterAll(() => vi.useRealTimers())
  const cita = { id: 1, fecha: "2026-10-06", hora: "09:00 AM", estado: "Pendiente" }
  const otra = { id: 2, fecha: "2026-10-07", hora: "10:00 AM", estado: "Pendiente" }
  const mover = (fecha, min, citas = [cita, otra]) => validarMovimiento(cita, fecha, min, disp(), citas, AHORA)

  it("acepta un horario libre dentro del horario", () => expect(mover("2026-10-07", 11 * 60).ok).toBe(true))
  it("rechaza el mismo horario", () => expect(mover("2026-10-06", 9 * 60).ok).toBe(false))
  it("rechaza el pasado", () => expect(mover("2026-10-05", 7 * 60).motivo).toMatch(/pasado/))
  it("rechaza fuera de horario y el almuerzo", () => {
    expect(mover("2026-10-07", 8 * 60).motivo).toMatch(/fuera del horario/)
    expect(mover("2026-10-07", 13 * 60 + 15).motivo).toMatch(/fuera del horario/)
    expect(mover("2026-10-10", 10 * 60).motivo).toMatch(/fuera del horario/)
  })
  it("rechaza un horario ocupado por otra cita", () => expect(mover("2026-10-07", 10 * 60).motivo).toMatch(/ocupado/))
  it("una cita cancelada no bloquea", () => {
    expect(mover("2026-10-07", 10 * 60, [cita, { ...otra, estado: "Cancelada" }]).ok).toBe(true)
  })
  it("rechaza una ausencia", () => {
    const d = disp({ excepciones: { "2026-10-07": { ...jornada, ausencias: [{ inicio: "11:00", fin: "12:00" }] } } })
    expect(validarMovimiento(cita, "2026-10-07", 11 * 60, d, [cita], AHORA).ok).toBe(false)
  })
})

describe("celdaLibre", () => {
  const citas = [
    { id: 1, fecha: "2026-10-07", hora: "10:00 AM", estado: "Pendiente" },
    { id: 2, fecha: "2026-10-07", hora: "11:00 AM", estado: "Cancelada" },
  ]
  const libre = (f, m, d = disp()) => celdaLibre(f, m, d, citas, AHORA)
  it("es libre dentro del horario, sin cita ni ausencia", () => expect(libre("2026-10-07", 9 * 60)).toBe(true))
  it("no lo es sobre una cita activa, pero sí sobre una cancelada", () => {
    expect(libre("2026-10-07", 10 * 60)).toBe(false)
    expect(libre("2026-10-07", 11 * 60)).toBe(true)
  })
  it("no lo es en el almuerzo, fuera de horario, en el pasado ni en una ausencia", () => {
    expect(libre("2026-10-07", 13 * 60 + 30)).toBe(false)
    expect(libre("2026-10-07", 8 * 60)).toBe(false)
    expect(libre("2026-10-05", 8 * 60 + 30)).toBe(false)
    const d = disp({ excepciones: { "2026-10-08": { ...jornada, ausencias: [{ inicio: "15:00", fin: "16:00" }] } } })
    expect(libre("2026-10-08", 15 * 60, d)).toBe(false)
  })
})
