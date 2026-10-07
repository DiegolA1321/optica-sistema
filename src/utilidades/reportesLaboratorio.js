// Reportes de laboratorio y de lunas: lógica pura.
import { estaAtrasada } from "./ordenesLaboratorio"
import { TIPOS_LENTE } from "./ordenesLaboratorio"

const DIA = 86400000
const SIN_LAB = "Sin laboratorio"
const nombreLab = (o) => (o.laboratorio || "").trim() || SIN_LAB

// Fecha en que la orden pasó a "entregada" (según su historial), o null.
export const entregadaEn = (o) => {
  const h = (o.historial || []).filter((x) => x.estado === "entregada").map((x) => x.cambiadoEn).sort()
  return h.length ? h[h.length - 1] : null
}

// Días entre crearse la orden y entregarse (puede ser fracción; nunca negativo).
export const diasDeEntrega = (o) => {
  const fin = entregadaEn(o)
  if (!fin || !o.creadaEn) return null
  return Math.max(0, (new Date(fin) - new Date(o.creadaEn)) / DIA)
}

// Por laboratorio: abiertas, atrasadas y tiempo promedio de entrega (en días) de las entregadas.
// `enRango(fechaISO)` limita las ENTREGADAS al período (por fecha de entrega); las atrasadas son el estado actual.
export function resumenPorLaboratorio(ordenes = [], { hoy = new Date(), enRango = () => true } = {}) {
  const mapa = new Map()
  const fila = (lab) => {
    if (!mapa.has(lab)) mapa.set(lab, { laboratorio: lab, abiertas: 0, atrasadas: 0, entregadas: 0, sumaDias: 0 })
    return mapa.get(lab)
  }
  for (const o of ordenes) {
    const f = fila(nombreLab(o))
    if (o.estado === "enviada" || o.estado === "lista") f.abiertas++
    if (estaAtrasada(o, hoy)) f.atrasadas++
    if (o.estado === "entregada") {
      const d = diasDeEntrega(o)
      const cuando = entregadaEn(o)
      if (d != null && enRango(cuando)) { f.entregadas++; f.sumaDias += d }
    }
  }
  return [...mapa.values()]
    .map((f) => ({ laboratorio: f.laboratorio, abiertas: f.abiertas, atrasadas: f.atrasadas, entregadas: f.entregadas, promedioDias: f.entregadas ? f.sumaDias / f.entregadas : null }))
    .filter((f) => f.abiertas > 0 || f.entregadas > 0)
    .sort((a, b) => b.atrasadas - a.atrasadas || b.abiertas - a.abiertas || a.laboratorio.localeCompare(b.laboratorio))
}

// Productos (monturas y accesorios) más vendidos por unidades, de los comprobantes de venta no anulados
// y de las ventas sueltas de Inventario. Sin esto el ranking se quedaba vacío con ventas reales.
export function productosMasVendidos({ facturas = [], ventas = [], enRango = () => true, limite = 5 } = {}) {
  const mapa = new Map()
  const sumar = (nombre, cantidad) => mapa.set(nombre, (mapa.get(nombre) || 0) + (Number(cantidad) || 1))
  for (const f of facturas) {
    if (f.estado === "anulada" || !enRango(f.creadoEn)) continue
    for (const l of f.lineas || []) if (l.tipo === "producto") sumar(l.descripcion || "Producto sin nombre", l.cantidad)
  }
  for (const v of ventas) if (enRango(v.creadoEn)) sumar(v.productoNombre || "Producto sin nombre", v.cantidad)
  return [...mapa.entries()].map(([label, valor]) => ({ label, valor })).sort((a, b) => b.valor - a.valor || a.label.localeCompare(b.label)).slice(0, limite)
}

// Lunas vendidas por tipo (monofocal, bifocal, progresivo, otro/sin tipo): unidades y, si se piden, monto.
// Solo comprobantes no anulados; una línea de luna lleva `detalle.tipo_lente`.
export function ventasPorTipoLuna(facturas = [], { enRango = () => true } = {}) {
  const mapa = new Map()
  for (const f of facturas) {
    if (f.estado === "anulada" || !enRango(f.creadoEn)) continue
    for (const l of f.lineas || []) {
      if (l.tipo !== "luna") continue
      const id = TIPOS_LENTE.some((t) => t.id === l.detalle?.tipo_lente) ? l.detalle.tipo_lente : "otro"
      const a = mapa.get(id) || { id, unidades: 0, monto: 0 }
      const cant = Number(l.cantidad) || 1
      a.unidades += cant
      a.monto += cant * (Number(l.precioUnitario) || 0)
      mapa.set(id, a)
    }
  }
  return [...mapa.values()]
    .map((a) => ({ ...a, etiqueta: TIPOS_LENTE.find((t) => t.id === a.id)?.label || "Sin tipo indicado" }))
    .sort((a, b) => b.unidades - a.unidades || a.etiqueta.localeCompare(b.etiqueta))
}
