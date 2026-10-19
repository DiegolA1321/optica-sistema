import { describe, it, expect } from "vitest"
import { textoAvisoContacto, mapAvisoContacto } from "./avisosContacto"

describe("avisos de cambio de contacto", () => {
  it("dicen quién cambió qué", () => {
    expect(textoAvisoContacto("Marta Zambrano", "telefono")).toBe("Marta Zambrano actualizó su teléfono")
    expect(textoAvisoContacto("Marta Zambrano", "correo")).toBe("Marta Zambrano actualizó su correo")
    expect(textoAvisoContacto("Marta Zambrano", "telefono_y_correo")).toBe("Marta Zambrano actualizó su teléfono y su correo")
    expect(textoAvisoContacto("", "telefono")).toBe("Un paciente actualizó su teléfono")
  })
  it("mapea la fila de la base", () => {
    expect(mapAvisoContacto({ id: "a", paciente_id: "p", campos: "correo", creado_en: "2026-10-18T10:00:00Z", atendido_en: null })).toEqual({ id: "a", pacienteId: "p", campos: "correo", creadoEn: "2026-10-18T10:00:00Z" })
  })
})
