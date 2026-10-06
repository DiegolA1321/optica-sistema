// Un solo formato de fecha legible para el perfil del paciente y las
// pantallas que lo usan: "15 sept 2026" (y "15 sept" en su versión corta).
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]

// Acepta "AAAA-MM-DD" (fecha sin hora, sin corrimiento de zona horaria), un
// texto con hora (timestamptz) o un Date. Devuelve null si no hay fecha válida.
function partes(valor) {
  if (!valor) return null
  if (typeof valor === "string" && /^\d{4}-\d{2}-\d{2}/.test(valor) && (valor.length === 10 || valor[10] === "T" && /T00:00:00(\.000)?Z?$/.test(valor.slice(10)))) {
    const [a, m, d] = valor.slice(0, 10).split("-").map(Number)
    return { anio: a, mes: m, dia: d }
  }
  const f = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(f.getTime())) return null
  return { anio: f.getFullYear(), mes: f.getMonth() + 1, dia: f.getDate() }
}

export function fechaLegible(valor) {
  const p = partes(valor)
  return p ? `${p.dia} ${MESES[p.mes - 1]} ${p.anio}` : ""
}

export function fechaCorta(valor) {
  const p = partes(valor)
  return p ? `${p.dia} ${MESES[p.mes - 1]}` : ""
}
