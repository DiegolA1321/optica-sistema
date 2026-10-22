import { describe, it, expect } from "vitest"
import { atencionDeHoy } from "./atencionDeHoy"

const HOY = "2026-10-22"
const ana = { id: "p1", nombre: "Ana Ruiz" }
const cita = (id, estado, extra = {}) => ({ id, pacienteId: "p1", paciente: "Ana Ruiz", fecha: HOY, hora: "10:00 AM", estado, ...extra })

describe("atencionDeHoy", () => {
  it("sin nada hoy: ni en curso ni atendida (se crea la atención sin preguntar)", () => {
    expect(atencionDeHoy({ paciente: ana, citas: [cita("c0", "Atendida", { fecha: "2026-10-21" })], consultas: [], hoy: HOY })).toEqual({ enCurso: null, yaAtendida: null })
  })
  it("con una cita de hoy abierta, «Atender» la continúa (en atención primero)", () => {
    const r = atencionDeHoy({ paciente: ana, citas: [cita("c1", "Pendiente", { hora: "09:00 AM" }), cita("c2", "En Atención", { hora: "11:00 AM" })], hoy: HOY })
    expect(r.enCurso.id).toBe("c2")
    expect(r.yaAtendida).toBeNull()
  })
  it("una cita de hoy ya atendida pide confirmación para registrar otra consulta", () => {
    const r = atencionDeHoy({ paciente: ana, citas: [cita("c1", "Atendida")], hoy: HOY })
    expect(r.enCurso).toBeNull()
    expect(r.yaAtendida.cita.id).toBe("c1")
  })
  it("una ficha guardada hoy (aunque no tenga cita) también cuenta como ya atendido", () => {
    const r = atencionDeHoy({ paciente: ana, consultas: [{ id: "k1", pacienteId: "p1", fecha: HOY }], hoy: HOY })
    expect(r.yaAtendida.consulta.id).toBe("k1")
  })
  it("no mezcla a otro paciente ni otro día; sin id de paciente en la cita, reconoce por nombre", () => {
    expect(atencionDeHoy({ paciente: ana, citas: [cita("c1", "Atendida", { pacienteId: "p2", paciente: "Beto" })], hoy: HOY }).yaAtendida).toBeNull()
    expect(atencionDeHoy({ paciente: ana, citas: [{ id: "c1", paciente: "Ana Ruiz", fecha: HOY, hora: "10:00 AM", estado: "Atendida" }], hoy: HOY }).yaAtendida).not.toBeNull()
  })
  it("una cita abierta y una atendida a la vez: se continúa la abierta", () => {
    const r = atencionDeHoy({ paciente: ana, citas: [cita("c1", "Atendida"), cita("c2", "En Espera", { hora: "12:00 PM" })], hoy: HOY })
    expect(r.enCurso.id).toBe("c2")
  })
})
