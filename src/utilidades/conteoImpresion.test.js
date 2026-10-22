import { describe, it, expect } from "vitest"
import { htmlHojaConteo } from "./conteoImpresion"

const productos = [
  { id: "a", nombre: "Montura <A>", categoria: "Monturas", codigo: "RB-1", stock: 7 },
  { id: "b", nombre: "Estuche", categoria: "Accesorios", stock: 31 },
  { id: "c", nombre: "Montura B", categoria: "Monturas", stock: 12 },
]

describe("hoja de conteo", () => {
  const html = htmlHojaConteo({ opticaNombre: "Óptica Demo", productos, fecha: new Date(2026, 9, 14) })
  it("lleva la óptica, la fecha, cuántos productos son, una línea para quien cuenta y todos los productos por categoría", () => {
    expect(html).toContain("Óptica Demo")
    expect(html).toContain("Miércoles, 14 de octubre de 2026")
    expect(html).toContain("3 productos activos")
    expect(html).toContain("Contado por:")
    expect(html.indexOf("Accesorios")).toBeLessThan(html.indexOf("Monturas")) // por orden de categoría
    for (const n of ["Estuche", "Montura B", "RB-1"]) expect(html).toContain(n)
  })
  it("trae el código, la descripción, la existencia que dice el sistema y una columna en blanco para lo contado", () => {
    for (const columna of ["Código", "Descripción", "En el sistema", "Contado"]) expect(html).toContain(columna)
    expect(html).toContain('<tr><td>RB-1</td><td>Montura &lt;A&gt;</td><td class="n">7</td><td></td></tr>')
    expect(html).toContain('<tr><td></td><td>Estuche</td><td class="n">31</td><td></td></tr>') // sin código: la celda queda vacía
    expect((html.match(/<td><\/td><\/tr>/g) || []).length).toBe(3) // una celda en blanco por producto
  })
  it("dice cómo se corrigen las diferencias", () => {
    expect(html).toContain("Ajustar stock")
  })
  it("escapa los nombres", () => {
    expect(html).toContain("Montura &lt;A&gt;")
    expect(html).not.toContain("Montura <A>")
  })
  it("sin productos lo dice", () => {
    expect(htmlHojaConteo({ opticaNombre: "X", productos: [] })).toContain("No hay productos para contar.")
  })
})
