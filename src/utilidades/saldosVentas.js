// Listas del módulo de Ventas: saldos por cobrar por paciente y búsqueda de comprobantes.
// Lógica pura. El saldo de un comprobante sale de abonos.js; las ventas viejas (tabla `ventas`,
// sin filas hoy) se suman igual que en el resto del sistema.
import { saldoFactura } from "./abonos"
import { saldoVenta, ventasPendientesPaciente } from "./ventas"
import { numeroComprobante } from "./comprobantes"

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
    porPaciente.set(p.id, e)
  }
  return [...porPaciente.entries()]
    .map(([pacienteId, e]) => ({ paciente: pacientes.find((p) => p.id === pacienteId) || null, pacienteId, ...e, saldo: Math.round(e.saldo * 100) / 100 }))
    .sort((a, b) => b.saldo - a.saldo)
}

export const totalPorCobrar = (saldos) => Math.round(saldos.reduce((a, s) => a + s.saldo, 0) * 100) / 100

// Búsqueda por paciente, cédula, número CV, número de factura electrónica o descripción de una línea.
export function filtrarComprobantes(facturas, { texto = "", estado = "todas", sinFacturaElectronica = false, pacientes = [], abonos = [] } = {}) {
  const q = normalizar(texto).trim()
  const qCV = q.replace(/^cv-?/, "")
  return facturas
    .filter((f) => {
      if (estado === "pagadas" && f.estado !== "pagada") return false
      if (estado === "saldo" && saldoFactura(f, abonos) <= 0) return false
      if (estado === "anuladas" && f.estado !== "anulada") return false
      if (sinFacturaElectronica && (f.facturaElectronica || f.estado === "anulada")) return false
      if (!q) return true
      const p = pacientes.find((x) => x.id === f.pacienteId)
      const campos = [p?.nombre, p?.cedula, numeroComprobante(f.numero), f.facturaElectronica, ...(f.lineas || []).map((l) => l.descripcion)]
      if (campos.some((c) => normalizar(c).includes(q))) return true
      return /^\d+$/.test(qCV) && f.numero != null && f.numero === Number(qCV)
    })
    .slice()
    .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : a.creadoEn > b.creadoEn ? -1 : (b.numero || 0) - (a.numero || 0)))
}
