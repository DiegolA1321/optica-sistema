import { describe, it, expect } from "vitest"

// jsdom no mide el texto: el armado se prueba por su estructura (páginas, tamaño de hoja); el dibujo lo ve Diego en pantalla.
globalThis.Range.prototype.getClientRects = () => []
import { armarPdfConteo, nombreArchivoConteo } from "./descargarHojaConteo"

const decodificar = (u8) => new TextDecoder("latin1").decode(u8)
const productos = Array.from({ length: 90 }, (_, i) => ({ id: "p" + i, nombre: "Producto " + i, categoria: i % 2 ? "Monturas" : "Accesorios", stock: i }))

describe("hoja de conteo en PDF", () => {
  it("es un PDF real de varias páginas A4 y varias páginas", async () => {
    const pdf = await armarPdfConteo({ optica: { nombre: "Óptica Demo", direccion: "Av. 1", telefono: "0990000000" }, activos: productos, descontinuados: [{ id: "d", nombre: "Vieja", categoria: "Monturas", stock: 2 }], fecha: "Jueves, 22 de octubre de 2026" })
    const t = decodificar(pdf)
    expect(t.startsWith("%PDF-1.4")).toBe(true)
    expect(t.trimEnd().endsWith("%%EOF")).toBe(true)
    const paginas = Number(/\/Count (\d+)/.exec(t)[1])
    expect(paginas).toBeGreaterThan(1)
    expect((t.match(/\/Type \/Page /g) || []).length).toBe(paginas)
    expect(t).toContain("/MediaBox [0 0 595.28 841.89]")
  })
  it("el nombre del archivo lleva la fecha", () => {
    expect(nombreArchivoConteo("2026-10-22")).toBe("hoja-de-conteo-2026-10-22.pdf")
  })
})
