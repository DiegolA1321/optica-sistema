import { describe, it, expect } from "vitest"
import { construirVistas, elegirVista, VISTA_ADMIN_ID } from "./vistas"

const optometra = { id: "r1", nombre: "Optómetra", inicio: "optometra", atiende_pacientes: true, permisos: { citas: ["ver"] }, alcance: { citas: "propio" } }
const ventas = { id: "r2", nombre: "Ventas", inicio: "ventas", atiende_pacientes: false, permisos: { ventas: ["ver"] }, alcance: {} }

describe("vistas", () => {
  it("un administrador que también atiende tiene dos vistas, empezando por Administrador", () => {
    const v = construirVistas({ rol: "admin", roles: [{ id: "r1" }] }, [optometra, ventas])
    expect(v.map((x) => x.nombre)).toEqual(["Administrador", "Optómetra"])
    expect(v[0].permisos.pacientes).toContain("eliminar")
    expect(v[1].alcance.citas).toBe("propio")
  })
  it("un asistente con dos roles tiene una vista por rol", () => {
    const v = construirVistas({ rol: "asistente", roles: [{ id: "r1" }, { id: "r2" }] }, [optometra, ventas])
    expect(v.map((x) => x.id)).toEqual(["r1", "r2"])
  })
  it("sin roles y sin ser administrador no hay vistas", () => {
    expect(construirVistas({ rol: "asistente", roles: [] }, [optometra])).toEqual([])
  })
  it("elige la guardada si existe; si no, la primera", () => {
    const v = construirVistas({ rol: "admin", roles: [{ id: "r1" }] }, [optometra])
    expect(elegirVista(v, "r1").nombre).toBe("Optómetra")
    expect(elegirVista(v, "otra").id).toBe(VISTA_ADMIN_ID)
    expect(elegirVista([], "x")).toBeNull()
  })
})
