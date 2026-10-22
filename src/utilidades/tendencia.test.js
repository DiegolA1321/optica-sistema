import { describe, it, expect } from "vitest"
import { promedioMovil, rectaDeTendencia, periodosConHistoria, cambioFrenteAlAnterior, analizarTendencia } from "./tendencia"

const serie = (valores) => valores.map((valor, i) => ({ etiqueta: `m${i + 1}`, valor }))

describe("tendencia", () => {
  it("promedia cada período con los dos anteriores", () => {
    expect(promedioMovil([3, 6, 9, 12])).toEqual([3, 4.5, 6, 9])
  })
  it("la recta de una serie que sube de a 2 tiene pendiente 2", () => {
    const r = rectaDeTendencia([10, 12, 14, 16])
    expect(r.pendiente).toBeCloseTo(2)
    expect(r.intercepto).toBeCloseTo(10)
  })
  it("cuenta los períodos desde el primero con datos", () => {
    expect(periodosConHistoria([0, 0, 4, 0, 5])).toBe(3)
    expect(periodosConHistoria([0, 0, 0])).toBe(0)
  })
  it("el cambio frente al anterior es porcentual, y nulo si el anterior fue 0", () => {
    expect(cambioFrenteAlAnterior([34, 38])).toBe(12)
    expect(cambioFrenteAlAnterior([0, 5])).toBeNull()
    expect(cambioFrenteAlAnterior([0, 0])).toBe(0)
  })
  it("con 3 o más períodos dibuja la tendencia y dice si va en aumento", () => {
    const a = analizarTendencia(serie([20, 24, 28, 32, 38]), { plural: "consultas" })
    expect(a.hayTendencia).toBe(true)
    expect(a.direccion).toBe("sube")
    expect(a.pendiente).toBeGreaterThan(1)
    expect(a.frase).toMatch(/van en aumento/)
    expect(a.frase).toMatch(/El mejor mes fue m5/)
  })
  it("con menos de 3 períodos no hay tendencia y la frase dice por qué", () => {
    const a = analizarTendencia(serie([0, 0, 0, 0, 3, 5]), { plural: "consultas" })
    expect(a.hayTendencia).toBe(false)
    expect(a.tendencia.every((v) => v === null)).toBe(true)
    expect(a.frase).toMatch(/la tendencia se dibuja desde 3 meses/)
  })
  it("una serie sin datos lo dice", () => {
    expect(analizarTendencia(serie([0, 0, 0]), { plural: "ventas" }).frase).toMatch(/Todavía no hay ventas/)
  })
  it("una serie plana se llama estable y a la baja se llama a la baja", () => {
    expect(analizarTendencia(serie([10, 10, 10, 10]), {}).direccion).toBe("estable")
    expect(analizarTendencia(serie([40, 30, 20, 10]), {}).frase).toMatch(/a la baja/)
  })
})
