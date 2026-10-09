import { describe, it, expect } from "vitest"
import { citasPorReasignar, ausenteEnHorario, ausenciaCubreCita, puedeReasignar } from "./reasignacion"

const cita = (o) => ({ id: "c1", fecha: "2026-10-09", hora: "10:00 AM", estado: "Pendiente", asignadoA: "paula", ...o })
const disp = (ausencias, fecha = "2026-10-09") => ({ excepciones: { [fecha]: { ausencias } } })
const ausencia = (o) => ({ inicio: "09:00", fin: "12:00", usuarioId: "paula", usuarioNombre: "Paula", ...o })

describe("ausencias y citas por reasignar", () => {
  it("la ausencia cubre la hora de inicio de la cita, con el fin excluido", () => {
    expect(ausenciaCubreCita(ausencia(), cita({}))).toBe(true)
    expect(ausenciaCubreCita(ausencia(), cita({ hora: "12:00 PM" }))).toBe(false)
    expect(ausenciaCubreCita(ausencia(), cita({ hora: "08:40 AM" }))).toBe(false)
  })
  it("agrupa por persona y fecha las citas abiertas dentro de la ausencia", () => {
    const citas = [cita({ id: "a", hora: "11:00 AM" }), cita({ id: "b" }), cita({ id: "x", asignadoA: "rosa" }), cita({ id: "y", estado: "Atendida" }), cita({ id: "z", hora: "03:00 PM" })]
    const g = citasPorReasignar(citas, disp([ausencia()]), "2026-10-08")
    expect(g).toHaveLength(1)
    expect(g[0]).toMatchObject({ personaId: "paula", personaNombre: "Paula", fecha: "2026-10-09" })
    expect(g[0].citas.map((c) => c.id)).toEqual(["b", "a"])
  })
  it("ignora ausencias sin autor, pasadas o sin citas", () => {
    expect(citasPorReasignar([cita({})], disp([ausencia({ usuarioId: undefined })]), "2026-10-08")).toEqual([])
    expect(citasPorReasignar([cita({})], disp([ausencia()]), "2026-10-10")).toEqual([])
    expect(citasPorReasignar([], disp([ausencia()]), "2026-10-08")).toEqual([])
  })
  it("marca como ausente a quien registró la ausencia en esa hora", () => {
    expect(ausenteEnHorario(disp([ausencia()]), "paula", "2026-10-09", "10:00 AM")).toBe(true)
    expect(ausenteEnHorario(disp([ausencia()]), "rosa", "2026-10-09", "10:00 AM")).toBe(false)
    expect(ausenteEnHorario(disp([ausencia()]), "paula", "2026-10-09", "02:00 PM")).toBe(false)
  })
  it("reasignar depende del permiso y del alcance, no del rol", () => {
    const conPermiso = { rol: "admin" }
    expect(puedeReasignar(conPermiso, "todo")).toBe(true)
    expect(puedeReasignar(conPermiso, "propio")).toBe(false)
  })
})
