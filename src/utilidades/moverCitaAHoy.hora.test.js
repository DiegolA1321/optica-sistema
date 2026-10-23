// Si mover la cita a hoy choca con otra cita del mismo profesional, el mensaje es el del resto del sistema, no «Revisa tu conexión».
import { describe, it, expect, vi } from "vitest"
import { moverCitaAHoy } from "./moverCitaAHoy"
import { MENSAJE_HORA_OCUPADA } from "./erroresCitas"

const supabaseCon = (error) => ({ from: () => ({ update: () => ({ eq: () => ({ select: async () => ({ data: null, error }) }) }) }) })
const cita = { id: "c1", paciente: "Ana", fecha: "2020-01-01", hora: "09:00 AM", estado: "Pendiente" }

describe("moverCitaAHoy: errores", () => {
  it("hora ocupada (23505): «Esa hora acaba de ocuparse»", async () => {
    const r = await moverCitaAHoy({ supabase: supabaseCon({ code: "23505", message: "Esa hora acaba de ocuparse. Elige otra." }), opticaId: "o", cita, citas: [cita], setCitas: vi.fn(), usuario: {} })
    expect(r.error).toBe(MENSAJE_HORA_OCUPADA)
  })
  it("otro fallo: el mensaje de conexión de siempre", async () => {
    const r = await moverCitaAHoy({ supabase: supabaseCon({ code: "XX000", message: "boom" }), opticaId: "o", cita, citas: [cita], setCitas: vi.fn(), usuario: {} })
    expect(r.error).toMatch(/Revisa tu conexión/)
  })
})
