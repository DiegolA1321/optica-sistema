// Cálculos derivados de ventas — compartidos entre Inventario.jsx (reporte
// por producto) y Pacientes.jsx (pagos pendientes en la ficha del paciente).
// Ver migración 0047_ventas_productos.sql para el esquema de la tabla.

export const METODOS_PAGO = { directo: "Pago directo", tarjeta: "Tarjeta", cuotas: "Cuotas" }

// Saldo pendiente de una venta puntual. En "cuotas" se prorratea el monto
// total entre las cuotas pactadas; en directo/tarjeta el saldo es todo o nada.
export function saldoVenta(venta) {
  if (venta.estado === "completado") return 0
  if (venta.metodoPago === "cuotas" && venta.cuotasTotales) {
    const porCuota = Number(venta.montoTotal) / venta.cuotasTotales
    const pagado = porCuota * (Number(venta.cuotasPagadas) || 0)
    return Math.max(0, Number(venta.montoTotal) - pagado)
  }
  return Number(venta.montoTotal) || 0
}

// Reporte por producto: unidades vendidas, ingreso total, pacientes
// distintos que lo compraron, cuántas ventas de ese producto siguen con
// saldo pendiente.
export function resumenVentasProducto(ventas, productoId) {
  const delProducto = ventas.filter((v) => v.productoId === productoId)
  const pacientesUnicos = new Set(delProducto.map((v) => v.pacienteId))
  const unidades = delProducto.reduce((a, v) => a + (Number(v.cantidad) || 0), 0)
  const ingreso = delProducto.reduce((a, v) => a + (Number(v.montoTotal) || 0), 0)
  const pendientes = delProducto.filter((v) => v.estado === "pendiente")
  return {
    ventas: delProducto.slice().sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1)),
    unidades,
    ingreso,
    pacientes: pacientesUnicos.size,
    pendientes: pendientes.length,
  }
}

// Ventas con saldo pendiente de un paciente — para el bloque "Pagos
// pendientes" de su ficha.
export function ventasPendientesPaciente(ventas, pacienteId) {
  return ventas
    .filter((v) => v.pacienteId === pacienteId && v.estado === "pendiente")
    .slice()
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
}
