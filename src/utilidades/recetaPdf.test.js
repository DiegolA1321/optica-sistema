import { describe, it, expect } from "vitest"
import { armarPdfReceta, partirEnRenglones, nombreArchivoReceta } from "./recetaPdf"
import { textoGraduacionOjo } from "./recetaTexto"

const texto = (bytes) => String.fromCharCode(...bytes)
const receta = {
  fecha: "2026-10-01", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" }, lenteRecomendado: "Progresivo con filtro azul", diagnostico: "Miopía y astigmatismo", indicaciones: "Uso permanente. Control en seis meses.",
  profesionalNombre: "Dra. Pérez", profesionalRegistro: "REG-1",
}

describe("PDF de la receta", () => {
  const pdf = armarPdfReceta({ optica: "Óptica Solna", paciente: { nombre: "Ana Núñez", cedula: "0900000000" }, receta, mostrarMedidas: false })
  const t = texto(pdf)
  it("es un PDF completo de una página con su tabla de posiciones", () => {
    expect(t.startsWith("%PDF-1.4")).toBe(true)
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true)
    expect(t).toContain("/Count 1")
    const inicio = Number(t.match(/startxref\n(\d+)/)[1])
    expect(t.slice(inicio, inicio + 4)).toBe("xref")
    const posiciones = [...t.matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]))
    expect(posiciones).toHaveLength(6)
    posiciones.forEach((p, i) => expect(t.slice(p, p + 7)).toBe(`${i + 1} 0 obj`))
    const largo = Number(t.match(/\/Length (\d+)/)[1])
    const flujo = t.slice(t.indexOf("stream\n") + 7, t.indexOf("\nendstream"))
    expect(flujo.length).toBe(largo)
  })
  it("dice Ojo derecho y Ojo izquierdo (nunca OD ni OI) con la graduación y la agudeza", () => {
    expect(t).toContain("(Ojo derecho)")
    expect(t).toContain("(Ojo izquierdo)")
    expect(t).not.toMatch(/\((OD|OI)\)/)
    expect(t).toContain("(-1.50 -0.50 x90)")
    expect(t).toContain("(20/20)")
  })
  it("las tildes y la ñ salen con su código (WinAnsi)", () => {
    expect(t).toContain("Ana N\xFA\xF1ez")
    expect(t).toContain("Receta \xF3ptica")
  })
  it("la distancia pupilar y la altura salen solo si la óptica lo permite", () => {
    expect(t).not.toContain("Distancia pupilar")
    const con = texto(armarPdfReceta({ optica: "X", paciente: {}, receta, mostrarMedidas: true }))
    expect(con).toContain("Distancia pupilar")
    expect(con).toContain("(62)")
  })
  it("escapa los paréntesis del texto", () => {
    const raro = texto(armarPdfReceta({ optica: "Óptica (Centro)", paciente: {}, receta: {} }))
    expect(raro).toContain("\xD3ptica \\(Centro\\)")
  })
})

describe("piezas", () => {
  it("parte un texto largo en renglones que caben", () => {
    const r = partirEnRenglones("uno dos tres cuatro cinco seis siete ocho nueve diez", 12, 100)
    expect(r.length).toBeGreaterThan(1)
    expect(r.join(" ")).toBe("uno dos tres cuatro cinco seis siete ocho nueve diez")
  })
  it("el nombre del archivo no lleva tildes ni espacios", () => {
    expect(nombreArchivoReceta({ nombre: "Ana Núñez" }, { fecha: "2026-10-01" })).toBe("receta-ana-nunez-2026-10-01.pdf")
    expect(nombreArchivoReceta({}, {})).toBe("receta-paciente.pdf")
  })
  it("la graduación se lee como siempre", () => {
    expect(textoGraduacionOjo({ esfera: "-1.50", cilindro: "-0.50", eje: "90" })).toBe("-1.50 -0.50 x90")
    expect(textoGraduacionOjo({})).toBe("No registrada")
  })
})
