import { describe, it, expect } from "vitest"
import { seccionesDeConteo, totalesDeConteo, hayCodigos, paginarConteo } from "./conteoImpresion"

const p = (id, nombre, categoria, stock, extra = {}) => ({ id, nombre, categoria, stock, ...extra })

describe("hoja de conteo: qué entra", () => {
  const activos = [p("a", "Montura B", "Monturas", 12), p("b", "Estuche", "Accesorios", 31), p("c", "Montura A", "Monturas", 7, { codigo: "RB-1" })]
  const descontinuados = [p("d", "Vieja con unidades", "Monturas", 3), p("e", "Vieja sin unidades", "Monturas", 0)]

  it("los activos por categoría y por nombre, y al final los descontinuados que todavía tienen unidades", () => {
    const s = seccionesDeConteo({ activos, descontinuados })
    expect(s.map((x) => x.titulo)).toEqual(["Accesorios", "Monturas", "Descontinuados con unidades"])
    expect(s[1].productos.map((x) => x.nombre)).toEqual(["Montura A", "Montura B"])
    expect(s[2].productos.map((x) => x.nombre)).toEqual(["Vieja con unidades"])
    expect(s[2].descontinuados).toBe(true)
  })
  it("sin descontinuados con unidades no hay esa sección", () => {
    expect(seccionesDeConteo({ activos, descontinuados: [p("e", "x", "M", 0)] }).map((x) => x.titulo)).toEqual(["Accesorios", "Monturas"])
  })
  it("los totales son productos y unidades del sistema de todo lo que sale en la hoja", () => {
    expect(totalesDeConteo(seccionesDeConteo({ activos, descontinuados }))).toEqual({ productos: 4, unidades: 53 })
  })
  it("la columna «Código» solo va si algún producto tiene código", () => {
    expect(hayCodigos(seccionesDeConteo({ activos }))).toBe(true)
    expect(hayCodigos(seccionesDeConteo({ activos: [p("a", "x", "M", 1)] }))).toBe(false)
  })
})

describe("hoja de conteo: páginas", () => {
  const muchos = (n) => Array.from({ length: n }, (_, i) => p("p" + i, "Producto " + String(i).padStart(3, "0"), "Monturas", i))
  it("pocos productos caben en una página, con el encabezado y el cierre (totales y firmas)", () => {
    const pg = paginarConteo(seccionesDeConteo({ activos: muchos(5) }))
    expect(pg).toHaveLength(1)
    expect(pg[0]).toMatchObject({ conEncabezado: true, conCierre: true })
    expect(pg[0].elementos.filter((e) => e.tipo === "fila")).toHaveLength(5)
  })
  it("un inventario grande se parte en varias páginas sin perder ni repetir ningún producto; solo la primera lleva el encabezado y solo la última el cierre", () => {
    const pg = paginarConteo(seccionesDeConteo({ activos: muchos(120) }))
    expect(pg.length).toBeGreaterThan(2)
    expect(pg.filter((x) => x.conEncabezado)).toHaveLength(1)
    expect(pg[0].conEncabezado).toBe(true)
    expect(pg.filter((x) => x.conCierre)).toHaveLength(1)
    expect(pg.at(-1).conCierre).toBe(true)
    const ids = pg.flatMap((x) => x.elementos.filter((e) => e.tipo === "fila").map((e) => e.producto.id))
    expect(ids).toHaveLength(120)
    expect(new Set(ids).size).toBe(120)
  })
  it("las filas alternan su fondo dentro de cada categoría", () => {
    const filas = paginarConteo(seccionesDeConteo({ activos: muchos(4) }))[0].elementos.filter((e) => e.tipo === "fila")
    expect(filas.map((f) => f.alterna)).toEqual([false, true, false, true])
  })
  it("un título de categoría nunca queda solo al final de una página", () => {
    for (const n of [20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30]) {
      const pg = paginarConteo([...seccionesDeConteo({ activos: muchos(n) }), { titulo: "Otra", productos: muchos(3) }])
      for (const x of pg) expect(x.elementos.at(-1)?.tipo).not.toBe("titulo")
    }
  })
});
