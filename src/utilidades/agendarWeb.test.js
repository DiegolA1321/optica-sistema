import { describe, it, expect } from "vitest"
import { crearIcs, enlaceComoLlegar, fechaDiaLargo, fechaDiaCorto, cuandoTexto } from "./agendarWeb"
import { esHoraOcupadaError, MENSAJE_HORA_OCUPADA, mensajeErrorCita } from "./erroresCitas"

describe("agendarWeb", () => {
  it("el archivo de calendario lleva fecha, hora, duración, dirección y código, en la zona de Ecuador", () => {
    const ics = crearIcs({ codigo: "CIT-2026-7KQ2", fecha: "2026-10-29", hora: "10:40 AM", duracionMinutos: 40, titulo: "Cita en Óptica Demo", direccion: "Av. 9 de Octubre, Guayaquil" })
    expect(ics).toContain("DTSTART;TZID=America/Guayaquil:20261029T104000")
    expect(ics).toContain("DTEND;TZID=America/Guayaquil:20261029T112000")
    expect(ics).toContain("LOCATION:Av. 9 de Octubre\\, Guayaquil")
    expect(ics).toContain("Código de tu cita: CIT-2026-7KQ2")
  })
  it("una cita de la tarde cruza a 24 h bien", () => {
    expect(crearIcs({ fecha: "2026-10-29", hora: "05:20 PM", duracionMinutos: 40, titulo: "x" })).toContain("DTSTART;TZID=America/Guayaquil:20261029T172000")
  })
  it("«Cómo llegar» solo existe con dirección", () => {
    expect(enlaceComoLlegar("")).toBe("")
    expect(enlaceComoLlegar("Av. Siempre Viva 1")).toContain("google.com/maps")
  })
  it("textos de fecha sin coma", () => {
    expect(fechaDiaLargo("2026-10-28")).toBe("Miércoles 28 de octubre")
    expect(fechaDiaCorto("2026-10-28")).toBe("Mié 28 de octubre")
    expect(cuandoTexto("2026-10-28", "10:40 AM")).toBe("Miércoles 28 de octubre · 10:40 AM")
  })
})

describe("hora ocupada", () => {
  it("se reconoce por el mensaje, por el código 23505 y por el mensaje de antes", () => {
    expect(esHoraOcupadaError({ message: "Esa hora acaba de ocuparse. Elige otra." })).toBe(true)
    expect(esHoraOcupadaError({ code: "23505", message: "duplicate key" })).toBe(true)
    expect(esHoraOcupadaError({ message: "Esa hora ya no está disponible. Elige otra." })).toBe(true)
    expect(esHoraOcupadaError({ message: "Ese día la óptica no atiende. Elige otro." })).toBe(false)
    expect(esHoraOcupadaError(null)).toBe(false)
  })
  it("un solo mensaje para todo el sistema", () => {
    expect(MENSAJE_HORA_OCUPADA).toBe("Esa hora acaba de ocuparse. Elige otra.")
    expect(mensajeErrorCita({ code: "23505" }, "otro")).toBe(MENSAJE_HORA_OCUPADA)
  })
})
