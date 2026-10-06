import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { leerContactadosHoy, marcarContactadoHoy, CLAVE_CONTACTOS_HOY } from "./contactosCrm"

describe("contactosCrm", () => {
  beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 6, 12, 0, 0)) })
  afterEach(() => vi.useRealTimers())

  it("sin nada guardado no hay contactados", () => {
    expect(leerContactadosHoy()).toEqual({})
  })
  it("marcar a un paciente lo deja contactado hoy y conserva a los demás", () => {
    marcarContactadoHoy("p1")
    expect(marcarContactadoHoy("p2")).toEqual({ p1: true, p2: true })
    expect(leerContactadosHoy()).toEqual({ p1: true, p2: true })
  })
  it("al día siguiente el límite se reinicia", () => {
    marcarContactadoHoy("p1")
    vi.setSystemTime(new Date(2026, 9, 7, 8, 0, 0))
    expect(leerContactadosHoy()).toEqual({})
  })
  it("sin id no cambia nada", () => {
    expect(marcarContactadoHoy(null)).toEqual({})
    expect(localStorage.getItem(CLAVE_CONTACTOS_HOY)).toBeNull()
  })
})
