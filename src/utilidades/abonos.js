// Abonos de una venta (R38, migración 0088): cada pago es una fila (monto, fecha,
// nota) y el saldo se calcula: total de la venta menos lo abonado. Las cuotas son
// un plan de abonos iguales.
export const EVENTO_ABONO = "abono-factura:registrado"
// Un abono anulado sale de la lista sin recargar (detail: el id del abono).
export const EVENTO_ABONO_QUITADO = "abono-factura:quitado"
// Y entra a la lista de los anulados (detail: el abono ya mapeado, con su quién, cuándo y por qué).
export const EVENTO_ABONO_ANULADO = "abono-factura:anulado"

export function mapAbono(a) {
  return { id: a.id, facturaId: a.factura_id, monto: Number(a.monto), fecha: a.fecha, nota: a.nota || "", registradoPor: a.registrado_por || null, creadoEn: a.created_at, pagos: Array.isArray(a.pagos) ? a.pagos.map((p) => ({ metodo: p.metodo, monto: Number(p.monto) })) : null,
    // Anulado: el registro de pago no se borra; queda marcado (quién, cuándo y por qué). Original: lo que decía antes de su primera corrección.
    anuladoEn: a.anulado_en || null, anuladoPor: a.anulado_por || null, anuladoMotivo: a.anulado_motivo || "",
    montoOriginal: a.monto_original == null ? null : Number(a.monto_original), fechaOriginal: a.fecha_original || null }
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

// Lo que quedaría por cobrar de una venta si un abono pasara a valer `nuevoMonto` (0 = anularlo). Para avisar antes de enviar; el servidor lo vuelve a comprobar.
export function saldoTrasCorregir(factura, abonos, abonoId, nuevoMonto) {
  if (!factura || factura.estado === "anulada") return 0
  const otros = redondear(abonos.filter((a) => a.facturaId === factura.id && a.id !== abonoId).reduce((s, a) => s + a.monto, 0))
  return Math.max(0, redondear(factura.montoTotal - otros - (Number(nuevoMonto) || 0)))
}
