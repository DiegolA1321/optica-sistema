// La lista de Ventas (pestaña «Ventas»): lo que dice cada fila, la franja de datos de arriba y qué lista abre cada dato. Lógica pura.
// Una sola cuenta para todo (regla 5): vendido = cobrado + por cobrar, y cada dato de la franja cuenta lo mismo que la lista a la que lleva.
import { saldoFactura } from "./abonos"
import { redondear } from "./pagos"
import { esLineaDeLente, estaAtrasada } from "./ordenesLaboratorio"

// Lo que cobró una venta hasta hoy: su total menos lo que falta. Una venta anulada no cobró nada.
export const pagadoDeVenta = (factura, abonos = []) => (factura?.estado === "anulada" ? 0 : redondear((Number(factura?.montoTotal) || 0) - saldoFactura(factura, abonos)))

// Lo que los pacientes dicen haber transferido de esta venta y todavía nadie revisó.
export const porVerificarDeVenta = (factura, pagosPorVerificar = []) => redondear(pagosPorVerificar.filter((p) => p.facturaId === factura?.id).reduce((s, p) => s + (Number(p.monto) || 0), 0))

// El estado del pago como lo dice la fila: «Pagada», «Debe $145.00», «Verificar $50.00» o «Anulada».
export function estadoPagoDeVenta(factura, abonos = [], pagosPorVerificar = []) {
  if (factura?.estado === "anulada") return { id: "anulada", etiqueta: "Anulada", tono: "gris", monto: 0 }
  const saldo = saldoFactura(factura, abonos)
  if (saldo <= 0) return { id: "pagada", etiqueta: "Pagada", tono: "verde", monto: 0 }
  const porVerificar = porVerificarDeVenta(factura, pagosPorVerificar)
  if (porVerificar > 0) return { id: "verificar", etiqueta: "Verificar", tono: "ambar", monto: Math.min(porVerificar, saldo) }
  return { id: "debe", etiqueta: "Debe", tono: "rojo", monto: saldo }
}

const LENTES_POR_TIPO = { monofocal: "monofocales", bifocal: "bifocales", progresivo: "progresivos" }
const TRATAMIENTOS = [["antirreflejo", "antirreflejo"], ["filtro_azul", "filtro azul"], ["fotocromatico", "fotocromático"]]

// Qué se vendió, en dos líneas: «Lentes progresivos» y debajo «Montura Ray-Ban · lunas filtro azul»; sin lunas, lo que se llevó («Estuche y líquido» y «2 productos»).
export function detalleDeVenta(factura) {
  const lineas = factura?.lineas || []
  if (lineas.length === 0) return { titulo: "Venta", sub: "" }
  const lunas = lineas.filter(esLineaDeLente)
  const otras = lineas.filter((l) => !esLineaDeLente(l))
  if (lunas.length > 0) {
    const d = lunas[0].detalle || {}
    const tratamientos = TRATAMIENTOS.filter(([campo]) => d[campo]).map(([, texto]) => texto)
    if (d.otros_tratamientos) tratamientos.push(String(d.otros_tratamientos).trim())
    return {
      titulo: LENTES_POR_TIPO[d.tipo_lente] ? `Lentes ${LENTES_POR_TIPO[d.tipo_lente]}` : "Lentes",
      sub: [...otras.map((l) => l.descripcion), tratamientos.length > 0 && `lunas ${tratamientos.join(", ")}`].filter(Boolean).join(" · "),
    }
  }
  if (lineas.length === 1) { const l = lineas[0]; return { titulo: l.descripcion, sub: Number(l.cantidad) > 1 ? `${l.cantidad} u.` : "" } }
  return { titulo: lineas.slice(0, 2).map((l) => l.descripcion).join(" y "), sub: `${lineas.length} productos` }
}

// El período con el que abre la lista de ventas.
export const PERIODO_DE_VENTAS = { filtro: "mes", ref: "", desde: "", hasta: "" }

// ¿Esta venta cuenta en ese dato de la franja?
export function ventaDelDato(factura, dato, abonos = [], pagosPorVerificar = []) {
  if (factura.estado === "anulada") return false
  if (dato === "cobrado") return saldoFactura(factura, abonos) <= 0
  if (dato === "porcobrar") return saldoFactura(factura, abonos) > 0
  if (dato === "verificar") return porVerificarDeVenta(factura, pagosPorVerificar) > 0 && saldoFactura(factura, abonos) > 0
  return true
}

// La franja de arriba, sobre las ventas que se ven (ya con el período, la búsqueda y los filtros; sin el dato que se pulsó, para que las cifras no cambien al pulsarlas).
export function resumenDeVentas({ ventas = [], abonos = [], pagosPorVerificar = [], ordenes = [] } = {}) {
  const vigentes = ventas.filter((f) => f.estado !== "anulada")
  const ids = new Set(vigentes.map((f) => f.id))
  const vendido = redondear(vigentes.reduce((s, f) => s + (Number(f.montoTotal) || 0), 0))
  const porCobrar = redondear(vigentes.reduce((s, f) => s + saldoFactura(f, abonos), 0))
  const conSaldo = vigentes.filter((f) => saldoFactura(f, abonos) > 0).length
  const verificar = pagosPorVerificar.filter((p) => ids.has(p.facturaId))
  const enProceso = ordenes.filter((o) => ids.has(o.facturaId) && o.estado === "enviada")
  return {
    ventas: vigentes.length, vendido, cobrado: redondear(vendido - porCobrar), porCobrar, conSaldo,
    cobradas: vigentes.length - conSaldo,
    porVerificar: redondear(verificar.reduce((s, p) => s + (Number(p.monto) || 0), 0)), transferencias: verificar.length,
    ventasPorVerificar: vigentes.filter((f) => ventaDelDato(f, "verificar", abonos, pagosPorVerificar)).length,
    enProceso: enProceso.length, atrasados: enProceso.filter((o) => estaAtrasada(o)).length,
  }
}
