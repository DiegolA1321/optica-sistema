import { describe, it, expect } from "vitest"
import { atencionesSinCita } from "./atencionesSinCita"

const k = (id, extra = {}) => ({ id, fecha: "2026-10-10", motivo: "Control", citaId: null, ...extra })

describe("atencionesSinCita", () => {
  it("una ficha cuya cita está en la lista no se repite", () => {
    expect(atencionesSinCita([k("k1", { citaId: "c1" })], [{ id: "c1" }])).toEqual([])
  })
  it("una atención sin cita se dice «Sin cita» y atendida", () => {
    expect(atencionesSinCita([k("k1")], [])).toEqual([{ id: "consulta-k1", fecha: "2026-10-10", hora: "Sin cita", motivo: "Control", estado: "Atendida", _consulta: k("k1") }])
  })
  it("la ficha de una cita que no es de la persona lleva la fecha, la hora y el estado de esa cita, no «Sin cita»", () => {
    const ficha = k("k2", { citaId: "c9", citaResumen: { fecha: "2026-10-09", hora: "04:00 PM", estado: "No Asistió" } })
    expect(atencionesSinCita([ficha], [{ id: "c1" }])).toEqual([{ id: "consulta-k2", fecha: "2026-10-09", hora: "04:00 PM", motivo: "Control", estado: "No Asistió", _consulta: ficha }])
  })
})
