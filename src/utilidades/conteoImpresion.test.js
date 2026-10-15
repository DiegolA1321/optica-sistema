import { describe, it, expect } from "vitest"
import { htmlHojaConteo, htmlActaConteo, mapActa } from "./conteoImpresion"

const productos = [
  { id: "a", nombre: "Montura <A>", categoria: "Monturas", codigo: "RB-1", stock: 7 },
  { id: "b", nombre: "Estuche", categoria: "Accesorios", stock: 31 },
  { id: "c", nombre: "Montura B", categoria: "Monturas", stock: 12 },
]

describe("hoja de conteo en blanco", () => {
  const html = htmlHojaConteo({ opticaNombre: "Óptica Demo", productos, fecha: new Date(2026, 9, 14) })
  it("lleva la óptica, la fecha, una línea para quien cuenta y todos los productos por categoría", () => {
    expect(html).toContain("Óptica Demo")
    expect(html).toContain("Miércoles, 14 de octubre de 2026")
    expect(html).toContain("Contado por:")
    expect(html.indexOf("Accesorios")).toBeLessThan(html.indexOf("Monturas")) // por orden de categoría
    for (const n of ["Estuche", "Montura B", "RB-1"]) expect(html).toContain(n)
  })
  it("es a ciegas: no trae la existencia que dice el sistema, y trae una celda vacía para cada producto", () => {
    expect(html).not.toMatch(/>7<|>31<|>12<|Sistema|Existencia/)
    expect((html.match(/<tr><td>/g) || []).length).toBe(3)
    expect(html).toContain("<td></td><td></td></tr>")
  })
  it("escapa los nombres", () => {
    expect(html).toContain("Montura &lt;A&gt;")
    expect(html).not.toContain("Montura <A>")
  })
  it("sin productos lo dice", () => {
    expect(htmlHojaConteo({ opticaNombre: "X", productos: [] })).toContain("No hay productos para contar.")
  })
})

describe("acta del conteo", () => {
  const acta = {
    creadoEn: "2026-10-14T15:00:00-05:00", usuarioNombre: "Ana Pérez", contados: 12, iguales: 10, sobrantes: 1, faltantes: 3, valorPrecio: -160, valorCosto: -55.5,
    detalle: [
      { nombre: "Montura A", categoria: "Monturas", antes: 10, contado: 7, diferencia: -3, precio: 60, costo: 20 },
      { nombre: "Estuche", categoria: "Accesorios", antes: 4, contado: 5, diferencia: 1, precio: 20, costo: null },
    ],
  }
  const html = htmlActaConteo({ opticaNombre: "Óptica Demo", acta })
  it("trae la fecha, quién contó y los totales", () => {
    expect(html).toContain("Acta de conteo físico")
    expect(html).toContain("14 oct 2026")
    expect(html).toContain("Ana Pérez")
    expect(html).toContain("<b>12</b>productos contados")
    expect(html).toContain("<b>2</b>con diferencia")
    expect(html).toContain("<b>1 / 3</b>unidades que sobran / faltan")
  })
  it("trae los productos con diferencia y el valor de cada diferencia en dinero, con signo", () => {
    expect(html).toContain("Montura A")
    expect(html).toContain("−3")
    expect(html).toContain("−$180.00") // −3 × $60
    expect(html).toContain("+1")
    expect(html).toContain("$20.00") // +1 × $20
    expect(html).toContain("−$160.00") // el total a precio
  })
  it("con costos muestra también el valor a costo, y sin ellos no lo menciona", () => {
    expect(html).toContain("valor de la diferencia a costo")
    expect(html).toContain("−$55.50")
    expect(html).toContain("−$60.00") // −3 × $20
    const sin = htmlActaConteo({ opticaNombre: "X", acta: { ...acta, valorCosto: null } })
    expect(sin).not.toContain("a costo")
    expect(sin).not.toContain("Valor (costo)")
  })
  it("un conteo sin diferencias lo dice", () => {
    expect(htmlActaConteo({ opticaNombre: "X", acta: { ...acta, iguales: 12, detalle: [], sobrantes: 0, faltantes: 0, valorPrecio: 0, valorCosto: null } })).toContain("no hubo diferencias")
  })
  it("se arma desde una fila de la base", () => {
    const a = mapActa({ id: "k", created_at: "2026-10-14T20:00:00Z", usuario_nombre: "Ana", productos_contados: 3, productos_iguales: 2, unidades_sobrantes: 0, unidades_faltantes: 2, valor_precio: "-120.00", valor_costo: null,
      detalle: [{ producto_id: "p", nombre: "M", categoria: "Monturas", antes: 5, contado: 3, diferencia: -2, precio: "60.00", costo: null }] })
    expect(a).toMatchObject({ id: "k", contados: 3, iguales: 2, faltantes: 2, valorPrecio: -120, valorCosto: null })
    expect(a.detalle[0]).toMatchObject({ nombre: "M", diferencia: -2, precio: 60, costo: null })
  })
})
