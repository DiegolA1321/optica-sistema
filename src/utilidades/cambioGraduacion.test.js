import { describe, it, expect } from "vitest"
import { cambioDeEsfera, cambioEntre, lineaDeCambio } from "./cambioGraduacion"
import { tendenciaEntreConsultas } from "./tendenciaGraduacion"
import { cambioPorOjo, fraseDeCambio } from "./graduacion"

const consulta = (fecha, od, oi) => ({ fecha, od, oi })

describe("el cambio de graduación (una sola función)", () => {
  it("el caso real: la esfera pasó de −1.25 a −1.75 = 0.50 más de miopía (no +0.25, no +0.63)", () => {
    const c = cambioDeEsfera("-1.25", "-1.75")
    expect(c.texto).toBe("0.50 más de miopía")
    expect(c.magnitud).toBe(0.5)
    expect(c.aumento).toBe(0.5)
    expect(c.sentido).toBe("mas")
  })
  it("compara la ESFERA, no el equivalente esférico: el cilindro no mueve la cuenta", () => {
    const c = cambioEntre(consulta("2026-10-19", { esfera: "-1.75", cilindro: "-0.75" }, { esfera: "-1.00", cilindro: "-0.50" }), consulta("2026-04-20", { esfera: "-1.25", cilindro: "-0.50" }, { esfera: "-1.00", cilindro: "-0.75" }))
    expect(c.od.texto).toBe("0.50 más de miopía")
    expect(c.oi.texto).toBe("Sin cambios")
    expect(c.verdicto).toBe("Aumentó")
  })
  it("siempre en pasos de 0.25, con punto decimal", () => {
    for (const [a, b] of [["-1.25", "-1.50"], ["-1.25", "-2.50"], ["+0.50", "+1.75"], ["-0.50", "-0.25"]]) {
      const t = cambioDeEsfera(a, b).texto
      expect(t).toMatch(/^\d\.(00|25|50|75) (más|menos) de (miopía|hipermetropía)$/)
    }
  })
  it("menos de miopía, hipermetropía y plano", () => {
    expect(cambioDeEsfera("-2.00", "-1.50").texto).toBe("0.50 menos de miopía")
    expect(cambioDeEsfera("+1.00", "+1.25").texto).toBe("0.25 más de hipermetropía")
    expect(cambioDeEsfera("+1.00", "0.00").texto).toBe("1.00 menos de hipermetropía")
    expect(cambioDeEsfera("0.00", "-0.50").texto).toBe("0.50 más de miopía")
    expect(cambioDeEsfera("-1.25", "-1.25").texto).toBe("Sin cambios")
  })
  it("un ojo que cruza de lado lo dice tal cual", () => {
    expect(cambioDeEsfera("-0.50", "+0.75").texto).toBe("Pasó de miopía (−0.50) a hipermetropía (+0.75)")
  })
  it("sin esfera en alguno de los dos no se compara", () => {
    expect(cambioDeEsfera("", "-1.00")).toBeNull()
    expect(cambioEntre(consulta("b", {}, {}), consulta("a", {}, {}))).toBeNull()
  })
  it("la línea del cambio es la misma para la ficha, el perfil y el portal", () => {
    const reciente = consulta("2026-10-19", { esfera: "-1.75", cilindro: "-0.75" }, { esfera: "-1.00" })
    const previa = consulta("2026-04-20", { esfera: "-1.25", cilindro: "-0.50" }, { esfera: "-1.00" })
    const c = cambioEntre(reciente, previa)
    expect(lineaDeCambio(c, { siglas: true })).toBe("OD: 0.50 más de miopía · OI: sin cambios")
    expect(lineaDeCambio(c)).toBe("Ojo derecho: 0.50 más de miopía · Ojo izquierdo: sin cambios")
    // perfil: la fila de cada ojo
    expect(cambioPorOjo([reciente, previa]).map((o) => o.texto)).toEqual(["0.50 más de miopía", "Sin cambios"])
    // portal / Inicio
    expect(fraseDeCambio([reciente, previa])).toContain("Ojo derecho: 0.50 más de miopía")
    // tendencia compartida (lista de pacientes, ficha)
    const t = tendenciaEntreConsultas([reciente, previa])
    expect(t.verdicto).toBe("Aumentó")
    expect(t.cambio.od.texto).toBe("0.50 más de miopía")
  })
})
