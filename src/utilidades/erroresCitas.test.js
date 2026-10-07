import { describe, it, expect } from "vitest"
import { esErrorHoraInvalida, mensajeErrorCita, MENSAJE_HORA_INVALIDA } from "./erroresCitas"

describe("errores de la hora de una cita", () => {
  it("reconoce el rechazo de la base y lo traduce", () => {
    const error = { message: 'new row for relation "citas_base" violates check constraint "citas_hora_formato"' }
    expect(esErrorHoraInvalida(error)).toBe(true)
    expect(mensajeErrorCita(error, "No se pudo guardar.")).toBe(MENSAJE_HORA_INVALIDA)
  })
  it("deja pasar cualquier otro error con su mensaje", () => {
    expect(esErrorHoraInvalida({ message: "otra cosa" })).toBe(false)
    expect(mensajeErrorCita({ message: "otra cosa" }, "No se pudo guardar.")).toBe("No se pudo guardar.")
    expect(esErrorHoraInvalida(null)).toBe(false)
  })
})
