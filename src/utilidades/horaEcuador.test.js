import { describe, it, expect, vi, afterEach } from "vitest"
import { ahoraEcuador, aEcuador } from "./horaEcuador"
import { esDeEsteMes } from "./inicio"
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

describe("el mes de un registro se mide con la hora de Ecuador", () => {
  const finDeOctubre = ahoraEcuador(new Date("2026-10-31T21:00:00-05:00")) // 02:00 UTC del 1 de noviembre
  it("una venta del 31 de octubre a las 21:00 de Ecuador es de octubre, aunque en UTC ya sea noviembre", () => {
    expect(esDeEsteMes("2026-11-01T02:00:00Z", finDeOctubre)).toBe(true)
  })
  it("una venta de las 00:30 de Ecuador del 1 de noviembre (05:30 UTC) es de noviembre, no de octubre", () => {
    expect(esDeEsteMes("2026-11-01T05:30:00Z", finDeOctubre)).toBe(false)
  })
  it("una fecha sola (columna DATE) es ese día calendario, sin moverse por la zona", () => {
    expect(esDeEsteMes("2026-10-01", finDeOctubre)).toBe(true)
    expect(esDeEsteMes("2026-11-01", finDeOctubre)).toBe(false)
    expect(aEcuador("2026-10-01").getDate()).toBe(1)
  })
})
