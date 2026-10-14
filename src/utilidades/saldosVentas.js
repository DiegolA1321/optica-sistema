// Listas del módulo de Ventas: saldos por cobrar por paciente y búsqueda de comprobantes.
// Lógica pura. El saldo de un comprobante sale de abonos.js; las ventas viejas (tabla `ventas`,
// sin filas hoy) se suman igual que en el resto del sistema.
import { saldoFactura, abonosDeFactura } from "./abonos"
import { pagosAlContado, pagosDeAbono, redondear } from "./pagos"
import { saldoVenta, ventasPendientesPaciente } from "./ventas"
import { numeroComprobante } from "./comprobantes"
import { esDeEsteMes } from "./inicio"
import { dinero } from "./formatoMoneda"
import { aEcuador } from "./horaEcuador"
import { fechaAISO } from "./disponibilidad"

const normalizar = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Pacientes con saldo pendiente, el mayor primero: [{ paciente, saldo, ventasPendientes, masAntigua }]
export function saldosPorPaciente({ pacientes = [], facturas = [], abonos = [], ventas = [] }) {
  const porPaciente = new Map()
  for (const f of facturas) {
    const s = saldoFactura(f, abonos)
    if (s <= 0) continue
    const e = porPaciente.get(f.pacienteId) || { saldo: 0, ventasPendientes: [], masAntigua: null }
    e.saldo += s
    e.ventasPendientes.push(f)
    if (!e.masAntigua || (f.creadoEn && f.creadoEn < e.masAntigua)) e.masAntigua = f.creadoEn || e.masAntigua
    porPaciente.set(f.pacienteId, e)
  }
  for (const p of pacientes) {
    const viejas = ventasPendientesPaciente(ventas, p.id)
    if (viejas.length === 0) continue
    const e = porPaciente.get(p.id) || { saldo: 0, ventasPendientes: [], masAntigua: null }
    e.saldo += viejas.reduce((a, v) => a + saldoVenta(v), 0)
    e.ventasViejas = viejas.length
    porPaciente.set(p.id, e)
  }
  return [...porPaciente.entries()]
    .map(([pacienteId, e]) => ({ paciente: pacientes.find((p) => p.id === pacienteId) || null, pacienteId, ...e, cantidadVentas: e.ventasPendientes.length + (e.ventasViejas || 0), saldo: Math.round(e.saldo * 100) / 100 }))
    .sort((a, b) => b.saldo - a.saldo)
}

export const totalPorCobrar = (saldos) => Math.round(saldos.reduce((a, s) => a + s.saldo, 0) * 100) / 100

// Los saldos por cobrar contados UNA sola vez, con el criterio de Ventas (comprobantes con saldo y ventas anteriores), para que el Inicio, la ventana
// de avisos, las tarjetas y la pestaña de Ventas digan lo mismo: "N ventas con saldo · M pacientes · $X".
export function resumenSaldos(saldos) {
  return { ventas: saldos.reduce((n, s) => n + s.cantidadVentas, 0), pacientes: saldos.length, total: totalPorCobrar(saldos) }
}
const plural = (n, uno, varios) => (n === 1 ? uno : varios)
// Sin el número de ventas del principio: "ventas con saldo · M pacientes · $X" (la ventana de avisos pone el número aparte, en negrita).
export const textoSaldosSinNumero = (r, { conTotal = true } = {}) => `${plural(r.ventas, "venta con saldo", "ventas con saldo")} · ${r.pacientes} ${plural(r.pacientes, "paciente", "pacientes")}${conTotal ? ` · ${dinero(r.total)}` : ""}`
export const textoSaldos = (r, opciones) => `${r.ventas} ${textoSaldosSinNumero(r, opciones)}`

// Búsqueda por paciente, cédula, número CV, número de factura electrónica o descripción de una línea.
// estado "vigentes" = todas menos las anuladas (lo que cuenta la tarjeta Ventas del Inicio); periodo "mes" = las de este mes.
export function filtrarComprobantes(facturas, { texto = "", estado = "todas", periodo = "todo", desde = "", hasta = "", sinFacturaElectronica = false, metodo = "", pacientes = [], abonos = [] } = {}) {
  const q = normalizar(texto).trim()
  const qCV = q.replace(/^cv-?/, "")
  return facturas
    .filter((f) => {
      if (estado === "vigentes" && f.estado === "anulada") return false
      if (periodo === "mes" && !esDeEsteMes(f.creadoEn)) return false
      // "rango": un período con fechas (llega desde Reportes); el día de la venta es el de Ecuador.
      if (periodo === "rango") { const dia = f.creadoEn ? fechaAISO(aEcuador(f.creadoEn)) : ""; if (!dia || (desde && dia < desde) || (hasta && dia > hasta)) return false }
      if (estado === "pagadas" && f.estado !== "pagada") return false
      if (estado === "saldo" && saldoFactura(f, abonos) <= 0) return false
      if (estado === "anuladas" && f.estado !== "anulada") return false
      if (sinFacturaElectronica && (f.facturaElectronica || f.estado === "anulada")) return false
      if (metodo && !metodosDeComprobante(f, abonos).includes(metodo)) return false
      if (!q) return true
      const p = pacientes.find((x) => x.id === f.pacienteId)
      const campos = [p?.nombre, p?.cedula, numeroComprobante(f.numero), f.facturaElectronica, ...(f.lineas || []).map((l) => l.descripcion)]
      if (campos.some((c) => normalizar(c).includes(q))) return true
      return /^\d+$/.test(qCV) && f.numero != null && f.numero === Number(qCV)
    })
    .slice()
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : (b.numero || 0) - (a.numero || 0)))
}

// Con qué métodos se cobró un comprobante (lo pagado al contado y cada abono): ["efectivo", "tarjeta", "sin_indicar"…].
export function metodosDeComprobante(factura, abonos = []) {
  const propios = abonosDeFactura(factura.id, abonos)
  const listas = propios.map(pagosDeAbono)
  if (factura.estado === "pagada") {
    const resto = redondear((Number(factura.montoTotal) || 0) - propios.reduce((s, a) => s + a.monto, 0))
    if (resto > 0) listas.push(pagosAlContado(factura, resto))
  }
  return [...new Set(listas.flat().map((p) => p.metodo))]
}

// El estado de un comprobante como lo dice la pantalla: Pagada, Con saldo (con su monto) o Anulada.
export function estadoDeComprobante(factura, abonos = []) {
  if (factura.estado === "anulada") return { id: "anulada", etiqueta: "Anulada", saldo: 0 }
  const saldo = saldoFactura(factura, abonos)
  if (saldo > 0) return { id: "saldo", etiqueta: "Con saldo", saldo }
  return { id: "pagada", etiqueta: "Pagada", saldo: 0 }
}
