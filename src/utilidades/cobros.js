// "Cobros y saldos": el dinero que entró en un día, por método de pago (para cuadrar la caja), y lo que se debe por paciente.
// Usa la misma lista de pagos que Reportes (pagosDeFacturas), así "Cobrado hoy" coincide con "Cobros del período" de Reportes.
import { pagosDeFacturas } from "./reportesDatos"
import { redondear, totalesPorMetodo, textoPagos } from "./pagos"
import { numeroComprobante } from "./comprobantes"

// Todos los cobros de un día ("AAAA-MM-DD"): cada abono, y lo que se pagó al contado el día de la venta. Las ventas anuladas no cuentan.
export function cobrosDelDia({ facturas = [], abonos = [], dia }) {
  const filas = pagosDeFacturas(facturas, abonos).filter((p) => p.fecha === dia)
    .sort((a, b) => (a.factura?.numero ?? 0) - (b.factura?.numero ?? 0))
  return {
    dia,
    filas,
    cantidad: filas.length,
    total: redondear(filas.reduce((s, p) => s + p.monto, 0)),
    porMetodo: totalesPorMetodo(filas.map((p) => p.pagos)),
  }
}

export const conceptoDelCobro = (p) => (p.esAbono ? "Abono" : "Pago de la venta")

// Las columnas del Excel de "Cobrado hoy": una fila por cobro, con cómo se pagó.
export function filasParaExcel(cobros, { pacientes = [], equipoNombre = () => "" } = {}) {
  return cobros.filas.map((p) => ({
    paciente: pacientes.find((x) => x.id === p.factura?.pacienteId)?.nombre || "",
    comprobante: numeroComprobante(p.factura?.numero),
    concepto: conceptoDelCobro(p),
    monto: p.monto,
    forma: textoPagos(p.pagos),
    registro: equipoNombre(p.esAbono ? p.abono?.registradoPor : p.factura?.registradoPor) || "",
  }))
}

// Saldos por paciente con lo que decide el orden: los que ya tienen sus lentes listos para entregar van primero (cobrar es lo que falta
// para entregárselos); dentro de cada grupo, el que más debe.
export function saldosConEntrega(saldos = [], ordenes = []) {
  const listas = ordenes.filter((o) => o.estado === "lista")
  return saldos
    .map((s) => ({ ...s, ordenesListas: listas.filter((o) => s.ventasPendientes.some((f) => f.id === o.facturaId)) }))
    .sort((a, b) => (b.ordenesListas.length > 0) - (a.ordenesListas.length > 0) || b.saldo - a.saldo)
}
