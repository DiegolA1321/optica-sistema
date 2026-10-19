import { describe, it, expect, beforeEach } from "vitest"
import { claveBorrador, guardarBorrador, leerBorrador, borrarBorrador, borrarTodosLosBorradores, textoGuardado } from "./borradorFicha"

describe("borrador de la ficha clínica", () => {
  beforeEach(() => localStorage.clear())
  it("la clave distingue usuario, paciente y cita", () => {
    expect(claveBorrador("u1", "p1", "c1")).not.toBe(claveBorrador("u1", "p1", "c2"))
    expect(claveBorrador("u1", "p1", null)).toContain("directa")
    expect(claveBorrador("u1", null, "c1")).toBeNull()
    expect(claveBorrador(null, "p1", "c1")).toBeNull()
  })
  it("guarda y recupera lo escrito", () => {
    const k = claveBorrador("u1", "p1", "c1")
    expect(guardarBorrador(k, { motivo: "Control", odEsfera: "-1.75" }, 1000)).toBe(true)
    expect(leerBorrador(k, 2000)).toEqual({ datos: { motivo: "Control", odEsfera: "-1.75" }, guardadoEn: 1000 })
  })
  it("a las 24 horas el borrador vence y se borra", () => {
    const k = claveBorrador("u1", "p1", "c1")
    guardarBorrador(k, { a: 1 }, 0)
    expect(leerBorrador(k, 25 * 3600 * 1000)).toBeNull()
    expect(localStorage.getItem(k)).toBeNull()
  })
  it("un borrador ilegible no rompe nada", () => {
    const k = claveBorrador("u1", "p1", "c1")
    localStorage.setItem(k, "{no es json")
    expect(leerBorrador(k)).toBeNull()
  })
  it("se borra uno o todos (al cerrar sesión)", () => {
    const a = claveBorrador("u1", "p1", "c1"), b = claveBorrador("u1", "p2", "c2")
    guardarBorrador(a, { a: 1 }); guardarBorrador(b, { b: 1 }); localStorage.setItem("otra-cosa", "x")
    borrarBorrador(a)
    expect(leerBorrador(a)).toBeNull(); expect(leerBorrador(b)).not.toBeNull()
    borrarTodosLosBorradores()
    expect(leerBorrador(b)).toBeNull(); expect(localStorage.getItem("otra-cosa")).toBe("x")
  })
  it("dice cuánto hace que se guardó", () => {
    expect(textoGuardado(null)).toMatch(/se guarda solo/)
    expect(textoGuardado(1000, 2000)).toBe("Guardado ahora")
    expect(textoGuardado(0, 12_000)).toBe("Guardado hace 12 s")
    expect(textoGuardado(0, 125_000)).toBe("Guardado hace 2 min")
    expect(textoGuardado(0, 3 * 3600_000)).toBe("Guardado hace 3 h")
  })
})
