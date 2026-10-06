import { describe, it, expect } from "vitest"
import { puede } from "./permisosUi"

describe("puede", () => {
  it("el administrador siempre puede", () => {
    expect(puede({ rol: "admin" }, "inventario", "eliminar")).toBe(true)
    expect(puede({ rol: "superadmin" }, "pacientes", "eliminar")).toBe(true)
  })
  it("un asistente puede solo lo que sus roles dan", () => {
    const u = { rol: "asistente", permisosNivel: { inventario: ["ver"], pacientes: ["ver", "crear"] } }
    expect(puede(u, "inventario", "ver")).toBe(true)
    expect(puede(u, "inventario", "crear")).toBe(false)
    expect(puede(u, "pacientes", "crear")).toBe(true)
    expect(puede(u, "pacientes", "eliminar")).toBe(false)
    expect(puede(u, "citas")).toBe(false)
  })
  it("sin permisos cargados no se esconden botones", () => {
    expect(puede({ rol: "asistente" }, "pacientes", "crear")).toBe(true)
    expect(puede(null, "pacientes")).toBe(false)
  })
})
