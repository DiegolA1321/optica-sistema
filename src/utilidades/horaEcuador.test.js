import { describe, it, expect, vi, afterEach } from "vitest"
import { ahoraEcuador } from "./horaEcuador"
import { hoyISO, esHoy } from "./disponibilidad"

afterEach(() => vi.useRealTimers())

describe("ahoraEcuador", () => {
  it("da la hora de pared de Ecuador (UTC-5) en cualquier zona del equipo", () => {
    const a = ahoraEcuador(new Date("2026-10-10T03:30:00Z")) // 22:30 del 9 de octubre en Ecuador
    expect([a.getFullYear(), a.getMonth(), a.getDate(), a.getHours(), a.getMinutes()]).toEqual([2026, 9, 9, 22, 30])
    const b = ahoraEcuador(new Date("2026-01-01T04:59:00Z")) // todavía 31 de diciembre en Ecuador
    expect([b.getFullYear(), b.getMonth(), b.getDate(), b.getHours()]).toEqual([2025, 11, 31, 23])
  })
  it("hoyISO y esHoy usan el día de Ecuador aunque en UTC ya sea el siguiente", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-10T03:30:00Z")) // viernes 22:30 en Ecuador, sábado en UTC
    expect(hoyISO()).toBe("2026-10-09")
    expect(esHoy("2026-10-09")).toBe(true)
    expect(esHoy("2026-10-10")).toBe(false)
  })
})
