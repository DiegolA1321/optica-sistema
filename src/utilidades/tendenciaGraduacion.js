// Tendencia de graduación del perfil del paciente: equivalente esférico por
// ojo en cada consulta medida y cambio entre una y otra. Lógica pura.

const num = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// Equivalente esférico = esfera + cilindro / 2. null si el ojo no tiene ninguna
// medida (ni esfera ni cilindro).
export function equivalenteEsferico(ojo) {
  const esfera = num(ojo?.esfera)
  const cilindro = num(ojo?.cilindro)
  if (esfera === null && cilindro === null) return null
  return (esfera ?? 0) + (cilindro ?? 0) / 2
}

// De la lista de consultas (de la más antigua a la más reciente), solo las que
// tienen alguna medida, como puntos { fecha, od, oi } (un ojo puede ser null).
export function puntosMedidos(consultas = []) {
  return consultas
    .map((c) => ({ fecha: c.fecha, od: equivalenteEsferico(c.od), oi: equivalenteEsferico(c.oi) }))
    .filter((p) => p.od !== null || p.oi !== null)
}

// Diferencia entre dos mediciones de un mismo ojo (null si falta alguna).
export function cambio(anterior, actual) {
  return anterior === null || actual === null ? null : actual - anterior
}

// Una diferencia menor a 0,125 D (menos de un paso de 0,25) cuenta como "sin cambios".
export const UMBRAL_SIN_CAMBIO = 0.125

// "+1,25 D", "−0,50 D" (signo siempre visible salvo en cero) o "—" si no hay valor.
export function textoDioptrias(valor) {
  if (valor === null || valor === undefined) return "—"
  const redondeado = Math.round(valor * 100) / 100
  if (redondeado === 0) return "0,00 D"
  const signo = redondeado > 0 ? "+" : "−"
  return `${signo}${Math.abs(redondeado).toFixed(2).replace(".", ",")} D`
}

// "sin cambios" o "+0,50 D" para el cambio entre dos mediciones.
export function textoCambio(delta) {
  if (delta === null) return "—"
  return Math.abs(delta) < UMBRAL_SIN_CAMBIO ? "sin cambios" : textoDioptrias(delta)
}
