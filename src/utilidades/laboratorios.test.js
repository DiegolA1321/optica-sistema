import { describe, it, expect } from "vitest"
import {
  laboratoriosDe, laboratoriosActivos, laboratoriosParaElegir, laboratoriosParaFiltrar, errorDeNombreLaboratorio, agregarLaboratorio, renombrarLaboratorio, cambiarActivoLaboratorio, gruposDeParecidos, claveDeNombre, MAX_LABORATORIOS,
} from "./laboratorios"

const param = { laboratorios: [{ nombre: "Visión Norte", activo: true }, { nombre: "Óptica Lab", activo: false }, { nombre: "visión  norte" }, { nombre: "  " }] }

describe("el catálogo de laboratorios", () => {
  it("una óptica nueva empieza con el catálogo vacío (cada una agrega los suyos)", () => {
    expect(laboratoriosDe(undefined)).toEqual([])
    expect(laboratoriosDe({})).toEqual([])
    expect(laboratoriosActivos({ laboratorios: "no es una lista" })).toEqual([])
  })
  it("se limpia: sin vacíos ni repetidos (sin importar mayúsculas, tildes ni espacios), con activo por defecto", () => {
    expect(laboratoriosDe(param)).toEqual([{ nombre: "Visión Norte", activo: true }, { nombre: "Óptica Lab", activo: false }])
    expect(laboratoriosActivos(param)).toEqual(["Visión Norte"])
    expect(claveDeNombre("  Visión   NORTE ")).toBe("vision norte")
  })
  it("al elegir se ofrecen los activos y, si el pedido ya tenía otro, también ese", () => {
    expect(laboratoriosParaElegir(param)).toEqual(["Visión Norte"])
    expect(laboratoriosParaElegir(param, "Óptica Lab")).toEqual(["Visión Norte", "Óptica Lab"])
    expect(laboratoriosParaElegir(param, "visión norte")).toEqual(["Visión Norte"])
    expect(laboratoriosParaElegir(undefined, "Antiguo")).toEqual(["Antiguo"])
  })
  it("para filtrar pedidos salen los del catálogo (aun los desactivados) y los que ya usan los pedidos, sin repetir", () => {
    const ordenes = [{ laboratorio: "Laboratorio Viejo" }, { laboratorio: "visión norte" }, { laboratorio: "" }]
    expect(laboratoriosParaFiltrar(param, ordenes)).toEqual(["Visión Norte", "Óptica Lab", "Laboratorio Viejo"])
  })
})

describe("agregar, editar y desactivar", () => {
  const lista = laboratoriosDe(param)
  it("un nombre vacío, largo o repetido no se acepta y dice por qué", () => {
    expect(errorDeNombreLaboratorio(lista, "  ")).toMatch(/Escribe el nombre/)
    expect(errorDeNombreLaboratorio(lista, "x".repeat(61))).toMatch(/60 caracteres/)
    expect(errorDeNombreLaboratorio(lista, "VISION norte")).toBe("Ya existe «Visión Norte».")
    expect(errorDeNombreLaboratorio(lista, "óptica lab")).toBe("Ya existe «Óptica Lab» (desactivado).")
    expect(errorDeNombreLaboratorio(lista, "Nuevo Lab")).toBe("")
    expect(errorDeNombreLaboratorio(Array.from({ length: MAX_LABORATORIOS }, (_, i) => ({ nombre: `L${i}`, activo: true })), "Otro")).toMatch(/hasta 50/)
  })
  it("renombrar conserva su propio nombre como válido (cambiar solo mayúsculas) pero no choca con otro", () => {
    expect(errorDeNombreLaboratorio(lista, "VISIÓN NORTE", "Visión Norte")).toBe("")
    expect(errorDeNombreLaboratorio(lista, "Óptica Lab", "Visión Norte")).toMatch(/Ya existe/)
  })
  it("agrega, renombra y desactiva sin tocar los demás ni cambiar la lista original", () => {
    const nueva = agregarLaboratorio(lista, "  Nuevo Lab ")
    expect(nueva.at(-1)).toEqual({ nombre: "Nuevo Lab", activo: true })
    expect(renombrarLaboratorio(nueva, "Nuevo Lab", "Lab Nuevo").map((l) => l.nombre)).toEqual(["Visión Norte", "Óptica Lab", "Lab Nuevo"])
    expect(cambiarActivoLaboratorio(nueva, "Visión Norte", false)[0].activo).toBe(false)
    expect(cambiarActivoLaboratorio(nueva, "Óptica Lab", true)[1].activo).toBe(true)
    expect(lista).toHaveLength(2)
  })
})

describe("los laboratorios parecidos se proponen para unificar", () => {
  it("«Laboratorio Visión Norte» y «Laboratorio Visión» son el mismo; el más usado va primero", () => {
    const cuenta = new Map([["Laboratorio Visión", 2], ["Laboratorio Visión Norte", 7], ["Óptica Lab", 4]])
    expect(gruposDeParecidos(["Laboratorio Visión", "Laboratorio Visión Norte", "Óptica Lab"], cuenta)).toEqual([["Laboratorio Visión Norte", "Laboratorio Visión"]])
  })
  it("un nombre con y sin la palabra «laboratorio» o con otras tildes también", () => {
    expect(gruposDeParecidos(["Visión Norte", "Laboratorio Vision Norte", "lab Sur"])).toEqual([["Visión Norte", "Laboratorio Vision Norte"]])
  })
  it("laboratorios distintos no se mezclan", () => {
    expect(gruposDeParecidos(["Lab Norte", "Lab Sur", "Óptica Lab"])).toEqual([])
  })
})
