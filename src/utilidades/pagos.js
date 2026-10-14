// Formas de pago de un cobro (la venta pagada al contado o un abono): se puede repartir entre varios métodos a la vez
// (parte en efectivo y parte con tarjeta). Lógica pura; el servidor repite estas comprobaciones (migración 0109).
//
// Un cobro se guarda como una lista `pagos` = [{ metodo, monto }]. Un cobro anterior a esta función no la tiene: su método
// queda "sin indicar" (salvo las ventas con tarjeta, que ya lo decían en su método de pago).
import { dinero } from "./formatoMoneda"

export const METODOS_COBRO = [
  { id: "efectivo", etiqueta: "Efectivo" },
  { id: "tarjeta", etiqueta: "Tarjeta" },
  { id: "transferencia", etiqueta: "Transferencia" },
]
export const SIN_INDICAR = "sin_indicar"
export const MAX_FORMAS_DE_PAGO = 4

export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100
export const nombreMetodoCobro = (id) => METODOS_COBRO.find((m) => m.id === id)?.etiqueta || "Sin indicar"
export const sumaPagos = (pagos = []) => redondear(pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0))

// Las filas de un formulario ({ metodo, monto: "texto" }) como pagos reales: sin las filas vacías ni los montos que no son número.
export const pagosDeFormulario = (filas = []) => filas
  .map((f) => ({ metodo: f.metodo, monto: redondear(parseFloat(f.monto)) }))
  .filter((p) => p.monto > 0)

// Revisa lo que se escribió contra lo que se debe cobrar. `restante` > 0 falta por repartir; < 0 se pasó.
export function revisarPagos(filas, total) {
  const pagos = pagosDeFormulario(filas)
  const meta = redondear(total)
  const restante = redondear(meta - sumaPagos(pagos))
  if (pagos.length === 0) return { error: "Indica cómo se pagó.", restante, pagos }
  if (pagos.length > MAX_FORMAS_DE_PAGO) return { error: `Un cobro admite hasta ${MAX_FORMAS_DE_PAGO} formas de pago.`, restante, pagos }
  if (pagos.some((p) => !METODOS_COBRO.some((m) => m.id === p.metodo))) return { error: "Elige el método de cada pago.", restante, pagos }
  if (restante > 0) return { error: `Faltan ${dinero(restante)} por repartir entre las formas de pago.`, restante, pagos }
  if (restante < 0) return { error: `Las formas de pago se pasan en ${dinero(-restante)}.`, restante, pagos }
  return { error: "", restante: 0, pagos }
}

// "Efectivo $60.00 + Tarjeta $40.00"; un solo método, solo su nombre ("Efectivo").
export function textoPagos(pagos = []) {
  const reales = pagos.filter((p) => p.monto > 0)
  if (reales.length === 0) return "Sin indicar"
  if (reales.length === 1) return nombreMetodoCobro(reales[0].metodo)
  return reales.map((p) => `${nombreMetodoCobro(p.metodo)} ${dinero(p.monto)}`).join(" + ")
}

// Cómo se pagó un abono: su lista, o "sin indicar" si es anterior a las formas de pago.
export const pagosDeAbono = (abono) => (Array.isArray(abono?.pagos) && abono.pagos.length > 0 ? abono.pagos : [{ metodo: SIN_INDICAR, monto: redondear(abono?.monto) }])

// Cómo se pagó la parte de una venta que se cobró al contado (lo que no vino en abonos): su lista, o el método que decía la venta.
export function pagosAlContado(factura, monto) {
  const m = redondear(monto)
  if (Array.isArray(factura?.pagos) && factura.pagos.length > 0) return factura.pagos
  return [{ metodo: factura?.metodoPago === "tarjeta" ? "tarjeta" : SIN_INDICAR, monto: m }]
}

// El método de pago con el que se guarda la venta: "tarjeta" si todo fue con tarjeta; si no, "directo".
export const modalidadDePagos = (pagos = []) => (pagos.length > 0 && pagos.every((p) => p.metodo === "tarjeta") ? "tarjeta" : "directo")

// Suma lo cobrado por método: [{ metodo, etiqueta, monto }] en el orden efectivo, tarjeta, transferencia y, al final, sin indicar (solo si hay).
export function totalesPorMetodo(listasDePagos = []) {
  const mapa = new Map()
  for (const pagos of listasDePagos) for (const p of pagos) mapa.set(p.metodo, redondear((mapa.get(p.metodo) || 0) + p.monto))
  const orden = [...METODOS_COBRO.map((m) => m.id), SIN_INDICAR]
  return orden
    .filter((id) => id !== SIN_INDICAR || (mapa.get(id) || 0) > 0)
    .map((id) => ({ metodo: id, etiqueta: nombreMetodoCobro(id), monto: mapa.get(id) || 0 }))
}
