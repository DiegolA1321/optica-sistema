import { describe, it, expect } from "vitest"
import { armarPdfVectorial, nombreArchivoReceta } from "./descargarHojaReceta"

const texto = (bytes) => new TextDecoder("latin1").decode(bytes)

describe("PDF de la receta (texto real, no una imagen)", () => {
  const pdf = armarPdfVectorial({
    ancho: 780, alto: 1000,
    rects: [{ x: 40, y: 140, w: 700, h: 60, color: [0.97, 0.98, 0.99] }],
    palabras: [
      { x: 40, y: 60, w: 160, tam: 24, fuente: 2, color: [0.05, 0.17, 0.2], texto: "Óptica" },
      { x: 210, y: 60, w: 90, tam: 24, fuente: 2, color: [0.05, 0.17, 0.2], texto: "Solna" },
      { x: 40, y: 170, w: 120, tam: 14, fuente: 1, color: [0, 0, 0], texto: "Pérez-Ñandú" },
      { x: 200, y: 170, w: 80, tam: 14, fuente: 0, color: [0, 0, 0], texto: "−1.75" },
    ],
  })
  const t = texto(pdf)

  it("es un PDF de una página A4, con las fuentes estándar y sin imágenes", () => {
    expect(t.startsWith("%PDF-1.4")).toBe(true)
    expect(t).toContain("/MediaBox [0 0 595.28 841.89]")
    for (const f of ["Helvetica", "Helvetica-Bold", "Times-Roman", "Times-Bold", "Courier", "Courier-Bold"]) expect(t).toContain(`/BaseFont /${f}`)
    expect(t).not.toContain("/DCTDecode")
    expect(t).not.toContain("/Subtype /Image")
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true)
  })

  it("cada palabra es texto del PDF (se puede seleccionar): con sus tildes y la ñ, y el signo menos como guion", () => {
    expect(t).toContain("(\xD3ptica) Tj") // Ó en WinAnsi
    expect(t).toContain("(Solna) Tj")
    expect(t).toContain("(P\xE9rez-\xD1and\xFA) Tj")
    expect(t).toContain("(-1.75) Tj")
    expect(t).toContain("/F4 ")
    expect(t).toContain("/F2 ")
  })

  it("las cajas con fondo se dibujan y cada palabra va en su lugar (desde arriba a la izquierda), ajustada a su ancho", () => {
    expect(t).toMatch(/0\.97 0\.98 0\.99 rg [\d.]+ [\d.]+ [\d.]+ [\d.]+ re f/)
    const m = /BT \/F3 ([\d.]+) Tf ([\d.]+) Tz ([\d.]+) ([\d.]+) Td \(\xD3ptica\)/.exec(t) // fuente 2 → /F3 (Times-Roman)... la negrita de Times es /F4
    expect(m === null || Number(m[2]) >= 70).toBe(true)
    const solna = /\/F3 ([\d.]+) Tf ([\d.]+) Tz ([\d.]+) ([\d.]+) Td \(Solna\)/.exec(t)
    expect(Number(solna[3])).toBeCloseTo(210 * (595.28 / 780), 1)
    expect(Number(solna[4])).toBeCloseTo(841.89 - 60 * (595.28 / 780), 1)
    expect(Number(solna[2])).toBeGreaterThanOrEqual(70)
    expect(Number(solna[2])).toBeLessThanOrEqual(130)
  })

  it("la tabla de referencias cruzadas apunta a cada objeto", () => {
    const inicio = Number(/startxref\n(\d+)/.exec(t)[1])
    expect(t.slice(inicio, inicio + 4)).toBe("xref")
    const posiciones = [...t.slice(inicio).matchAll(/(\d{10}) 00000 n/g)].map((x) => Number(x[1]))
    expect(posiciones).toHaveLength(11)
    posiciones.forEach((p, i) => expect(t.slice(p, p + 7 + (i >= 9 ? 1 : 0))).toBe(`${i + 1} 0 obj`))
  })

  it("el nombre del archivo lleva el paciente y la fecha, sin tildes", () => {
    expect(nombreArchivoReceta({ nombre: "Marta Zambrano Piña" }, { fecha: "2026-04-20" })).toBe("receta-marta-zambrano-pina-2026-04-20.pdf")
    expect(nombreArchivoReceta({}, {})).toBe("receta-paciente.pdf")
  })
})
