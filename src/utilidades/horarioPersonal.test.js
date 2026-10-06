import { describe, it, expect } from "vitest"
import { citasDePersona, resumenDia, resumenSemana, estadoAhora } from "./horarioPersonal"

// Lunes 5 de octubre de 2026, 10:00
const ahora = new Date(2026, 9, 5, 10, 0)
const dia = (mi, mf, ti, tf) => ({ manana: { activo: !!mi, inicio: mi, fin: mf }, tarde: { activo: !!ti, inicio: ti, fin: tf } })
// 09:00-11:00 (3 espacios de 40 min: 9:00, 9:40, 10:20) por la mañana el lunes
const horario = { lunes: dia("09:00", "11:00"), martes: dia("09:00", "11:00") }

describe("citasDePersona", () => {
  const citas = [
    { id: 1, asignadoA: "u1" },
    { id: 2, asignadoA: null, atendidoPor: "u1" },
    { id: 3, asignadoA: "u2", atendidoPor: "u1" },
    { id: 4, asignadoA: null, atendidoPor: null },
  ]
  it("toma las asignadas y las atendidas sin asignación; la sin responsable no cuenta", () => {
    expect(citasDePersona(citas, "u1").map((c) => c.id)).toEqual([1, 2])
  })
})

describe("resumenDia", () => {
  it("un día sin horario personal está cerrado", () => {
    expect(resumenDia({ fecha: "2026-10-07", horarioSemanal: horario, citas: [], ahora }).cerrado).toBe(true)
  })
  it("cuenta espacios ocupados y libres, y hoy no cuenta los que ya pasaron", () => {
    const citas = [{ fecha: "2026-10-06", hora: "09:40 AM", estado: "Pendiente" }]
    expect(resumenDia({ fecha: "2026-10-06", horarioSemanal: horario, citas, ahora })).toMatchObject({ total: 3, ocupados: 1, libres: 2 })
    // hoy a las 10:00: el espacio de las 9:00 y el de las 9:40 ya pasaron; queda el de 10:20
    expect(resumenDia({ fecha: "2026-10-05", horarioSemanal: horario, citas: [], ahora })).toMatchObject({ total: 3, ocupados: 0, libres: 1 })
  })
  it("una cita cancelada no ocupa espacio", () => {
    const citas = [{ fecha: "2026-10-06", hora: "09:00 AM", estado: "Cancelada" }]
    expect(resumenDia({ fecha: "2026-10-06", horarioSemanal: horario, citas, ahora }).ocupados).toBe(0)
  })
})

describe("resumenSemana", () => {
  it("devuelve siete días desde el lunes", () => {
    const sem = resumenSemana({ lunes: "2026-10-05", horarioSemanal: horario, citas: [], ahora })
    expect(sem).toHaveLength(7)
    expect(sem.filter((d) => !d.cerrado)).toHaveLength(2)
  })
})

describe("estadoAhora", () => {
  it("sin horario hoy", () => {
    expect(estadoAhora({ horarioSemanal: { martes: dia("09:00", "11:00") }, citas: [], ahora })).toBe("sinHorario")
  })
  it("en atención si tiene una cita En Atención hoy", () => {
    expect(estadoAhora({ horarioSemanal: horario, citas: [{ fecha: "2026-10-05", hora: "09:40 AM", estado: "En Atención" }], ahora })).toBe("enAtencion")
  })
  it("cita ahora si una cita pendiente cubre este momento", () => {
    expect(estadoAhora({ horarioSemanal: horario, citas: [{ fecha: "2026-10-05", hora: "09:40 AM", estado: "Pendiente" }], ahora })).toBe("citaAhora")
  })
  it("libre si no tiene nada en este momento", () => {
    expect(estadoAhora({ horarioSemanal: horario, citas: [{ fecha: "2026-10-05", hora: "10:20 AM", estado: "Pendiente" }], ahora })).toBe("libre")
  })
})
