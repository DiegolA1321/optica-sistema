// «Cómo llegó» un paciente: una sola regla para el perfil (franja del Resumen) y para Reportes («Cómo llegan los pacientes nuevos»), así los números coinciden.
// Referido por otro paciente; si no, por la web (se registró él mismo en el portal o en la página pública); si no, por su cuenta. Nunca queda vacío.
import { enRango } from "./reportesPeriodo"

export const COMO_LLEGO = [
  { id: "referido", etiqueta: "Referidos", color: "#2563eb" },
  { id: "web", etiqueta: "Por la web", color: "#0891b2" },
  { id: "propio", etiqueta: "Por su cuenta", color: "#64748b" },
]

const normal = (t) => String(t ?? "").trim().toLowerCase()

export function comoLlego(paciente, pacientes = []) {
  const refId = paciente?.referidoPorId
  const refNombre = String(paciente?.referidoPor ?? "").trim()
  if (refId || refNombre) {
    const referente = pacientes.find((p) => refId && p.id === refId) || (refNombre ? pacientes.find((p) => normal(p.nombre) === normal(refNombre)) : null) || null
    return { tipo: "referido", texto: `Referido por ${referente?.nombre || refNombre || "otro paciente"}`, detalle: "lo trajo un paciente", referente }
  }
  if (paciente?.origen === "paciente") return { tipo: "web", texto: "Por la web", detalle: "se registró en línea", referente: null }
  return { tipo: "propio", texto: "Por su cuenta", detalle: "sin referido", referente: null }
}

// Los pacientes de la lista (los registrados en el rango, si se da) repartidos por cómo llegaron: { referido: [], web: [], propio: [] }. `todos` sirve para buscar a quien refirió.
export function pacientesPorLlegada(lista = [], rango = null, todos = lista) {
  const r = { referido: [], web: [], propio: [] }
  for (const p of lista) {
    if (rango && !enRango(p.fechaRegistro, rango)) continue
    r[comoLlego(p, todos).tipo].push(p)
  }
  return r
}

// La tendencia por mes (del más antiguo al más reciente) de los pacientes ya repartidos: [{ clave: "2026-10", referido, web, propio, total, pacientes: {referido:[…],…} }]
export function llegadaPorMes(porLlegada) {
  const meses = new Map()
  for (const tipo of ["referido", "web", "propio"]) {
    for (const p of porLlegada[tipo]) {
      const clave = String(p.fechaRegistro || "").slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(clave)) continue
      if (!meses.has(clave)) meses.set(clave, { clave, referido: 0, web: 0, propio: 0, total: 0, pacientes: { referido: [], web: [], propio: [] } })
      const m = meses.get(clave)
      m[tipo]++
      m.total++
      m.pacientes[tipo].push(p)
    }
  }
  return [...meses.values()].sort((a, b) => (a.clave < b.clave ? -1 : 1))
}
