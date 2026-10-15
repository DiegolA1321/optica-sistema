// Inventario v2: los cálculos del kárdex, del margen, del valor, del conteo físico y de la rotación. Lógica pura, sin pantalla.
// Los movimientos vienen de `movimientos_inventario` (migración 0111): cada cambio de existencia con su tipo, cantidad (con signo),
// existencia resultante, motivo y quién lo hizo. Las fechas se leen con `diaDe` (hora de Ecuador), nunca con `new Date(valor)`.
import { diaDe } from "./reportesPeriodo"
import { sumarDiasISO } from "./controles"

const redondear = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

export const CATEGORIA_MONTURA = "Monturas"
export const DIAS_SIN_VENDER = 90

// Los tipos de movimiento: cómo se llama cada uno, si suma o resta y cuáles se pueden registrar a mano.
export const TIPOS_MOVIMIENTO = {
  saldo_inicial: { etiqueta: "Saldo inicial", manual: false },
  venta: { etiqueta: "Venta", manual: false },
  anulacion_venta: { etiqueta: "Anulación de venta", manual: false },
  ingreso_compra: { etiqueta: "Ingreso por compra", manual: true, signo: 1 },
  ajuste_conteo: { etiqueta: "Ajuste por conteo", manual: true, signo: 0 },
  merma: { etiqueta: "Merma o pérdida", manual: true, signo: -1 },
  devolucion_proveedor: { etiqueta: "Devolución al proveedor", manual: true, signo: -1 },
  ajuste_directo: { etiqueta: "Cambio directo", manual: false },
}
export const etiquetaMovimiento = (tipo) => TIPOS_MOVIMIENTO[tipo]?.etiqueta || tipo

// Lo que se puede hacer desde "Ajustar stock" (el ingreso tiene su propio botón "Registrar ingreso").
export const TIPOS_AJUSTE = [
  { id: "ajuste_conteo", etiqueta: "Ajuste por conteo", ayuda: "La existencia real es otra: escribe cuántas unidades hay." },
  { id: "merma", etiqueta: "Merma o pérdida", ayuda: "Se rompió, se perdió o se dañó: resta unidades." },
  { id: "devolucion_proveedor", etiqueta: "Devolución al proveedor", ayuda: "Se devolvió al proveedor: resta unidades." },
]

// El cambio con signo que se manda a la base para un tipo y una cantidad escrita sin signo. Un ajuste por conteo manda la existencia final.
export function cambioDeMovimiento(tipo, cantidad, existenciaActual = 0) {
  const n = Math.floor(Number(cantidad))
  if (!Number.isFinite(n) || n < 0) return null
  if (tipo === "ingreso_compra") return n > 0 ? n : null
  if (tipo === "merma" || tipo === "devolucion_proveedor") return n > 0 ? -n : null
  if (tipo === "ajuste_conteo") return n - (Number(existenciaActual) || 0) || null
  return null
}

// ─── Margen y valor ───
export const tieneCosto = (p) => p?.costo !== null && p?.costo !== undefined && p?.costo !== "" && Number.isFinite(Number(p.costo))

// Ganancia por unidad: precio menos costo, y qué parte del precio es (margen sobre el precio de venta). Sin costo no hay margen.
export function margenDe(p) {
  if (!tieneCosto(p)) return null
  const precio = Number(p.precio) || 0
  const monto = redondear(precio - Number(p.costo))
  return { monto, porcentaje: precio > 0 ? Math.round(((precio - Number(p.costo)) / precio) * 1000) / 10 : null }
}

// El valor de lo que hay en existencia, a precio de venta y a costo (solo de los productos que tienen costo; `sinCosto` dice cuántos faltan).
export function valorInventario(productos = []) {
  let aPrecio = 0, aCosto = 0, conCosto = 0, sinCosto = 0
  for (const p of productos) {
    const stock = Number(p.stock) || 0
    aPrecio += stock * (Number(p.precio) || 0)
    if (tieneCosto(p)) { aCosto += stock * Number(p.costo); conCosto++ } else sinCosto++
  }
  return { aPrecio: redondear(aPrecio), aCosto: redondear(aCosto), conCosto, sinCosto, hayCosto: conCosto > 0 }
}

// Las medidas de la montura como las escribe la orden de laboratorio: "52-18-140" (calibre-puente-varilla). Sin medidas, "".
export function medidasTexto(p) {
  const partes = [p?.calibre, p?.puente, p?.varilla]
  if (partes.every((v) => v === null || v === undefined || v === "")) return ""
  return partes.map((v) => (v === null || v === undefined || v === "" ? "—" : String(v))).join("-")
}

// ─── Kárdex: la existencia en una fecha ───
// La existencia al cierre de `fechaISO`: la de hoy menos todo lo que se movió después de ese día. Los productos que todavía no existían
// ese día (su saldo inicial es posterior) dan 0. Antes de que existiera el kárdex solo hay lo que quedó registrado desde entonces.
export function existenciaEn(producto, movimientos = [], fechaISO) {
  let stock = Number(producto?.stock) || 0
  for (const m of movimientos) {
    if (m.productoId !== producto.id) continue
    if (diaDe(m.creadoEn) > fechaISO) stock -= Number(m.cantidad) || 0
  }
  return Math.max(0, stock)
}

// Agrupa los movimientos por producto (una sola pasada), para no recorrerlos por cada producto.
export function movimientosPorProducto(movimientos = []) {
  const mapa = new Map()
  for (const m of movimientos) {
    if (!mapa.has(m.productoId)) mapa.set(m.productoId, [])
    mapa.get(m.productoId).push(m)
  }
  return mapa
}

// El valor a costo de todo el inventario al cierre de `fechaISO` (los productos sin costo no suman y se cuentan aparte).
export function valorACostoEn(productos, movimientos, fechaISO) {
  const por = movimientosPorProducto(movimientos)
  let valor = 0, sinCosto = 0
  const filas = []
  for (const p of productos) {
    const existencia = existenciaEn(p, por.get(p.id) || [], fechaISO)
    if (!tieneCosto(p)) { if (existencia > 0) sinCosto++; continue }
    const v = redondear(existencia * Number(p.costo))
    valor += v
    if (existencia > 0) filas.push({ producto: p, existencia, valor: v })
  }
  return { valor: redondear(valor), sinCosto, filas: filas.sort((a, b) => b.valor - a.valor) }
}

// El día en que empezó el kárdex: el primer movimiento que no es un saldo inicial. Sin ninguno, null.
export function inicioDelKardex(movimientos = []) {
  let primero = null
  for (const m of movimientos) {
    if (m.tipo === "saldo_inicial") continue
    const d = diaDe(m.creadoEn)
    if (!primero || d < primero) primero = d
  }
  return primero
}

// ─── Lo vendido ───
// Las líneas de producto de los comprobantes vigentes de un tramo, con el producto que corresponde y lo que costó.
export function lineasDeProducto(facturas = [], rango, productos = []) {
  const porId = new Map(productos.map((p) => [p.id, p]))
  const filas = []
  for (const f of facturas) {
    if (f.estado === "anulada") continue
    const dia = diaDe(f.creadoEn)
    if (!dia || dia < rango.inicio || dia > rango.fin) continue
    for (const l of f.lineas || []) {
      if (l.tipo !== "producto" || !l.productoId) continue
      const producto = porId.get(l.productoId) || null
      const cantidad = Number(l.cantidad) || 0
      const ingreso = redondear(cantidad * (Number(l.precioUnitario) || 0) - (Number(l.descuentoMonto) || 0))
      const costo = producto && tieneCosto(producto) ? redondear(cantidad * Number(producto.costo)) : null
      filas.push({ factura: f, linea: l, producto, cantidad, ingreso, costo })
    }
  }
  return filas
}

// Lo que costó lo vendido y el margen que dejó (solo de las líneas cuyo producto tiene costo).
export function margenDeLoVendido(filas = []) {
  const conCosto = filas.filter((x) => x.costo !== null)
  const ingreso = redondear(conCosto.reduce((s, x) => s + x.ingreso, 0))
  const costo = redondear(conCosto.reduce((s, x) => s + x.costo, 0))
  return {
    ingreso, costo, ganancia: redondear(ingreso - costo), lineas: conCosto, sinCosto: filas.length - conCosto.length,
    porcentaje: ingreso > 0 ? Math.round(((ingreso - costo) / ingreso) * 1000) / 10 : null,
  }
}

// Rotación: cuántas veces se "renovó" el inventario en el período = costo de lo vendido ÷ inventario promedio (a costo).
// El inventario promedio es el promedio entre el valor al empezar y el valor al terminar. Sin inventario, no hay rotación.
export function rotacion({ costoVendido, valorInicial, valorFinal }) {
  const promedio = ((Number(valorInicial) || 0) + (Number(valorFinal) || 0)) / 2
  if (!(promedio > 0)) return { valor: null, promedio: 0 }
  return { valor: Math.round(((Number(costoVendido) || 0) / promedio) * 100) / 100, promedio: redondear(promedio) }
}

// Las más vendidas: unidades, ingreso y ganancia por producto en el tramo, de mayor a menor.
export function masVendidas(filas = [], limite = 8) {
  const mapa = new Map()
  for (const x of filas) {
    const clave = x.producto?.id || x.linea.descripcion || "—"
    const a = mapa.get(clave) || { id: clave, nombre: x.producto?.nombre || x.linea.descripcion || "Producto sin nombre", producto: x.producto, unidades: 0, ingreso: 0, costo: 0, conCosto: true, filas: [] }
    a.unidades += x.cantidad
    a.ingreso = redondear(a.ingreso + x.ingreso)
    if (x.costo === null) a.conCosto = false; else a.costo = redondear(a.costo + x.costo)
    a.filas.push(x)
    mapa.set(clave, a)
  }
  return [...mapa.values()]
    .map((a) => ({ ...a, ganancia: a.conCosto ? redondear(a.ingreso - a.costo) : null }))
    .sort((a, b) => b.unidades - a.unidades || b.ingreso - a.ingreso || a.nombre.localeCompare(b.nombre))
    .slice(0, limite)
}

// Monturas con existencia que no se venden desde hace `dias` días o más (contados hasta `fechaISO`). Una montura que se registró hace
// menos de ese tiempo todavía no cuenta: no ha tenido tiempo de venderse. Devuelve la última venta de cada una (o null si nunca se vendió).
export function monturasSinVender({ productos = [], facturas = [], movimientos = [], fechaISO, dias = DIAS_SIN_VENDER }) {
  const limite = sumarDiasISO(fechaISO, -dias)
  const ultima = new Map()
  for (const f of facturas) {
    if (f.estado === "anulada") continue
    const dia = diaDe(f.creadoEn)
    if (!dia || dia > fechaISO) continue
    for (const l of f.lineas || []) {
      if (l.tipo !== "producto" || !l.productoId) continue
      if (!ultima.has(l.productoId) || ultima.get(l.productoId) < dia) ultima.set(l.productoId, dia)
    }
  }
  const por = movimientosPorProducto(movimientos)
  const filas = []
  for (const p of productos) {
    if (p.categoria !== CATEGORIA_MONTURA || p.activo === false) continue
    const alta = diaDe(p.creadoEn)
    if (alta && alta > limite) continue
    const existencia = existenciaEn(p, por.get(p.id) || [], fechaISO)
    if (existencia <= 0) continue
    const ultimaVenta = ultima.get(p.id) || null
    if (ultimaVenta && ultimaVenta > limite) continue
    filas.push({ producto: p, existencia, ultimaVenta, valor: redondear(existencia * (Number(p.precio) || 0)) })
  }
  return filas.sort((a, b) => (a.ultimaVenta || "") .localeCompare(b.ultimaVenta || "") || b.valor - a.valor)
}

// ─── Conteo físico ───
// Las diferencias entre lo contado y lo que dice el sistema. `contados`: { [productoId]: texto o número }. Lo que no se escribió no se cuenta.
export function diferenciasConteo(productos = [], contados = {}) {
  const filas = []
  for (const p of productos) {
    const crudo = contados[p.id]
    if (crudo === undefined || crudo === null || String(crudo).trim() === "") continue
    const contado = Number(crudo)
    const valido = Number.isInteger(contado) && contado >= 0
    const esperado = Number(p.stock) || 0
    filas.push({ producto: p, esperado, contado: valido ? contado : null, diferencia: valido ? contado - esperado : null, valido })
  }
  return filas
}
export const resumenConteo = (filas) => {
  const validas = filas.filter((x) => x.valido)
  const conDiferencia = validas.filter((x) => x.diferencia !== 0)
  return {
    contados: filas.length, invalidos: filas.length - validas.length, iguales: validas.length - conDiferencia.length, conDiferencia,
    sobrantes: conDiferencia.filter((x) => x.diferencia > 0).reduce((s, x) => s + x.diferencia, 0),
    faltantes: conDiferencia.filter((x) => x.diferencia < 0).reduce((s, x) => s - x.diferencia, 0),
  }
}
