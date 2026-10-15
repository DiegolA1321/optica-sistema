import { describe, it, expect } from "vitest"
import { metricasInventario, movimientosDelRango } from "./reportesInventario"

// Un caso hecho a mano, con todo calculable a ojo.
// Montura A: costo 40, precio 100. Montura B: costo 20, precio 50. Accesorio C: costo 2, precio 5. Montura D: sin costo.
// Septiembre (período anterior): se vende 1 de A. Octubre (período): se vende 2 de A y 1 de B; entran 10 de A el 3 oct.
const productos = [
  { id: "A", nombre: "Montura A", categoria: "Monturas", stock: 12, precio: 100, costo: 40, creadoEn: "2026-01-05T15:00:00Z", activo: true },
  { id: "B", nombre: "Montura B", categoria: "Monturas", stock: 4, precio: 50, costo: 20, creadoEn: "2026-01-05T15:00:00Z", activo: true },
  { id: "C", nombre: "Estuche", categoria: "Accesorios", stock: 30, precio: 5, costo: 2, creadoEn: "2026-01-05T15:00:00Z", activo: true },
  { id: "D", nombre: "Montura D", categoria: "Monturas", stock: 6, precio: 80, creadoEn: "2026-01-05T15:00:00Z", activo: true },
  { id: "E", nombre: "Vieja", categoria: "Monturas", stock: 9, precio: 10, costo: 1, creadoEn: "2026-01-05T15:00:00Z", activo: false },
]
const mov = (id, productoId, cantidad, creadoEn, tipo = "venta", seq = 1) => ({ id, productoId, cantidad, creadoEn, tipo, seq, stockResultante: 0, motivo: "", usuarioNombre: "" })
const movimientos = [
  mov("m1", "A", -1, "2026-09-10T15:00:00Z"),
  mov("m2", "A", 10, "2026-10-03T15:00:00Z", "ingreso_compra"),
  mov("m3", "A", -2, "2026-10-06T15:00:00Z"),
  mov("m4", "B", -1, "2026-10-06T15:00:00Z"),
]
const linea = (productoId, cantidad, precioUnitario) => ({ tipo: "producto", productoId, cantidad, precioUnitario, descripcion: `P ${productoId}` })
const fac = (id, creadoEn, lineas, estado = "pagada") => ({ id, numero: 1, creadoEn, estado, lineas })
const facturas = [
  fac("f1", "2026-09-10T15:00:00Z", [linea("A", 1, 100)]),
  fac("f2", "2026-10-06T15:00:00Z", [linea("A", 2, 100), linea("B", 1, 50)]),
  fac("f3", "2026-10-07T15:00:00Z", [linea("C", 5, 5)], "anulada"),
]
const rango = { inicio: "2026-10-01", fin: "2026-10-12" }
const previo = { inicio: "2026-09-01", fin: "2026-09-12" }
const m = metricasInventario({ productos, facturas, movimientos, rango, previo })

describe("Reportes › Inventario: el período", () => {
  it("el valor a costo al cierre es lo que hay hoy por su costo, sin los descontinuados ni los que no tienen costo", () => {
    expect(m.act.final.valor).toBe(12 * 40 + 4 * 20 + 30 * 2) // 480 + 80 + 60
    expect(m.act.final.sinCosto).toBe(1) // Montura D tiene existencia y no tiene costo
    expect(m.act.final.filas.map((f) => f.producto.id)).toEqual(["A", "B", "C"])
  })
  it("el valor al empezar sale del kárdex: lo de hoy menos lo que se movió desde entonces", () => {
    // Al 30 sept: A = 12 − (+10 − 2) = 4; B = 4 + 1 = 5; C = 30
    expect(m.act.inicial.valor).toBe(4 * 40 + 5 * 20 + 30 * 2)
  })
  it("el margen es lo que dejó lo vendido en el período, sin los comprobantes anulados y solo con costo", () => {
    expect(m.act.margen.ingreso).toBe(250) // 2×100 + 1×50
    expect(m.act.margen.costo).toBe(100) // 2×40 + 1×20
    expect(m.act.margen.ganancia).toBe(150)
    expect(m.act.margen.porcentaje).toBe(60)
    expect(m.act.unidades).toBe(3)
  })
  it("la rotación es el costo de lo vendido entre el promedio del inventario al empezar y al terminar", () => {
    const promedio = (m.act.inicial.valor + m.act.final.valor) / 2
    expect(m.act.rotacion.promedio).toBe(promedio)
    expect(m.act.rotacion.valor).toBe(Math.round((100 / promedio) * 100) / 100)
  })
  it("las más vendidas se ordenan por unidades", () => {
    expect(m.act.masVendidas.map((p) => [p.id, p.unidades])).toEqual([["A", 2], ["B", 1]])
  })
  it("las monturas sin venderse son las que tienen existencia y llevan 90 días o más sin venderse", () => {
    // A se vendió el 6 oct y B el 6 oct; D nunca se vendió; C es accesorio; E está descontinuada
    expect(m.act.sinVender.map((f) => f.producto.id)).toEqual(["D"])
  })
})

describe("Reportes › Inventario: el período anterior (para comparar)", () => {
  it("se calcula igual, con su propio tramo", () => {
    expect(m.ant.margen.ingreso).toBe(100)
    expect(m.ant.margen.costo).toBe(40)
    expect(m.ant.margen.porcentaje).toBe(60)
    expect(m.ant.unidades).toBe(1)
  })
  it("el valor del período anterior usa la existencia que había en esa fecha", () => {
    // Al 12 sept: A = 12 − (+10 − 2) = 4, B = 4 + 1 = 5, C = 30, D (sin costo)
    expect(m.ant.final.valor).toBe(4 * 40 + 5 * 20 + 30 * 2)
  })
  it("las monturas sin venderse al cierre del período anterior cuentan con lo que había entonces", () => {
    // Al 12 sept: A (vendida el 10 sept), B nunca vendida y con existencia 5, D nunca vendida.
    expect(m.ant.sinVender.map((f) => f.producto.id).sort()).toEqual(["B", "D"])
  })
})

describe("Reportes › Inventario: el kárdex", () => {
  it("dice desde cuándo hay movimientos (el primero que no es un saldo inicial)", () => {
    expect(m.kardexDesde).toBe("2026-09-10")
    expect(metricasInventario({ productos, facturas, movimientos: [], rango, previo }).kardexDesde).toBeNull()
  })
  it("sin movimientos la existencia es la de hoy en todas las fechas", () => {
    const sin = metricasInventario({ productos, facturas, movimientos: [], rango, previo })
    expect(sin.act.inicial.valor).toBe(sin.act.final.valor)
  })
  it("los movimientos del rango salen del más antiguo al más reciente, con el nombre del producto", () => {
    const lista = movimientosDelRango(movimientos, productos, rango)
    expect(lista.map((x) => x.id)).toEqual(["m2", "m3", "m4"])
    expect(lista[0]).toMatchObject({ producto: "Montura A", etiqueta: "Ingreso por compra", categoria: "Monturas" })
  })
  it("sin productos o sin ventas no divide entre cero ni falla", () => {
    const vacio = metricasInventario({ productos: [], facturas: [], movimientos: [], rango, previo })
    expect(vacio.act.rotacion.valor).toBeNull()
    expect(vacio.act.margen.porcentaje).toBeNull()
    expect(vacio.act.sinVender).toEqual([])
    expect(vacio.act.masVendidas).toEqual([])
  })
})
