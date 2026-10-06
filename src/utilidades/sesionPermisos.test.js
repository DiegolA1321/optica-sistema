import { describe, it, expect } from "vitest"
import { extrasDePermisos } from "./sesionPermisos"

describe("extrasDePermisos", () => {
  it("el administrador tiene todos los niveles y ve todos los módulos", () => {
    const e = extrasDePermisos({ activo: true, rol: "admin", permisos: {}, alcance: { citas: "todo" }, roles: [] })
    expect(e.permisosNivel.pacientes).toEqual(["ver", "crear", "editar", "eliminar"])
    expect(e.permisos.inventario).toBe(true)
    expect(e.permisos.configuracion).toBe(true)
  })
  it("un asistente ve solo los módulos con algún nivel", () => {
    const e = extrasDePermisos({ activo: true, rol: "asistente", permisos: { citas: ["ver", "crear"], inventario: ["ver"] }, alcance: { citas: "propio" }, roles: [{ id: "r1", nombre: "Optómetra" }] })
    expect(e.permisos.citas).toBe(true)
    expect(e.permisos.pacientes).toBe(false)
    expect(e.roles).toHaveLength(1)
    expect(e.alcance.citas).toBe("propio")
  })
  it("una cuenta desactivada se reconoce", () => {
    expect(extrasDePermisos({ activo: false, rol: "asistente", permisos: {} }).activo).toBe(false)
    expect(extrasDePermisos(null)).toBeNull()
  })
})
