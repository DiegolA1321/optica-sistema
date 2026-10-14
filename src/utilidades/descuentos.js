// Descuentos por línea de una venta: en monto o en porcentaje, con motivo obligatorio. Lógica pura; el servidor repite las
// comprobaciones y exige el nivel "editar" de Ventas (migración 0109).
//
// Una línea del cliente: { cantidad, precioUnitario, descuentoTipo: "monto" | "porcentaje" | null, descuentoValor, descuentoMotivo }.
// Una línea que llega de la base trae además `descuentoMonto`, lo que el servidor calculó: ése manda.
import { redondear } from "./pagos"

export const TIPOS_DESCUENTO = [
  { id: "monto", etiqueta: "$" },
  { id: "porcentaje", etiqueta: "%" },
]

export const brutoLinea = (l) => redondear((Number(l?.cantidad) || 0) * (Number(l?.precioUnitario) || 0))

// Lo que se descuenta de una línea (siempre entre 0 y su valor).
export function descuentoLinea(l) {
  if (!l?.descuentoTipo) return 0
  const bruto = brutoLinea(l)
  if (l.descuentoMonto != null) return Math.min(bruto, redondear(l.descuentoMonto))
  const valor = Number(l.descuentoValor) || 0
  if (valor <= 0) return 0
  const monto = l.descuentoTipo === "porcentaje" ? redondear((bruto * valor) / 100) : redondear(valor)
  return Math.min(bruto, monto)
}

export const subtotalLinea = (l) => redondear(brutoLinea(l) - descuentoLinea(l))

export function totalesDeLineas(lineas = []) {
  const bruto = redondear(lineas.reduce((s, l) => s + brutoLinea(l), 0))
  const descuento = redondear(lineas.reduce((s, l) => s + descuentoLinea(l), 0))
  return { bruto, descuento, total: redondear(bruto - descuento) }
}

// "10 %" o "$5.00" (el valor que se escribió), para decir cuánto se descontó.
export const textoValorDescuento = (l) => (l?.descuentoTipo === "porcentaje" ? `${Number(l.descuentoValor)} %` : "")

// Qué le falta o le sobra a un descuento escrito. "" si está bien (o si la línea no lleva descuento).
export function errorDeDescuento(l) {
  if (!l?.descuentoTipo) return ""
  const valor = Number(l.descuentoValor)
  const nombre = l.descripcion ? `«${l.descripcion}»` : "la línea"
  if (!(valor > 0)) return `Escribe cuánto se descuenta en ${nombre}.`
  if (l.descuentoTipo === "porcentaje" && valor > 100) return `El descuento de ${nombre} no puede pasar del 100 %.`
  if (String(l.descuentoMotivo || "").trim().length < 3) return `Escribe el motivo del descuento de ${nombre}.`
  const bruto = brutoLinea(l)
  const monto = l.descuentoTipo === "porcentaje" ? redondear((bruto * valor) / 100) : redondear(valor)
  if (monto > bruto) return `El descuento de ${nombre} no puede ser mayor que su valor.`
  if (monto <= 0) return `El descuento de ${nombre} es demasiado pequeño.`
  return ""
}

// Las líneas como las recibe crear_factura_venta (con su descuento solo si lo llevan).
export const lineaParaRpc = (l) => ({
  producto_id: l.productoId,
  tipo: l.tipo,
  descripcion: l.descripcion,
  cantidad: l.cantidad,
  precio_unitario: l.precioUnitario,
  ...(l.tipo === "luna" && l.detalle ? { detalle: l.detalle } : {}),
  ...(l.descuentoTipo ? { descuento_tipo: l.descuentoTipo, descuento_valor: Number(l.descuentoValor), descuento_motivo: String(l.descuentoMotivo || "").trim() } : {}),
})
