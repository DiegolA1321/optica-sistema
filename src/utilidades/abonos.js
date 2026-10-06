// Abonos de una venta (R38, migración 0088): cada pago es una fila (monto, fecha,
// nota) y el saldo se calcula: total de la venta menos lo abonado. Las cuotas son
// un plan de abonos iguales.
export const EVENTO_ABONO = "abono-factura:registrado"

export function mapAbono(a) {
  return { id: a.id, facturaId: a.factura_id, monto: Number(a.monto), fecha: a.fecha, nota: a.nota || "", registradoPor: a.registrado_por || null, creadoEn: a.created_at }
}

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100

export const abonosDeFactura = (facturaId, abonos) => abonos.filter((a) => a.facturaId === facturaId).slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : a.creadoEn < b.creadoEn ? -1 : 1))
export const totalAbonado = (facturaId, abonos) => redondear(abonos.filter((a) => a.facturaId === facturaId).reduce((s, a) => s + a.monto, 0))

// Lo que falta por cobrar de una venta: 0 si está pagada o anulada.
export function saldoFactura(factura, abonos) {
  if (!factura || factura.estado !== "pendiente_pago") return 0
  return Math.max(0, redondear(factura.montoTotal - totalAbonado(factura.id, abonos)))
}

export const saldoPacienteFacturas = (pacienteId, facturas, abonos) =>
  redondear(facturas.filter((f) => f.pacienteId === pacienteId).reduce((s, f) => s + saldoFactura(f, abonos), 0))

// Valor sugerido para el próximo abono: la cuota si es un plan de cuotas (la última, el saldo exacto); si no, el saldo.
export function abonoSugerido(factura, abonos) {
  const saldo = saldoFactura(factura, abonos)
  if (factura?.metodoPago === "cuotas" && factura.cuotasTotales) {
    const restantes = factura.cuotasTotales - (factura.cuotasPagadas || 0)
    if (restantes <= 1) return saldo
    return Math.min(saldo, redondear(factura.montoTotal / factura.cuotasTotales))
  }
  return saldo
}
