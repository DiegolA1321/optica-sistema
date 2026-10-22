// El programa de fidelización de la óptica (decisión del 21 oct. 2026): para qué sirve (premiar a quien vuelve y recomienda), cómo se ganan los puntos y qué beneficio da cada nivel.
// Lo configura el administrador en Configuración y se guarda en los ajustes de la óptica (`parametrizacion.fidelizacion`); sin configurar vale la regla de abajo. Una sola cuenta para el Resumen
// del paciente, el ranking del CRM, «Nueva venta» y el portal. Lógica pura.
import { contarConsultas, contarReferidos } from "./fidelizacion"
import { saldoFactura } from "./abonos"

export const PROGRAMA_POR_DEFECTO = {
  activo: true,
  porConsulta: 10, // puntos por consulta atendida
  porReferido: 15, // puntos por cada paciente que refiere
  dolaresPorPunto: 10, // 1 punto por cada $10 pagados
  niveles: [
    { id: "nuevo", nombre: "Nuevo", desde: 0, descuento: 0 },
    { id: "frecuente", nombre: "Frecuente", desde: 30, descuento: 5 },
    { id: "preferente", nombre: "Preferente", desde: 90, descuento: 10 },
  ],
}

const num = (v, defecto) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : defecto }

// El programa vigente: lo configurado sobre la regla por defecto (valores que no sirven vuelven a la regla), con los niveles ordenados y el primero desde 0.
export function programaDe(parametrizacion) {
  const g = parametrizacion?.fidelizacion || {}
  const base = PROGRAMA_POR_DEFECTO
  const niveles = (Array.isArray(g.niveles) && g.niveles.length >= 1 ? g.niveles : base.niveles).map((n, i) => ({
    id: n.id || `nivel-${i}`, nombre: String(n.nombre || base.niveles[i]?.nombre || `Nivel ${i + 1}`).trim().slice(0, 30) || `Nivel ${i + 1}`,
    desde: num(n.desde, base.niveles[i]?.desde ?? 0), descuento: Math.min(100, num(n.descuento, 0)),
  })).sort((a, b) => a.desde - b.desde).map((n, i) => (i === 0 ? { ...n, desde: 0 } : n))
  return {
    activo: g.activo !== false,
    porConsulta: num(g.porConsulta, base.porConsulta),
    porReferido: num(g.porReferido, base.porReferido),
    dolaresPorPunto: Math.max(1, num(g.dolaresPorPunto, base.dolaresPorPunto)),
    niveles,
  }
}

// Lo que no se puede guardar en la configuración: texto del problema o "".
export function errorDePrograma(p) {
  for (const [k, t] of [["porConsulta", "Los puntos por consulta"], ["porReferido", "Los puntos por referido"]]) if (!(Number(p[k]) >= 0) || !Number.isInteger(Number(p[k]))) return `${t} deben ser un número entero (0 o más).`
  if (!(Number(p.dolaresPorPunto) >= 1)) return "Los dólares por punto deben ser 1 o más."
  const n = p.niveles || []
  if (n.length < 1) return "Define al menos un nivel."
  for (let i = 0; i < n.length; i++) {
    if (!String(n[i].nombre || "").trim()) return `El nivel ${i + 1} necesita un nombre.`
    if (!(Number(n[i].descuento) >= 0 && Number(n[i].descuento) <= 100)) return `El descuento de «${n[i].nombre}» debe estar entre 0 y 100 %.`
    if (i > 0 && !(Number(n[i].desde) > Number(n[i - 1].desde))) return `Los puntos de «${n[i].nombre}» deben ser más que los del nivel anterior.`
  }
  return ""
}

// Dólares que el paciente ya pagó: lo de sus comprobantes (sin anuladas) menos lo que todavía debe.
export function dolaresPagados(pacienteId, facturas = [], abonos = []) {
  const t = facturas.filter((f) => f.pacienteId === pacienteId && f.estado !== "anulada").reduce((s, f) => s + (Number(f.montoTotal) || 0) - saldoFactura(f, abonos), 0)
  return Math.max(0, Math.round(t * 100) / 100)
}

// Los puntos de un paciente y de dónde salen: { total, consultas: { n, puntos }, referidos: { n, puntos }, compras: { dolares, puntos } }.
export function puntosDe({ paciente, consultas = [], pacientes = [], facturas = [], abonos = [], programa = PROGRAMA_POR_DEFECTO }) {
  const nC = contarConsultas(paciente, consultas)
  const nR = contarReferidos(paciente, pacientes)
  const dolares = dolaresPagados(paciente.id, facturas, abonos)
  const c = { n: nC, puntos: nC * programa.porConsulta }
  const r = { n: nR, puntos: nR * programa.porReferido }
  const compras = { dolares, puntos: Math.floor(dolares / programa.dolaresPorPunto) }
  return { total: c.puntos + r.puntos + compras.puntos, consultas: c, referidos: r, compras }
}

// El nivel que corresponde a esos puntos, el siguiente y cuánto falta: { nivel, siguiente, faltan }.
export function nivelDe(puntos, programa = PROGRAMA_POR_DEFECTO) {
  const niveles = programa.niveles
  let idx = 0
  niveles.forEach((n, i) => { if (puntos >= n.desde) idx = i })
  const siguiente = niveles[idx + 1] || null
  return { nivel: niveles[idx], siguiente, faltan: siguiente ? Math.max(0, siguiente.desde - puntos) : 0 }
}

// El descuento que sugiere «Nueva venta» a este paciente: su nivel si tiene beneficio, o null.
export function beneficioDe(datos, programa = PROGRAMA_POR_DEFECTO) {
  if (!programa.activo) return null
  const { total } = puntosDe({ ...datos, programa })
  const { nivel } = nivelDe(total, programa)
  return nivel.descuento > 0 ? { nivel, puntos: total, descuento: nivel.descuento } : null
}

// Lo que el paciente ve de sus puntos en el portal (con las reglas del programa de la óptica): los puntos, su nivel, cuánto falta para el siguiente y su descuento.
// `compras`: las del portal (cada una con total y saldo). Misma cuenta que el Resumen del paciente y el CRM.
export function resumenDePuntosPrograma({ nConsultas = 0, nReferidos = 0, compras = [], programa = PROGRAMA_POR_DEFECTO }) {
  const dolares = Math.max(0, Math.round(compras.filter((c) => c.estado !== "anulada").reduce((s, c) => s + (Number(c.total) || 0) - (Number(c.saldo) || 0), 0) * 100) / 100)
  const porCompras = Math.floor(dolares / programa.dolaresPorPunto)
  const puntos = nConsultas * programa.porConsulta + nReferidos * programa.porReferido + porCompras
  const { nivel, siguiente, faltan } = nivelDe(puntos, programa)
  const desde = nivel.desde
  const porcentaje = siguiente ? Math.min(100, Math.round(((puntos - desde) / Math.max(1, siguiente.desde - desde)) * 100)) : 100
  return {
    puntos, consultas: nConsultas, referidos: nReferidos, dolares, porCompras, nivel, siguiente, faltan, porcentaje, frecuente: !siguiente, programa,
    texto: siguiente ? `Te faltan ${faltan} punto${faltan === 1 ? "" : "s"} para el nivel ${siguiente.nombre}` : `Eres cliente ${nivel.nombre}`,
  }
}
