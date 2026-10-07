import { describe, it, expect } from "vitest"
import { puedeCancelarCita, esPrimeraVez, coincideEstado, coincideOrigen, coincideSeguimiento, coincideResponsable } from "./filtrosCitas"

const ahora = new Date(2026, 9, 6, 10, 0) // 6 oct 2026, 10:00

describe("esPrimeraVez", () => {
  const cita = { id: "c2", pacienteId: "p1", fecha: "2026-10-10" }
  it("sin consultas previas es primera vez", () => {
    expect(esPrimeraVez(cita, [])).toBe(true)
  })
  it("con una consulta anterior es seguimiento", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p1", citaId: "c1", fecha: "2026-09-01" }])).toBe(false)
  })
  it("la consulta de la propia cita no le quita la etiqueta", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p1", citaId: "c2", fecha: "2026-10-10" }])).toBe(true)
  })
  it("una consulta de otro paciente no cuenta", () => {
    expect(esPrimeraVez(cita, [{ pacienteId: "p2", citaId: "x", fecha: "2026-09-01" }])).toBe(true)
  })
  it("una cita sin paciente vinculado es primera vez", () => {
    expect(esPrimeraVez({ id: "c3", pacienteId: null, fecha: "2026-10-10" }, [])).toBe(true)
  })
})

describe("coincideEstado", () => {
  it("todas deja pasar cualquier estado", () => {
    expect(coincideEstado({ estado: "Cancelada" }, "todas", ahora)).toBe(true)
  })
  it("separa pendientes, en atención, atendidas y canceladas", () => {
    expect(coincideEstado({ estado: "Pendiente" }, "pendiente", ahora)).toBe(true)
    expect(coincideEstado({ estado: "En Atención" }, "enAtencion", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Atendida" }, "atendida", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Cancelada" }, "cancelada", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Atendida" }, "pendiente", ahora)).toBe(false)
  })
  it("noAsistio: solo las citas marcadas No asistió", () => {
    expect(coincideEstado({ estado: "No Asistió" }, "noAsistio", ahora)).toBe(true)
    expect(coincideEstado({ estado: "Pendiente", fecha: "2026-10-05", hora: "9:00" }, "noAsistio", ahora)).toBe(false)
    expect(coincideEstado({ estado: "Atendida" }, "noAsistio", ahora)).toBe(false)
  })
})

describe("origen y seguimiento", () => {
  it("filtra por origen", () => {
    expect(coincideOrigen({ origen: "paciente" }, "paciente")).toBe(true)
    expect(coincideOrigen({ origen: "staff" }, "paciente")).toBe(false)
    expect(coincideOrigen({ origen: "staff" }, "todos")).toBe(true)
  })
  it("filtra por primera vez o seguimiento", () => {
    const cita = { id: "c2", pacienteId: "p1", fecha: "2026-10-10" }
    const consultas = [{ pacienteId: "p1", citaId: "c1", fecha: "2026-09-01" }]
    expect(coincideSeguimiento(cita, "seguimiento", consultas)).toBe(true)
    expect(coincideSeguimiento(cita, "primera", consultas)).toBe(false)
    expect(coincideSeguimiento(cita, "todos", consultas)).toBe(true)
  })
})

describe("coincideResponsable", () => {
  it("todos deja pasar todo", () => {
    expect(coincideResponsable({ asignadoA: null }, "asignadoA", "todos")).toBe(true)
  })
  it("ninguno solo deja las citas sin esa persona", () => {
    expect(coincideResponsable({ asignadoA: null }, "asignadoA", "ninguno")).toBe(true)
    expect(coincideResponsable({ asignadoA: "u1" }, "asignadoA", "ninguno")).toBe(false)
  })
  it("un id deja las citas de esa persona, por separado para asignado y atendido", () => {
    const cita = { asignadoA: "u1", atendidoPor: "u2" }
    expect(coincideResponsable(cita, "asignadoA", "u1")).toBe(true)
    expect(coincideResponsable(cita, "asignadoA", "u2")).toBe(false)
    expect(coincideResponsable(cita, "atendidoPor", "u2")).toBe(true)
  })
})

describe("puedeCancelarCita", () => {
  it("no se cancela lo ya atendido ni lo ya cancelado", () => {
    expect(puedeCancelarCita({ estado: "Atendida" })).toBe(false)
    expect(puedeCancelarCita({ estado: "Cancelada" })).toBe(false)
    for (const estado of ["Pendiente", "En Espera", "En Atención", "No Asistió"]) expect(puedeCancelarCita({ estado })).toBe(true)
  })
})
