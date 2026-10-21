import { describe, it, expect } from "vitest"
import { validarDatosPaciente } from "./pacientes"

const datos = { nombre: "Ana Pérez", cedula: "1710034065", telefono: "0991234567", correo: "ana@x.com" }

describe("validarDatosPaciente (al crear o editar un paciente)", () => {
  it("acepta una cédula con el dígito verificador correcto", () => {
    expect(validarDatosPaciente([], datos)).toEqual({})
  })
  it("rechaza en el momento una cédula con el dígito verificador mal", () => {
    expect(validarDatosPaciente([], { ...datos, cedula: "1710034066" }).cedula).toMatch(/no es válida/)
    expect(validarDatosPaciente([], { ...datos, cedula: "0000000000" }).cedula).toMatch(/no es válida/)
  })
  it("no deja repetir la cédula de otro paciente, pero sí la del mismo al editarlo", () => {
    const existentes = [{ id: "p1", cedula: "1710034065" }]
    expect(validarDatosPaciente(existentes, datos).cedula).toMatch(/Ya existe/)
    expect(validarDatosPaciente(existentes, datos, "p1")).toEqual({})
  })
})
