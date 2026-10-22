import { describe, it, expect, beforeEach, vi } from "vitest"
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

describe("borrador de la ficha en la base de datos", () => {
  const P = "11111111-1111-1111-1111-111111111111", C = "22222222-2222-2222-2222-222222222222", C2 = "33333333-3333-3333-3333-333333333333"
  beforeEach(() => { localStorage.clear(); vi.resetModules() })

  it("con ids reales usa las funciones de la base: guardar, leer, borrar y heredar", async () => {
    const rpc = vi.fn(async (nombre) => {
      if (nombre === "guardar_borrador_ficha") return { data: "2026-10-21T10:00:00Z", error: null }
      if (nombre === "leer_borrador_ficha") return { data: [{ datos: { motivo: "Control" }, guardado_en: "2026-10-21T10:00:00Z" }], error: null }
      if (nombre === "heredar_borrador_ficha") return { data: true, error: null }
      return { data: null, error: null }
    })
    vi.doMock("../lib/supabaseClient", () => ({ supabase: { rpc } }))
    const m = await import("./borradorFicha")
    const ctx = { usuarioId: "u1", pacienteId: P, citaId: C }
    expect(await m.guardarBorradorFicha(ctx, { motivo: "Control" })).toBe(new Date("2026-10-21T10:00:00Z").getTime())
    expect(rpc).toHaveBeenCalledWith("guardar_borrador_ficha", { p_paciente_id: P, p_cita_id: C, p_datos: { motivo: "Control" } })
    expect(await m.leerBorradorFicha(ctx)).toEqual({ datos: { motivo: "Control" }, guardadoEn: new Date("2026-10-21T10:00:00Z").getTime() })
    await m.borrarBorradorFicha(ctx)
    expect(rpc).toHaveBeenCalledWith("borrar_borrador_ficha", { p_paciente_id: P, p_cita_id: C })
    expect(await m.heredarBorradorFicha({ usuarioId: "u1", pacienteId: P, citaOrigenId: C, citaNuevaId: C2 })).toBe(true)
    expect(rpc).toHaveBeenCalledWith("heredar_borrador_ficha", { p_cita_origen: C, p_cita_nueva: C2 })
    // nada de la ficha queda en el navegador
    expect(Object.keys(localStorage)).toEqual([])
  })

  it("sin base o con ids que no son de la base, queda en el navegador y la cita nueva también lo hereda", async () => {
    vi.doMock("../lib/supabaseClient", () => ({ supabase: null }))
    const m = await import("./borradorFicha")
    const ctx = { usuarioId: "u1", pacienteId: "p1", citaId: "c1" }
    expect(await m.guardarBorradorFicha(ctx, { a: 1 })).toBeTruthy()
    expect((await m.leerBorradorFicha(ctx)).datos).toEqual({ a: 1 })
    expect(await m.heredarBorradorFicha({ usuarioId: "u1", pacienteId: "p1", citaOrigenId: "c1", citaNuevaId: "c9" })).toBe(true)
    expect((await m.leerBorradorFicha({ ...ctx, citaId: "c9" })).datos).toEqual({ a: 1 })
    await m.borrarBorradorFicha(ctx)
    expect(await m.leerBorradorFicha(ctx)).toBeNull()
    expect(await m.heredarBorradorFicha({ usuarioId: "u1", pacienteId: "p1", citaOrigenId: "nadie", citaNuevaId: "c10" })).toBe(false)
  })
})
