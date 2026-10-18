import { describe, it, expect } from "vitest"
import { clasificarEsfera, clasificarCilindro, clasificarAgudeza, clasificarAdicion, explicarEsfera, explicarCilindro, explicarCerca, explicarAgudeza } from "./graduacion"

// Una prueba por cada rango de docs/explicaciones-graduacion.md: los límites de cada rango (el último valor que entra y el primero que sale) y la frase que el paciente lee.
const texto = (partes) => partes.map((p) => p.t).join("")

describe("esfera: rangos", () => {
  it.each([
    ["0", "neutra", null], ["+0.25", "neutra", null], ["-0.25", "neutra", null],
    ["-0.50", "miopia", "leve"], ["-3.00", "miopia", "leve"], ["-3.25", "miopia", "moderada"], ["-6.00", "miopia", "moderada"], ["-6.25", "miopia", "alta"], ["-10.00", "miopia", "alta"],
    ["+0.50", "hipermetropia", "leve"], ["+2.00", "hipermetropia", "leve"], ["+2.25", "hipermetropia", "moderada"], ["+5.00", "hipermetropia", "moderada"], ["+5.25", "hipermetropia", "alta"],
  ])("%s → %s %s", (v, tipo, nivel) => expect(clasificarEsfera(v)).toEqual({ tipo, nivel }))
  it("sin dato no clasifica", () => { expect(clasificarEsfera("")).toBeNull(); expect(clasificarEsfera(undefined)).toBeNull() })
  it.each([
    ["-3.00", "Tienes miopía leve: ves bien de cerca y un poco borroso de lejos."],
    ["-4.00", "Tienes miopía moderada: de cerca ves bien y de lejos ves borroso sin tus lentes."],
    ["-7.00", "Tienes miopía alta: de cerca ves bien y de lejos ves muy borroso sin tus lentes."],
    ["+1.50", "Tienes hipermetropía leve: ves bien de lejos, pero de cerca la vista se puede cansar."],
    ["+3.00", "Tienes hipermetropía moderada: te cuesta enfocar de cerca y la vista se cansa con facilidad."],
    ["+6.00", "Tienes hipermetropía alta: te cuesta ver bien de cerca y también de lejos sin tus lentes."],
    ["0.25", "Tu esfera es casi neutra: de lejos ves bien sin corrección en este ojo."],
  ])("%s se explica: %s", (v, frase) => expect(texto(explicarEsfera({ esfera: v }))).toBe(frase))
})

describe("cilindro: rangos", () => {
  it.each([["0", null], ["-0.00", null], ["-0.24", null], ["-0.25", "leve"], ["-1.00", "leve"], ["-1.25", "moderado"], ["-2.00", "moderado"], ["-2.25", "alto"], ["-4.00", "alto"]])("%s → %s", (v, n) => expect(clasificarCilindro(v)).toBe(n))
  it("las frases", () => {
    expect(explicarCilindro({ cilindro: "0" })).toBe("No tienes astigmatismo en este ojo.")
    expect(explicarCilindro({ cilindro: "-0.50" })).toBe("Leve: algunas líneas se ven un poco estiradas.")
    expect(explicarCilindro({ cilindro: "-1.50" })).toBe("Moderado: las líneas se ven estiradas o dobles sin tus lentes.")
    expect(explicarCilindro({ cilindro: "-3.00" })).toBe("Alto: sin tus lentes las líneas se ven muy estiradas o dobles.")
  })
})

describe("adición: rangos", () => {
  it.each([["", null], ["0", null], ["+0.75", "baja"], ["+1.25", "baja"], ["+1.50", "media"], ["+2.00", "media"], ["+2.25", "alta"], ["+3.00", "alta"]])("%s → %s", (v, n) => expect(clasificarAdicion(v)).toBe(n))
  it("las frases", () => {
    expect(explicarCerca("")).toBe("")
    expect(explicarCerca("+1.00", "Progresivo")).toBe("Es una ayuda pequeña que tus lentes progresivos dan en la parte de abajo para ver de cerca.")
    expect(explicarCerca("+1.75", "Bifocal")).toBe("Es una ayuda media que tus lentes bifocales dan en la parte de abajo para ver de cerca.")
    expect(explicarCerca("+2.50")).toBe("Es una ayuda grande para leer y ver de cerca.")
  })
})

describe("agudeza visual: rangos", () => {
  // 20/20 es la visión completa: 20/25 NO lo es, es casi completa.
  it.each([
    ["20/10", "completa"], ["20/15", "completa"], ["20/20", "completa"],
    ["20/25", "casi completa"], ["20/30", "casi completa"],
    ["20/35", "buena"], ["20/40", "buena"],
    ["20/50", "disminuida"], ["20/70", "disminuida"],
    ["20/80", "reducida"], ["20/200", "reducida"],
    ["", null], ["sin dato", null], ["20/0", null],
  ])("%s → %s", (v, c) => expect(clasificarAgudeza(v)).toBe(c))
  it("20/25 ya no dice «nitidez completa»", () => {
    expect(explicarAgudeza("20/20")).toBe("Ves con nitidez completa, como debe ser.")
    expect(explicarAgudeza("20/25")).toBe("Ves casi con toda la nitidez: te falta muy poco.")
    expect(explicarAgudeza("20/25")).not.toMatch(/completa/)
    expect(explicarAgudeza("20/40")).toBe("Ves bien, aunque todavía no con toda la nitidez.")
    expect(explicarAgudeza("20/60")).toBe("Ves con menos nitidez de la normal: coméntalo con tu optómetra.")
    expect(explicarAgudeza("20/100")).toBe("Ves con poca nitidez: coméntalo con tu optómetra.")
    expect(explicarAgudeza("")).toBe("")
  })
})
