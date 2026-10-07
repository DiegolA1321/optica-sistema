import { describe, it, expect } from "vitest"
import { equivalenteEsferico, puntosMedidos, cambio, textoDioptrias, textoCambio } from "./tendenciaGraduacion"

describe("equivalenteEsferico", () => {
  it("suma la esfera y la mitad del cilindro", () => {
    expect(equivalenteEsferico({ esfera: "-2.00", cilindro: "-1.00" })).toBe(-2.5)
  })
  it("acepta coma decimal y un solo dato", () => {
    expect(equivalenteEsferico({ esfera: "1,50" })).toBe(1.5)
    expect(equivalenteEsferico({ cilindro: "-1.00" })).toBe(-0.5)
  })
  it("sin esfera ni cilindro no hay medida", () => {
    expect(equivalenteEsferico({})).toBeNull()
    expect(equivalenteEsferico(undefined)).toBeNull()
    expect(equivalenteEsferico({ esfera: "", cilindro: "" })).toBeNull()
  })
  it("0.00 sí es una medida", () => {
    expect(equivalenteEsferico({ esfera: "0.00", cilindro: "0.00" })).toBe(0)
  })
})

describe("puntosMedidos", () => {
  it("descarta las consultas sin ninguna medida y conserva el orden", () => {
    const cs = [
      { fecha: "2026-01-01", od: { esfera: "-1.00" }, oi: {} },
      { fecha: "2026-02-01", od: {}, oi: {} },
      { fecha: "2026-03-01", od: { esfera: "-1.50" }, oi: { esfera: "-1.00" } },
    ]
    expect(puntosMedidos(cs)).toEqual([
      { fecha: "2026-01-01", od: -1, oi: null },
      { fecha: "2026-03-01", od: -1.5, oi: -1 },
    ])
  })
})

describe("cambio y textos", () => {
  it("el cambio entre dos mediciones", () => {
    expect(cambio(-1, -1.5)).toBe(-0.5)
    expect(cambio(null, 1)).toBeNull()
  })
  it("dioptrías con signo y coma", () => {
    expect(textoDioptrias(1.25)).toBe("+1,25 D")
    expect(textoDioptrias(-0.5)).toBe("−0,50 D")
    expect(textoDioptrias(0)).toBe("0,00 D")
    expect(textoDioptrias(null)).toBe("—")
  })
  it("un cambio pequeño es sin cambios; uno mayor muestra la diferencia", () => {
    expect(textoCambio(0)).toBe("sin cambios")
    expect(textoCambio(0.1)).toBe("sin cambios")
    expect(textoCambio(0.5)).toBe("+0,50 D")
    expect(textoCambio(-0.75)).toBe("−0,75 D")
    expect(textoCambio(null)).toBe("—")
  })
})

import { variacionEntre, verdictoPorVariacion, tendenciaEntreConsultas } from "./tendenciaGraduacion"

describe("tendencia compartida (perfil, lista y ficha)", () => {
  const ojo = (esfera, cilindro = "0") => ({ esfera, cilindro })
  const consulta = (fecha, od, oi = od) => ({ fecha, od, oi })
  it("0,25 D exacto ya es un cambio: aumentó, no 'disminuyó'", () => {
    expect(verdictoPorVariacion(0.25)).toBe("Aumentó")
    expect(verdictoPorVariacion(-0.25)).toBe("Disminuyó")
    expect(verdictoPorVariacion(0.2)).toBe("Sin cambios")
  })
  it("compara |EE| entre las dos consultas más recientes", () => {
    const t = tendenciaEntreConsultas([consulta("2026-09-19", ojo("2.50", "-0.50")), consulta("2026-05-28", ojo("2.00"))])
    expect(t.verdicto).toBe("Aumentó")
    expect(t.variacion).toBeCloseTo(0.25)
  })
  it("miopía que baja de −3,00 a −2,50 disminuyó", () => {
    expect(tendenciaEntreConsultas([consulta("b", ojo("-2.50")), consulta("a", ojo("-3.00"))]).verdicto).toBe("Disminuyó")
  })
  it("sin dos consultas comparables no hay tendencia", () => {
    expect(tendenciaEntreConsultas([consulta("a", ojo("-1"))])).toBeNull()
    expect(variacionEntre({ od: {}, oi: {} }, consulta("a", ojo("-1")))).toBeNull()
  })
})
