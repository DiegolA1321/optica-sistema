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

// Hora de un instante en el formato único de la app: "08:19 AM" (12 h, con cero a la izquierda).
export function horaLegible(valor) {
  const f = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(f.getTime())) return ""
  const h = f.getHours()
  return `${String(h % 12 === 0 ? 12 : h % 12).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`
}

// "7 oct, 08:19 AM" (o "7 oct 2026, 08:19 AM" con anio: true) para registros con fecha y hora.
export function fechaHoraLegible(valor, { anio = false } = {}) {
  const f = valor instanceof Date ? valor : new Date(valor)
  if (Number.isNaN(f.getTime())) return ""
  return `${anio ? fechaLegible(f) : fechaCorta(f)}, ${horaLegible(f)}`
}
