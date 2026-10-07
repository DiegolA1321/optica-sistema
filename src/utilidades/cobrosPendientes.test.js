import { describe, it, expect } from "vitest"
import { cobrosPendientes } from "./cobrosPendientes"

const consulta = (id, extra = {}) => ({ id, citaId: null, creadoEn: "2026-10-02T10:00:00Z", ...extra })

describe("cobrosPendientes", () => {
  it("consulta de una cita En atención sin comprobante → pendiente", () => {
    const r = cobrosPendientes([consulta("c1", { citaId: "a1" })], [], [{ id: "a1", estado: "En Atención" }])
    expect(r.map((x) => x.consulta.id)).toEqual(["c1"])
    expect(r[0].cita.id).toBe("a1")
  })
  it("con comprobante vinculado ya no es pendiente (salvo anulada)", () => {
    const citas = [{ id: "a1", estado: "En Atención" }]
    expect(cobrosPendientes([consulta("c1", { citaId: "a1" })], [{ consultaId: "c1", estado: "pagada" }], citas)).toHaveLength(0)
    expect(cobrosPendientes([consulta("c1", { citaId: "a1" })], [{ consultaId: "c1", estado: "anulada" }], citas)).toHaveLength(1)
  })
  it("cita Atendida (historial viejo) no cuenta", () => {
    expect(cobrosPendientes([consulta("c1", { citaId: "a1" })], [], [{ id: "a1", estado: "Atendida" }])).toHaveLength(0)
  })
  it("sin cita: solo cuenta si es posterior al inicio del flujo", () => {
    expect(cobrosPendientes([consulta("c1")], [], [])).toHaveLength(1)
    expect(cobrosPendientes([consulta("c2", { creadoEn: "2026-09-10T10:00:00Z" })], [], [])).toHaveLength(0)
  })
})
