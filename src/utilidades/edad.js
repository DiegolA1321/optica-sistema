// Edad en años cumplidos a partir de una fecha de nacimiento ("AAAA-MM-DD" o Date). null si no hay fecha válida.
export function edadEnAnios(nacimiento, hoy = new Date()) {
  if (!nacimiento) return null
  const n = nacimiento instanceof Date ? nacimiento : (() => { const [a, m, d] = String(nacimiento).slice(0, 10).split("-").map(Number); return a && m && d ? new Date(a, m - 1, d) : null })()
  if (!n || Number.isNaN(n.getTime())) return null
  let edad = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--
  return edad >= 0 ? edad : null
}
