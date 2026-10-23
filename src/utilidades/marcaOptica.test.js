import { describe, it, expect } from "vitest"
import { contraste, colorLegible, paginaPublica, anosAtendiendo, pacientesRedondeado, PALETA_MARCA, SERVICIOS_EJEMPLO, esColorValido } from "./marcaOptica"

describe("marcaOptica", () => {
  it("toda la paleta se lee con texto blanco", () => {
    for (const { color } of PALETA_MARCA) expect(colorLegible(color).ajustado).toBe(false)
  })
  it("un color claro se oscurece hasta leerse y avisa que lo ajustó", () => {
    const r = colorLegible("#FFE066")
    expect(r.ajustado).toBe(true)
    expect(contraste(r.color, "#FFFFFF")).toBeGreaterThanOrEqual(4.5)
  })
  it("un color inválido cae al azul por defecto", () => {
    expect(esColorValido("azul")).toBe(false)
    expect(colorLegible("azul").color).toBe("#2563EB")
  })
  it("sin configuración recibe los ejemplos", () => {
    const p = paginaPublica(null, "Óptica Demo")
    expect(p.servicios).toEqual(SERVICIOS_EJEMPLO)
    expect(p.preguntas.length).toBe(4)
    expect(p.imagenPrincipal).toBe("")
    expect(p.quienesSomos.mostrarAnos).toBe(true)
  })
  it("respeta lo que escribió la óptica y quita filas vacías", () => {
    const p = paginaPublica({ serviciosPagina: [{ id: "a", titulo: "Lentes de contacto", texto: "x" }, { id: "b", titulo: "", texto: "" }], quienesSomos: { mostrarPacientes: false, anoFundacion: 2014 } })
    expect(p.servicios.map((s) => s.titulo)).toEqual(["Lentes de contacto"])
    expect(p.quienesSomos.mostrarPacientes).toBe(false)
    expect(p.quienesSomos.anoFundacion).toBe(2014)
  })
  it("razones: tres de ejemplo; opiniones: ninguna por defecto, y solo las que tienen texto", () => {
    const vacia = paginaPublica(null)
    expect(vacia.razones.length).toBe(3)
    expect(vacia.opiniones).toEqual([])
    const p = paginaPublica({ razones: [{ id: "a", titulo: "Rapidez", texto: "Sales con tus lentes el mismo día" }], opiniones: [{ id: "o1", texto: "Muy buena atención", nombre: "María G." }, { id: "o2", texto: "", nombre: "Sin texto" }] })
    expect(p.razones.map((r) => r.titulo)).toEqual(["Rapidez"])
    expect(p.opiniones.map((o) => o.nombre)).toEqual(["María G."])
  })
  it("años de atención desde el año de fundación", () => {
    expect(anosAtendiendo(2014, new Date(2026, 9, 23))).toBe(12)
    expect(anosAtendiendo(2026, new Date(2026, 9, 23))).toBe(null)
    expect(anosAtendiendo(null)).toBe(null)
  })
  it("pacientes redondeados hacia abajo", () => {
    expect(pacientesRedondeado(0)).toBe(null)
    expect(pacientesRedondeado(7)).toBe("7")
    expect(pacientesRedondeado(287)).toBe("250+")
    expect(pacientesRedondeado(3050)).toMatch(/^3[.,]?000\+$/)
  })
})
