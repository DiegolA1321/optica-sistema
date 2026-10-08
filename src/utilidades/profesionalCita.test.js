import { describe, it, expect } from "vitest"
import { profesionalDeCita, mostrarProfesional, lineaProfesional, esReasignable, esTomable, asignadoOriginalDe } from "./profesionalCita"

const equipo = [{ id: "paula", nombre: "Paula" }, { id: "rosa", nombre: "Rosa" }, { id: "carlos", nombre: "Carlos" }]
const cita = (o) => ({ estado: "Pendiente", asignadoA: null, atendidoPor: null, asignadoOriginal: null, ...o })

describe("profesionalDeCita", () => {
  it("una cita asignada muestra a quien la tiene", () => {
    expect(profesionalDeCita(cita({ asignadoA: "paula" }), equipo)).toMatchObject({ tipo: "normal", nombre: "Paula", reasignadaDe: null })
  })
  it("la atendió quien la tenía: un solo dato", () => {
    expect(profesionalDeCita(cita({ asignadoA: "paula", atendidoPor: "paula", estado: "Atendida" }), equipo)).toMatchObject({ tipo: "normal", nombre: "Paula" })
  })
  it("la atendió otra persona: 'en lugar de' quien la tenía asignada", () => {
    const p = profesionalDeCita(cita({ asignadoA: "paula", atendidoPor: "rosa", estado: "Atendida" }), equipo)
    expect(p).toMatchObject({ tipo: "enLugarDe", nombre: "Rosa", enLugarDe: "Paula", verbo: "Atendida por" })
    expect(profesionalDeCita(cita({ asignadoA: "paula", atendidoPor: "rosa", estado: "En Atención" }), equipo).verbo).toBe("Atiende")
  })
  it("reasignada y atendida por la nueva persona: 'en lugar de' la original", () => {
    const p = profesionalDeCita(cita({ asignadoA: "rosa", asignadoOriginal: "paula", atendidoPor: "rosa", estado: "Atendida" }), equipo)
    expect(p).toMatchObject({ tipo: "enLugarDe", nombre: "Rosa", enLugarDe: "Paula" })
  })
  it("reasignada y todavía sin atender: dice de quién viene", () => {
    expect(profesionalDeCita(cita({ asignadoA: "rosa", asignadoOriginal: "paula" }), equipo)).toMatchObject({ tipo: "normal", nombre: "Rosa", reasignadaDe: "Paula" })
  })
  it("reasignada y devuelta a la original: ya no se dice reasignada", () => {
    expect(profesionalDeCita(cita({ asignadoA: "paula", asignadoOriginal: "paula" }), equipo).reasignadaDe).toBeNull()
  })
  it("sin asignar y sin atender", () => {
    expect(profesionalDeCita(cita({}), equipo).tipo).toBe("sinAsignar")
  })
  it("atendida sin asignación previa: quien la atendió, sin 'en lugar de'", () => {
    expect(profesionalDeCita(cita({ atendidoPor: "rosa", estado: "Atendida" }), equipo)).toMatchObject({ tipo: "normal", nombre: "Rosa" })
  })
  it("el original por defecto es la asignada", () => {
    expect(asignadoOriginalDe(cita({ asignadoA: "paula" }))).toBe("paula")
    expect(asignadoOriginalDe(cita({ asignadoA: "rosa", asignadoOriginal: "paula" }))).toBe("paula")
    expect(asignadoOriginalDe(cita({}))).toBeNull()
  })
})

describe("textos y reglas", () => {
  it("la línea de la tarjeta", () => {
    expect(lineaProfesional(cita({ asignadoA: "paula" }), equipo)).toBe("Profesional: Paula")
    expect(lineaProfesional(cita({ asignadoA: "paula", atendidoPor: "rosa", estado: "Atendida" }), equipo)).toBe("Atendida por Rosa (en lugar de Paula)")
    expect(lineaProfesional(cita({}), equipo)).toBeNull()
  })
  it("con alcance propio solo se muestra el profesional de una cita sin asignar", () => {
    expect(mostrarProfesional(cita({ asignadoA: "paula" }), true)).toBe(false)
    expect(mostrarProfesional(cita({}), true)).toBe(true)
    expect(mostrarProfesional(cita({ asignadoA: "paula" }), false)).toBe(true)
  })
  it("reasignar y tomar solo con la cita abierta; tomar, además, sin responsable", () => {
    expect(esReasignable(cita({ estado: "Pendiente" }))).toBe(true)
    expect(esReasignable(cita({ estado: "En Espera" }))).toBe(true)
    expect(esReasignable(cita({ estado: "En Atención" }))).toBe(false)
    expect(esReasignable(cita({ estado: "Atendida" }))).toBe(false)
    expect(esTomable(cita({}))).toBe(true)
    expect(esTomable(cita({ asignadoA: "paula" }))).toBe(false)
    expect(esTomable(cita({ estado: "Atendida" }))).toBe(false)
  })
})
