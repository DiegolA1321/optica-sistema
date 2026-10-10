import { describe, it, expect, vi } from "vitest"
import { estadosCorregibles, estadoCorregibleEs } from "./estadosCita"
import { horaLibreAhora, necesitaMoverseAHoy } from "./moverCitaAHoy"

const HOY = "2026-10-10"

describe("estados que se pueden corregir a mano", () => {
  it("una cita de un día futuro solo puede estar pendiente o cancelada: nunca en atención, atendida ni sin asistir", () => {
    expect(estadosCorregibles({ fecha: "2026-10-14", estado: "Pendiente" }, HOY)).toEqual(["Pendiente", "Cancelada"])
    for (const e of ["En Atención", "Atendida", "No Asistió"]) expect(estadoCorregibleEs({ fecha: "2026-10-14", estado: "Pendiente" }, e, HOY)).toBe(false)
  })
  it("una cita de hoy o de un día pasado puede tener cualquier estado", () => {
    expect(estadosCorregibles({ fecha: HOY, estado: "Pendiente" }, HOY)).toHaveLength(5)
    expect(estadosCorregibles({ fecha: "2026-10-01", estado: "No Asistió" }, HOY)).toContain("En Atención")
  })
  it("un dato viejo en un estado imposible se ve tal cual, y se ofrece sacarlo de ahí", () => {
    const mala = { fecha: "2026-10-14", estado: "En Atención" }
    expect(estadosCorregibles(mala, HOY)).toEqual(["En Atención", "Pendiente", "Cancelada"])
    expect(estadoCorregibleEs(mala, "En Atención", HOY)).toBe(true) // dejarla como está no es un cambio
    expect(estadoCorregibleEs(mala, "Atendida", HOY)).toBe(false)
  })
})

describe("mover una cita a hoy antes de atenderla", () => {
  it("solo las pendientes o en espera de otro día se mueven; las ya atendidas, en atención o canceladas no", () => {
    expect(necesitaMoverseAHoy({ fecha: "2026-10-14", estado: "Pendiente" }, HOY)).toBe(true)
    expect(necesitaMoverseAHoy({ fecha: "2026-10-14", estado: "En Espera" }, HOY)).toBe(true)
    expect(necesitaMoverseAHoy({ fecha: HOY, estado: "Pendiente" }, HOY)).toBe(false)
    for (const e of ["En Atención", "Atendida", "Cancelada", "No Asistió"]) expect(necesitaMoverseAHoy({ fecha: "2026-10-14", estado: e }, HOY)).toBe(false)
  })
  it("la hora real de ahora; si está ocupada, el primer minuto libre (sin contar las canceladas ni la propia cita)", () => {
    const ahora = new Date(2026, 9, 10, 15, 7)
    const citas = [
      { id: "a", fecha: HOY, hora: "03:07 PM", estado: "Pendiente" },
      { id: "b", fecha: HOY, hora: "03:08 PM", estado: "Cancelada" },
      { id: "c", fecha: "2026-10-11", hora: "03:09 PM", estado: "Pendiente" },
    ]
    expect(horaLibreAhora([], "x", ahora, HOY)).toBe("03:07 PM")
    expect(horaLibreAhora(citas, "x", ahora, HOY)).toBe("03:08 PM") // 03:07 ocupada; la cancelada de 03:08 no cuenta
    expect(horaLibreAhora(citas, "a", ahora, HOY)).toBe("03:07 PM") // la propia cita no se cuenta a sí misma
  })
  it("no se pasa de medianoche: a las 23:59 usa la hora de ahora aunque esté ocupada", () => {
    const ahora = new Date(2026, 9, 10, 23, 59)
    expect(horaLibreAhora([{ id: "a", fecha: HOY, hora: "11:59 PM", estado: "Pendiente" }], "x", ahora, HOY)).toBe("11:59 PM")
    vi.useRealTimers()
  })
})
