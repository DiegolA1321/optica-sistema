import { describe, it, expect } from "vitest"
import { clasificarEsfera, clasificarCilindro, clasificarAgudeza, explicarEsfera, lecturaDeOjo, cambioPorOjo, fraseDeCambio, textoMagnitud, aniosDeRecetas, filtrarRecetasPorAnio, compararRecetas } from "./graduacion"

const texto = (partes) => partes.map((p) => p.t).join("")

describe("clasificación por rangos", () => {
  it("esfera: neutra, miopía e hipermetropía por nivel", () => {
    expect(clasificarEsfera("0.25")).toEqual({ tipo: "neutra", nivel: null })
    expect(clasificarEsfera("-1.75")).toEqual({ tipo: "miopia", nivel: "leve" })
    expect(clasificarEsfera("-3.00")).toEqual({ tipo: "miopia", nivel: "leve" })
    expect(clasificarEsfera("-3.25")).toEqual({ tipo: "miopia", nivel: "moderada" })
    expect(clasificarEsfera("-6.50")).toEqual({ tipo: "miopia", nivel: "alta" })
    expect(clasificarEsfera("+1.00")).toEqual({ tipo: "hipermetropia", nivel: "leve" })
    expect(clasificarEsfera("+4.00")).toEqual({ tipo: "hipermetropia", nivel: "moderada" })
    expect(clasificarEsfera("+5.50")).toEqual({ tipo: "hipermetropia", nivel: "alta" })
    expect(clasificarEsfera("")).toBeNull()
  })
  it("cilindro y agudeza", () => {
    expect(clasificarCilindro("-0.50")).toBe("leve")
    expect(clasificarCilindro("-0.00")).toBeNull()
    expect(clasificarCilindro("-1.50")).toBe("moderado")
    expect(clasificarCilindro("-2.75")).toBe("alto")
    expect(clasificarAgudeza("20/20")).toBe("completa")
    expect(clasificarAgudeza("20/25")).toBe("completa")
    expect(clasificarAgudeza("20/40")).toBe("muy buena")
    expect(clasificarAgudeza("20/100")).toBe("reducida")
    expect(clasificarAgudeza("")).toBeNull()
  })
})

describe("explicación de cada ojo", () => {
  it("dice la miopía leve con las palabras del diseño", () => {
    expect(texto(explicarEsfera({ esfera: "-1.75" }))).toBe("Tienes miopía leve: ves bien de cerca y un poco borroso de lejos.")
  })
  it("el ojo izquierdo se compara con el derecho cuando son del mismo tipo", () => {
    expect(texto(explicarEsfera({ esfera: "-1.25" }, { esfera: "-1.75" }, true))).toBe("Tienes miopía leve, un poco menor que en el ojo derecho.")
    expect(texto(explicarEsfera({ esfera: "-1.75" }, { esfera: "-1.75" }, true))).toBe("Tienes miopía leve, igual que en el ojo derecho.")
  })
  it("lecturaDeOjo trae astigmatismo, cerca y agudeza", () => {
    const receta = { od: { esfera: "-1.75", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avCc: "20/25" }, medidas: { adicion: "+1.00" }, lenteRecomendado: "Progresivo con filtro azul" }
    const od = lecturaDeOjo(receta, "od")
    expect(od.explicaCilindro).toContain("Leve: algunas líneas")
    expect(od.explicaCilindro).toContain("Tus lentes lo corrigen.")
    expect(od.explicaCerca).toContain("progresivos")
    expect(od.explicaAgudeza).toBe("Ves con nitidez completa, como debe ser.")
    expect(lecturaDeOjo(receta, "oi").explicaCilindro).toBe("Leve, parecido al del ojo derecho.")
  })
})

describe("antes → ahora", () => {
  const lista = [
    { fecha: "2026-04-20", od: { esfera: "-1.75" }, oi: { esfera: "-1.25" } },
    { fecha: "2025-11-21", od: { esfera: "-1.50" }, oi: { esfera: "-1.00" } },
  ]
  it("por ojo, con la magnitud en palabras", () => {
    const [od, oi] = cambioPorOjo(lista)
    expect(od.texto).toBe("Un cuarto de dioptría más de corrección")
    expect(od.antes.valor).toBe("-1.50")
    expect(od.antes.fecha).toBe("Nov 2025")
    expect(oi.ahora.fecha).toBe("Abr 2026")
    expect(cambioPorOjo([lista[0]])).toBeNull()
  })
  it("la frase del Inicio usa la misma tendencia", () => {
    expect(fraseDeCambio(lista)).toBe("Tu miopía aumentó un poco desde noviembre: un cuarto de dioptría más.")
    expect(fraseDeCambio([lista[0]])).toBe("")
  })
  it("magnitudes", () => {
    expect(textoMagnitud(0.5)).toBe("media dioptría")
    expect(textoMagnitud(-1)).toBe("una dioptría")
    expect(textoMagnitud(1.5)).toBe("1.5 dioptrías")
  })
})

describe("lista y comparación de recetas", () => {
  const a = { id: 1, fecha: "2026-04-20", od: { esfera: "-1.75", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.25", avCc: "20/25" }, medidas: { adicion: "+1.00" } }
  const b = { id: 2, fecha: "2025-11-21", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.00", avCc: "20/25" }, medidas: {} }
  it("años y filtro", () => {
    expect(aniosDeRecetas([a, b])).toEqual(["2026", "2025"])
    expect(filtrarRecetasPorAnio([a, b], "2025")).toEqual([b])
    expect(filtrarRecetasPorAnio([a, b], "todas")).toHaveLength(2)
  })
  it("compara sin importar el orden y señala lo que cambió", () => {
    const c = compararRecetas(a, b)
    expect(c.antes).toBe(b)
    expect(c.ahora).toBe(a)
    const esfOd = c.filas.find((f) => f.clave === "od-esfera")
    expect(esfOd).toMatchObject({ difiere: true, delta: -0.25 })
    expect(c.filas.find((f) => f.clave === "od-cilindro").difiere).toBe(false)
    expect(c.filas.find((f) => f.clave === "od-eje").difiere).toBe(false)
    expect(c.cambios).toBeGreaterThan(0)
  })
})
