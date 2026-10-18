import { describe, it, expect } from "vitest"
import { armarPdfConImagen, nombreArchivoReceta } from "./descargarHojaReceta"

const texto = (bytes) => new TextDecoder("latin1").decode(bytes)

describe("PDF de la receta", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9])
  const pdf = armarPdfConImagen({ jpeg, anchoPx: 1560, altoPx: 2200 })
  const t = texto(pdf)

  it("es un PDF de una página A4 con la imagen de la hoja incrustada", () => {
    expect(t.startsWith("%PDF-1.4")).toBe(true)
    expect(t).toContain("/MediaBox [0 0 595.28 841.89]")
    expect(t).toContain("/Subtype /Image /Width 1560 /Height 2200")
    expect(t).toContain("/Filter /DCTDecode /Length 10")
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true)
  })

  it("la imagen cabe en la página (se ajusta al alto cuando la hoja es muy alta)", () => {
    const m = /q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm/.exec(t)
    expect(Number(m[1])).toBeLessThanOrEqual(595.28)
    expect(Number(m[2])).toBeLessThanOrEqual(841.89)
    expect(Number(m[4]) + Number(m[2])).toBeCloseTo(841.89, 1) // pegada arriba
  })

  it("la tabla de referencias cruzadas apunta a cada objeto", () => {
    const inicio = Number(/startxref\n(\d+)/.exec(t)[1])
    expect(t.slice(inicio, inicio + 4)).toBe("xref")
    const posiciones = [...t.slice(inicio).matchAll(/(\d{10}) 00000 n/g)].map((x) => Number(x[1]))
    expect(posiciones).toHaveLength(5)
    posiciones.forEach((p, i) => expect(t.slice(p, p + 7)).toBe(`${i + 1} 0 obj`))
  })

  it("el nombre del archivo lleva el paciente y la fecha, sin tildes", () => {
    expect(nombreArchivoReceta({ nombre: "Marta Zambrano Piña" }, { fecha: "2026-04-20" })).toBe("receta-marta-zambrano-pina-2026-04-20.pdf")
    expect(nombreArchivoReceta({}, {})).toBe("receta-paciente.pdf")
  })
})
