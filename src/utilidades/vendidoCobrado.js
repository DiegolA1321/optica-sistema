// "Vendido" y "Cobrado" de las ventas: DOS números con DOS nombres, calculados en un solo lugar para que el Inicio y Reportes no digan distinto.
//  - Vendido: el monto total de las ventas del período (sin las anuladas).
//  - Cobrado: lo que de esas ventas ya se pagó: una venta pagada cuenta completa; una con saldo, solo sus abonos (las cuotas pagadas son abonos).
// Las ventas anteriores (tabla `ventas`, una venta = un producto, sin filas hoy) se cuentan como cobradas por completo.
import { totalAbonado } from "./abonos"

const redondear = (n) => Math.round(n * 100) / 100

export function cobradoDeFactura(factura, abonos = []) {
  if (factura.estado === "pagada") return Number(factura.montoTotal) || 0
  if (factura.estado === "pendiente_pago") return totalAbonado(factura.id, abonos)
  return 0
}

// facturas / ventasViejas: ya acotadas al período por quien llama (`enPeriodo` decide si una fecha de alta cae dentro).
export function vendidoYCobrado({ facturas = [], ventasViejas = [], abonos = [], enPeriodo = () => true }) {
  const delPeriodo = facturas.filter((f) => f.estado !== "anulada" && enPeriodo(f.creadoEn))
  const viejas = ventasViejas.filter((v) => enPeriodo(v.creadoEn))
  const sumaViejas = viejas.reduce((n, v) => n + (Number(v.montoTotal) || 0), 0)
  return {
    cantidad: delPeriodo.length + viejas.length,
    vendido: redondear(delPeriodo.reduce((n, f) => n + (Number(f.montoTotal) || 0), 0) + sumaViejas),
    cobrado: redondear(delPeriodo.reduce((n, f) => n + cobradoDeFactura(f, abonos), 0) + sumaViejas),
  }
}
