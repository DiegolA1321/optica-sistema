import { describe, it, expect, beforeEach } from "vitest"
import { citasPorContactar, motivoDeLaCita, mensajeContacto, heredarBorrador, TIPO_AVISO_CONTACTAR } from "./contactarPaciente"
import { particionarDescartados, descarteVigente, claveDescarte } from "./avisosDescartados"
import { claveBorrador, guardarBorrador, leerBorrador } from "./borradorFicha"
import { hoyISO } from "./disponibilidad"

const hoy = hoyISO()
const ayer = new Date(Date.now() - 86400000).toLocaleDateString("en-CA", { timeZone: "America/Guayaquil" })
const cita = (o) => ({ id: "c1", pacienteId: "p1", paciente: "Ana Pérez", fecha: ayer, hora: "09:00 AM", estado: "No Asistió", ...o })

describe("Contactar al paciente", () => {
  it("lista las citas no efectuadas y descarta las que tienen un descarte vigente", () => {
    const citas = [cita({}), cita({ id: "c2", pacienteId: "p2", paciente: "Luis", estado: "Cancelada", canceladaPor: "paciente" })]
    expect(citasPorContactar(citas).map((c) => c.id).sort()).toEqual(["c1", "c2"])
    const descartes = new Map([[claveDescarte(TIPO_AVISO_CONTACTAR, "c1"), { motivo: "No se pudo contactar" }]])
    expect(citasPorContactar(citas, descartes).map((c) => c.id)).toEqual(["c2"])
  })

  it("reagendar no es cancelar: una cita reagendada sigue Pendiente y NO aparece en «Contactar al paciente»", () => {
    const reagendada = cita({ id: "r1", pacienteId: "p9", paciente: "Rosa", fecha: hoy, estado: "Pendiente" }) // mismo registro, otra fecha y hora; el seguimiento guarda «Reagendada desde…»
    expect(citasPorContactar([reagendada])).toEqual([])
    // ni siquiera si el paciente tiene una cita anterior no efectuada: la cita viva la retoma
    const previa = cita({ id: "c0", pacienteId: "p9", paciente: "Rosa", fecha: ayer, estado: "No Asistió" })
    expect(citasPorContactar([previa, reagendada]).map((c) => c.id)).toEqual([])
  })

  it("el motivo guardado manda; sin él se deduce del estado", () => {
    const seg = new Map([["c1", { motivo: "La atención se inició y no se terminó" }]])
    expect(motivoDeLaCita(cita({}), seg)).toBe("La atención se inició y no se terminó")
    expect(motivoDeLaCita(cita({}), new Map())).toBe("El paciente no asistió")
    expect(motivoDeLaCita(cita({ estado: "Cancelada" }), new Map())).toBe("El paciente canceló su cita")
  })

  it("el mensaje de WhatsApp cambia según lo que pasó y nombra la óptica", () => {
    const sinTerminar = mensajeContacto({ cita: cita({}), motivo: "La atención se inició y no se terminó", opticaNombre: "Óptica Sol" })
    expect(sinTerminar).toMatch(/Hola Ana Pérez/)
    expect(sinTerminar).toMatch(/Óptica Sol/)
    expect(sinTerminar).toMatch(/sin terminar/)
    expect(mensajeContacto({ cita: cita({ estado: "Cancelada" }), motivo: "x" })).toMatch(/cancelaste/)
    expect(mensajeContacto({ cita: cita({}), motivo: "El paciente no asistió" })).toMatch(/no pudiste venir/)
  })
})

describe("heredar el borrador de la ficha", () => {
  beforeEach(() => localStorage.clear())
  it("copia el borrador de la cita no efectuada a la cita nueva", () => {
    guardarBorrador(claveBorrador("u1", "p1", "c1"), { motivo: "Dolor de cabeza" }, Date.now())
    expect(heredarBorrador("u1", "p1", "c1", "c9")).toBe(true)
    expect(leerBorrador(claveBorrador("u1", "p1", "c9"))?.datos).toEqual({ motivo: "Dolor de cabeza" })
  })
  it("sin borrador no hay nada que heredar", () => {
    expect(heredarBorrador("u1", "p1", "c1", "c9")).toBe(false)
  })
})

describe("avisos descartados", () => {
  it("separa lo visible de lo descartado", () => {
    const lista = [{ id: "a" }, { id: "b" }, { id: "c" }]
    const d = new Map([[claveDescarte("t", "b"), { motivo: "m" }]])
    const { visibles, descartados } = particionarDescartados(lista, "t", (x) => x.id, d)
    expect(visibles.map((x) => x.id)).toEqual(["a", "c"])
    expect(descartados.map((x) => x.item.id)).toEqual(["b"])
  })
  it("un descarte con fecha vence; sin fecha es para siempre", () => {
    expect(descarteVigente({ vigenteHasta: null }, hoy)).toBe(true)
    expect(descarteVigente({ vigenteHasta: ayer }, hoy)).toBe(false)
    expect(descarteVigente({ vigenteHasta: hoy }, hoy)).toBe(true)
  })
})
