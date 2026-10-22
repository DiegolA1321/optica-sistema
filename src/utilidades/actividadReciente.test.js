import { describe, it, expect } from "vitest"
import { actividadReciente } from "./actividadReciente"

const HOY = "2026-10-22"
describe("actividadReciente", () => {
  const citas = [
    { id: "c1", fecha: "2026-10-21", estado: "No Asistió", motivo: "Examen de control" },
    { id: "c2", fecha: "2026-10-07", estado: "Atendida", motivo: "Consulta general" },
    { id: "c3", fecha: "2026-11-30", estado: "Pendiente", motivo: "Control" },
    { id: "c4", fecha: "2026-04-20", estado: "Atendida", motivo: "Examen de control" },
  ]
  const consultas = [{ id: "k2", citaId: "c2", fecha: "2026-10-07", diagnostico: "Astigmatismo" }, { id: "k4", citaId: "c4", fecha: "2026-04-20", diagnostico: "Miopía" }]
  it("junta citas ya ocurridas, compras y mensajes, de lo más reciente a lo más antiguo", () => {
    const r = actividadReciente({ citas, consultas, compras: [{ id: "f1", fecha: "2026-10-07", texto: "Compra CV-0021 · $265.00" }], mensajes: [{ id: "m1", canal: "whatsapp", motivo: "control_vencido", creado_en: "2026-10-18T15:00:00Z" }], hoy: HOY })
    expect(r.map((e) => e.fecha)).toEqual(["2026-10-21", "2026-10-18", "2026-10-07", "2026-10-07", "2026-04-20"])
    expect(r[0]).toMatchObject({ tono: "rojo", texto: "Cita no efectuada · Examen de control" })
    expect(r[1].texto).toBe("Mensaje por WhatsApp · control vencido")
    expect(r.some((e) => e.texto.startsWith("Consulta atendida · Astigmatismo"))).toBe(true)
  })
  it("no incluye citas futuras, ni cuenta dos veces una consulta ligada a su cita", () => {
    const r = actividadReciente({ citas, consultas, hoy: HOY })
    expect(r.find((e) => e.fecha === "2026-11-30")).toBeUndefined()
    expect(r.filter((e) => e.texto.includes("Astigmatismo"))).toHaveLength(1)
  })
  it("una atención sin cita también aparece y solo se muestran 5", () => {
    const muchas = Array.from({ length: 7 }, (_, i) => ({ id: "x" + i, fecha: `2026-09-0${i + 1}`, estado: "Cancelada", motivo: "m" }))
    expect(actividadReciente({ citas: muchas, hoy: HOY })).toHaveLength(5)
    expect(actividadReciente({ consultas: [{ id: "k9", fecha: "2026-10-01", diagnostico: "Miopía" }], hoy: HOY })[0].texto).toBe("Consulta atendida · Miopía")
  })
})
