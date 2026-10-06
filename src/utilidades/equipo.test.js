import { describe, it, expect } from "vitest"
import { miembrosActivos, opcionesAsignables, etiquetaMiembro } from "./equipo"

const equipo = [
  { id: "a", nombre: "Ana", activo: true },
  { id: "b", nombre: "Beto", activo: false },
  { id: "c", nombre: "Carla" },
]

describe("equipo con cuentas desactivadas", () => {
  it("solo los activos se ofrecen (una cuenta sin dato de estado cuenta como activa)", () => {
    expect(miembrosActivos(equipo).map((m) => m.id)).toEqual(["a", "c"])
  })
  it("el selector Asignado a no ofrece desactivados, pero conserva al ya asignado", () => {
    expect(opcionesAsignables(equipo, "").map((m) => m.id)).toEqual(["a", "c"])
    expect(opcionesAsignables(equipo, "b").map((m) => m.id)).toEqual(["a", "c", "b"])
    expect(opcionesAsignables(equipo, "a").map((m) => m.id)).toEqual(["a", "c"])
  })
  it("el nombre de un desactivado se sigue mostrando en las citas viejas", () => {
    expect(etiquetaMiembro(equipo, "b")).toBe("Beto")
  })
})
