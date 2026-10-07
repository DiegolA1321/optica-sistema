// Reportes de diagnósticos (R60) y filtro por motivo de consulta (R61): lógica pura.
// Se cuentan PACIENTES distintos por diagnóstico (no fichas): "cuántos pacientes tuvieron miopía".
const clave2 = (n) => String(n).padStart(2, "0")

// Categorías de la ficha; cae al texto libre solo en fichas viejas sin categorías.
export const categoriasDeConsulta = (c) => {
  if (c?.diagnosticoCategorias?.length > 0) return c.diagnosticoCategorias
  const t = (c?.diagnostico || "").trim()
  return t ? [t] : []
}

// Motivos que aparecen en las consultas (más frecuentes primero), para el filtro de Reportes.
export function motivosEnConsultas(consultas = []) {
  const cuenta = new Map()
  for (const c of consultas) {
    const m = (c.motivo || "").trim()
    if (m) cuenta.set(m, (cuenta.get(m) || 0) + 1)
  }
  return [...cuenta.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([motivo, cantidad]) => ({ motivo, cantidad }))
}

export const filtrarPorMotivo = (consultas, motivo) => (motivo ? consultas.filter((c) => (c.motivo || "").trim() === motivo) : consultas)

// Años con consultas (el más reciente primero); siempre incluye el año dado.
export function aniosConConsultas(consultas = [], anioActual = new Date().getFullYear()) {
  const s = new Set([anioActual])
  for (const c of consultas) { const a = Number((c.fecha || "").slice(0, 4)); if (a) s.add(a) }
  return [...s].sort((a, b) => b - a)
}

// Por diagnóstico: pacientes distintos en cada mes del año y en el año completo.
// Devuelve { filas: [{ diagnostico, meses: [12], anio }], maxMes, totalPacientes }
export function diagnosticosPorMes(consultas = [], anio) {
  const porDx = new Map()
  const pacientesAnio = new Set()
  for (const c of consultas) {
    if (!c.fecha || Number(c.fecha.slice(0, 4)) !== anio) continue
    const mes = Number(c.fecha.slice(5, 7)) - 1
    if (!(mes >= 0 && mes < 12)) continue
    const quien = c.pacienteId ?? `c${c.id}`
    pacientesAnio.add(quien)
    for (const dx of categoriasDeConsulta(c)) {
      if (!porDx.has(dx)) porDx.set(dx, { meses: Array.from({ length: 12 }, () => new Set()), anio: new Set() })
      const f = porDx.get(dx)
      f.meses[mes].add(quien)
      f.anio.add(quien)
    }
  }
  const filas = [...porDx.entries()]
    .map(([diagnostico, f]) => ({ diagnostico, meses: f.meses.map((s) => s.size), anio: f.anio.size }))
    .sort((a, b) => b.anio - a.anio || a.diagnostico.localeCompare(b.diagnostico))
  return { filas, maxMes: Math.max(0, ...filas.flatMap((f) => f.meses)), totalPacientes: pacientesAnio.size }
}

export { clave2 }
