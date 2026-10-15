import { describe, it, expect } from "vitest"
import {
  margenDe, valorInventario, medidasTexto, existenciaEn, valorACostoEn, inicioDelKardex, lineasDeProducto, margenDeLoVendido, rotacion,
  masVendidas, monturasSinVender, diferenciasConteo, resumenConteo, cambioDeMovimiento, etiquetaMovimiento,
} from "./inventarioKardex"

const prod = (id, extra = {}) => ({ id, nombre: `Producto ${id}`, categoria: "Monturas", stock: 10, precio: 100, costo: 40, activo: true, creadoEn: "2026-01-05T15:00:00Z", ...extra })
const mov = (productoId, cantidad, creadoEn, tipo = "venta") => ({ productoId, cantidad, creadoEn, tipo })
const fac = (id, creadoEn, lineas, estado = "pagada") => ({ id, creadoEn, estado, lineas })
const linea = (productoId, cantidad, precioUnitario, extra = {}) => ({ tipo: "producto", productoId, cantidad, precioUnitario, descripcion: `Producto ${productoId}`, ...extra })

describe("margen y valor", () => {
  it("el margen es el precio menos el costo, y qué parte del precio es", () => {
    expect(margenDe({ precio: 100, costo: 40 })).toEqual({ monto: 60, porcentaje: 60 })
    expect(margenDe({ precio: 80, costo: 30 })).toEqual({ monto: 50, porcentaje: 62.5 })
    expect(margenDe({ precio: 50, costo: 0 })).toEqual({ monto: 50, porcentaje: 100 })
  })
  it("sin costo no hay margen, y un costo en cero SÍ cuenta como costo", () => {
    expect(margenDe({ precio: 100 })).toBeNull()
    expect(margenDe({ precio: 100, costo: null })).toBeNull()
    expect(margenDe({ precio: 100, costo: "" })).toBeNull()
    expect(margenDe({ precio: 100, costo: 0 })?.monto).toBe(100)
  })
  it("un costo mayor que el precio da margen negativo", () => {
    expect(margenDe({ precio: 50, costo: 80 })).toEqual({ monto: -30, porcentaje: -60 })
    expect(margenDe({ precio: 0, costo: 10 })).toEqual({ monto: -10, porcentaje: null })
  })
  it("el valor del inventario se da a precio y a costo, y dice cuántos productos no tienen costo", () => {
    const v = valorInventario([prod("a", { stock: 3 }), prod("b", { stock: 2, precio: 10, costo: 4 }), prod("c", { stock: 5, precio: 20, costo: undefined })])
    expect(v.aPrecio).toBe(300 + 20 + 100)
    expect(v.aCosto).toBe(120 + 8)
    expect(v.conCosto).toBe(2)
    expect(v.sinCosto).toBe(1)
    expect(v.hayCosto).toBe(true)
  })
  it("sin ningún costo el valor a costo no existe", () => {
    const v = valorInventario([prod("a", { costo: undefined }), prod("b", { costo: null })])
    expect(v.hayCosto).toBe(false)
    expect(v.aCosto).toBe(0)
    expect(v.sinCosto).toBe(2)
  })
  it("las medidas se escriben calibre-puente-varilla, como las pide la orden de laboratorio", () => {
    expect(medidasTexto({ calibre: 52, puente: 18, varilla: 140 })).toBe("52-18-140")
    expect(medidasTexto({ calibre: 52, puente: null, varilla: 140 })).toBe("52-—-140")
    expect(medidasTexto({})).toBe("")
  })
})

describe("movimientos a mano", () => {
  it("el ingreso suma, la merma y la devolución restan, y el conteo manda la existencia final", () => {
    expect(cambioDeMovimiento("ingreso_compra", 5)).toBe(5)
    expect(cambioDeMovimiento("merma", 2)).toBe(-2)
    expect(cambioDeMovimiento("devolucion_proveedor", 1)).toBe(-1)
    expect(cambioDeMovimiento("ajuste_conteo", 8, 10)).toBe(-2)
    expect(cambioDeMovimiento("ajuste_conteo", 12, 10)).toBe(2)
  })
  it("una cantidad vacía, en cero, negativa o sin cambio no es un movimiento", () => {
    expect(cambioDeMovimiento("ingreso_compra", 0)).toBeNull()
    expect(cambioDeMovimiento("merma", -3)).toBeNull()
    expect(cambioDeMovimiento("ingreso_compra", "")).toBeNull()
    expect(cambioDeMovimiento("ajuste_conteo", 10, 10)).toBeNull()
    expect(cambioDeMovimiento("venta", 3)).toBeNull()
  })
  it("cada tipo tiene su nombre en español", () => {
    expect(etiquetaMovimiento("anulacion_venta")).toBe("Anulación de venta")
    expect(etiquetaMovimiento("devolucion_proveedor")).toBe("Devolución al proveedor")
    expect(etiquetaMovimiento("merma")).toBe("Merma o pérdida")
  })
})

describe("la existencia en una fecha (kárdex)", () => {
  // Hoy hay 10. El 3 oct entraron 5 y el 8 oct se vendieron 2: el 1 oct había 7, el 5 oct 12, el 9 oct 10.
  const p = prod("a", { stock: 10 })
  const ms = [mov("a", 5, "2026-10-03T15:00:00Z", "ingreso_compra"), mov("a", -2, "2026-10-08T15:00:00Z")]
  it("se reconstruye hacia atrás desde la existencia de hoy", () => {
    expect(existenciaEn(p, ms, "2026-10-14")).toBe(10)
    expect(existenciaEn(p, ms, "2026-10-09")).toBe(10)
    expect(existenciaEn(p, ms, "2026-10-08")).toBe(10)
    expect(existenciaEn(p, ms, "2026-10-07")).toBe(12)
    expect(existenciaEn(p, ms, "2026-10-03")).toBe(12)
    expect(existenciaEn(p, ms, "2026-10-02")).toBe(7)
  })
  it("un movimiento a las 21:00 de Ecuador cuenta ese día aunque en hora universal ya sea el siguiente", () => {
    const tarde = [mov("a", -2, "2026-10-09T02:30:00Z")] // 9 oct 02:30 UTC = 8 oct 21:30 en Ecuador
    expect(existenciaEn(prod("a", { stock: 8 }), tarde, "2026-10-08")).toBe(8)
    expect(existenciaEn(prod("a", { stock: 8 }), tarde, "2026-10-07")).toBe(10)
  })
  it("un producto que todavía no existía ese día tenía 0", () => {
    const nuevo = prod("n", { stock: 4 })
    expect(existenciaEn(nuevo, [mov("n", 4, "2026-10-10T15:00:00Z", "saldo_inicial")], "2026-10-09")).toBe(0)
  })
  it("no cuenta los movimientos de otro producto", () => {
    expect(existenciaEn(p, [mov("otro", 99, "2026-10-12T15:00:00Z")], "2026-10-01")).toBe(10)
  })
  it("el valor a costo de una fecha suma existencia × costo y aparte cuenta los que no tienen costo", () => {
    const a = prod("a", { stock: 10, costo: 40 })
    const b = prod("b", { stock: 3, costo: undefined })
    const r = valorACostoEn([a, b], [mov("a", 5, "2026-10-03T15:00:00Z", "ingreso_compra")], "2026-10-02")
    expect(r.valor).toBe(5 * 40)
    expect(r.sinCosto).toBe(1)
    expect(r.filas).toHaveLength(1)
  })
  it("el kárdex empieza en el primer movimiento que no es un saldo inicial", () => {
    expect(inicioDelKardex([mov("a", 3, "2026-01-05T15:00:00Z", "saldo_inicial"), mov("a", -1, "2026-10-08T15:00:00Z"), mov("a", 2, "2026-10-04T15:00:00Z", "ingreso_compra")])).toBe("2026-10-04")
    expect(inicioDelKardex([mov("a", 3, "2026-01-05T15:00:00Z", "saldo_inicial")])).toBeNull()
  })
})

describe("lo vendido: margen, rotación y las más vendidas", () => {
  const productos = [prod("a", { costo: 40, precio: 100 }), prod("b", { costo: undefined, precio: 30 }), prod("c", { costo: 10, precio: 25 })]
  const rango = { inicio: "2026-10-01", fin: "2026-10-31" }
  const facturas = [
    fac("f1", "2026-10-05T15:00:00Z", [linea("a", 2, 100), linea("b", 1, 30)]),
    fac("f2", "2026-10-06T15:00:00Z", [linea("a", 1, 100, { descuentoMonto: 10 }), { tipo: "luna", descripcion: "Luna", cantidad: 1, precioUnitario: 200 }]),
    fac("f3", "2026-10-07T15:00:00Z", [linea("c", 4, 25)], "anulada"),
    fac("f4", "2026-09-30T15:00:00Z", [linea("c", 9, 25)]),
  ]
  it("solo cuenta las líneas de producto de los comprobantes vigentes del tramo (no lunas, anulados ni otros meses)", () => {
    const filas = lineasDeProducto(facturas, rango, productos)
    expect(filas).toHaveLength(3)
    expect(filas.reduce((s, x) => s + x.cantidad, 0)).toBe(4)
  })
  it("el ingreso de una línea descuenta su descuento y el costo sale del costo del producto", () => {
    const filas = lineasDeProducto(facturas, rango, productos)
    const conDescuento = filas.find((x) => x.factura.id === "f2")
    expect(conDescuento.ingreso).toBe(90)
    expect(conDescuento.costo).toBe(40)
    expect(filas.find((x) => x.producto.id === "b").costo).toBeNull()
  })
  it("el margen de lo vendido deja fuera las líneas sin costo y dice cuántas faltan", () => {
    const m = margenDeLoVendido(lineasDeProducto(facturas, rango, productos))
    expect(m.ingreso).toBe(200 + 90)
    expect(m.costo).toBe(80 + 40)
    expect(m.ganancia).toBe(170)
    expect(m.porcentaje).toBe(58.6)
    expect(m.sinCosto).toBe(1)
  })
  it("sin ventas con costo no hay porcentaje de margen", () => {
    expect(margenDeLoVendido([]).porcentaje).toBeNull()
  })
  it("la rotación es el costo vendido entre el inventario promedio", () => {
    expect(rotacion({ costoVendido: 120, valorInicial: 400, valorFinal: 200 })).toEqual({ valor: 0.4, promedio: 300 })
    expect(rotacion({ costoVendido: 600, valorInicial: 400, valorFinal: 200 }).valor).toBe(2)
    expect(rotacion({ costoVendido: 0, valorInicial: 400, valorFinal: 400 }).valor).toBe(0)
  })
  it("sin inventario promedio no hay rotación (no se divide entre cero)", () => {
    expect(rotacion({ costoVendido: 100, valorInicial: 0, valorFinal: 0 }).valor).toBeNull()
  })
  it("las más vendidas se ordenan por unidades, luego por ingreso", () => {
    const top = masVendidas(lineasDeProducto(facturas, rango, productos))
    expect(top.map((t) => [t.id, t.unidades])).toEqual([["a", 3], ["b", 1]])
    expect(top[0].ingreso).toBe(290)
    expect(top[0].ganancia).toBe(170)
    expect(top[1].ganancia).toBeNull() // b no tiene costo
  })
  it("respeta el límite", () => {
    expect(masVendidas(lineasDeProducto(facturas, rango, productos), 1)).toHaveLength(1)
  })
})

describe("monturas sin venderse", () => {
  const hoy = "2026-10-14"
  const vieja = (id, extra) => prod(id, { creadoEn: "2026-01-05T15:00:00Z", ...extra })
  const productos = [
    vieja("sinventas"),
    vieja("vendidaHaceMucho"),
    vieja("vendidaHace10"),
    vieja("nuevaSinVender", { creadoEn: "2026-09-20T15:00:00Z" }),
    vieja("agotada", { stock: 0 }),
    vieja("descontinuada", { activo: false }),
    vieja("accesorio", { categoria: "Accesorios" }),
  ]
  const facturas = [
    fac("f1", "2026-06-01T15:00:00Z", [linea("vendidaHaceMucho", 1, 100)]),
    fac("f2", "2026-10-04T15:00:00Z", [linea("vendidaHace10", 1, 100)]),
    fac("f3", "2026-10-01T15:00:00Z", [linea("sinventas", 1, 100)], "anulada"),
  ]
  it("son las monturas activas con existencia cuya última venta fue hace 90 días o más, o que nunca se vendieron", () => {
    const filas = monturasSinVender({ productos, facturas, fechaISO: hoy })
    expect(filas.map((f) => f.producto.id).sort()).toEqual(["sinventas", "vendidaHaceMucho"])
  })
  it("una venta anulada no cuenta como venta", () => {
    expect(monturasSinVender({ productos, facturas, fechaISO: hoy }).some((f) => f.producto.id === "sinventas")).toBe(true)
  })
  it("una montura registrada hace menos de 90 días todavía no cuenta, y las agotadas, descontinuadas y accesorios tampoco", () => {
    const ids = monturasSinVender({ productos, facturas, fechaISO: hoy }).map((f) => f.producto.id)
    for (const id of ["nuevaSinVender", "agotada", "descontinuada", "accesorio", "vendidaHace10"]) expect(ids).not.toContain(id)
  })
  it("la que se vendió más recientemente va después de la que lleva más tiempo sin venderse", () => {
    const filas = monturasSinVender({ productos, facturas, fechaISO: hoy })
    expect(filas[0].producto.id).toBe("sinventas")
    expect(filas[1].ultimaVenta).toBe("2026-06-01")
  })
  it("el corte es exactamente de 90 días", () => {
    const f = [fac("f", "2026-07-16T15:00:00Z", [linea("vendidaHaceMucho", 1, 100)])] // 90 días antes del 14 oct
    expect(monturasSinVender({ productos: [vieja("vendidaHaceMucho")], facturas: f, fechaISO: hoy })).toHaveLength(1)
    const g = [fac("g", "2026-07-17T15:00:00Z", [linea("vendidaHaceMucho", 1, 100)])] // 89 días
    expect(monturasSinVender({ productos: [vieja("vendidaHaceMucho")], facturas: g, fechaISO: hoy })).toHaveLength(0)
  })
  it("usa la existencia que había ese día, no la de hoy", () => {
    // Hoy hay 0 (se vendió todo ayer), pero el 1 oct había 2.
    const p = vieja("x", { stock: 0 })
    const ms = [mov("x", -2, "2026-10-13T15:00:00Z")]
    expect(monturasSinVender({ productos: [p], facturas: [], movimientos: ms, fechaISO: "2026-10-01" })).toHaveLength(1)
    expect(monturasSinVender({ productos: [p], facturas: [], movimientos: ms, fechaISO: hoy })).toHaveLength(0)
  })
})

describe("conteo físico", () => {
  const productos = [prod("a", { stock: 10 }), prod("b", { stock: 5 }), prod("c", { stock: 3 }), prod("d", { stock: 0 })]
  it("compara lo contado con lo que dice el sistema y deja fuera lo que no se contó", () => {
    const f = diferenciasConteo(productos, { a: "8", b: "5", c: "" })
    expect(f.map((x) => [x.producto.id, x.esperado, x.contado, x.diferencia])).toEqual([["a", 10, 8, -2], ["b", 5, 5, 0]])
  })
  it("un 0 contado cuenta (no es lo mismo que no haber contado)", () => {
    const f = diferenciasConteo(productos, { c: "0" })
    expect(f).toHaveLength(1)
    expect(f[0].diferencia).toBe(-3)
  })
  it("lo que no es un número entero de 0 o más queda como no válido", () => {
    const f = diferenciasConteo(productos, { a: "-1", b: "2.5", c: "abc" })
    expect(f.every((x) => !x.valido && x.diferencia === null)).toBe(true)
  })
  it("el resumen separa sobrantes, faltantes e iguales", () => {
    const r = resumenConteo(diferenciasConteo(productos, { a: "8", b: "5", c: "7", d: "x" }))
    expect(r.contados).toBe(4)
    expect(r.iguales).toBe(1)
    expect(r.conDiferencia).toHaveLength(2)
    expect(r.sobrantes).toBe(4)
    expect(r.faltantes).toBe(2)
    expect(r.invalidos).toBe(1)
  })
})
