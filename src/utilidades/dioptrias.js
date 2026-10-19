// Esfera, cilindro y adición se miden de 0,25 en 0,25 y llevan signo. Estas funciones son las que usa la tabla de refracción de la ficha clínica: al salir del campo el valor
// se lleva al cuarto más cercano con su signo («1.3» → «+1.25»), y con el teclado «+» y «−» cambian el signo y ↑ ↓ suben o bajan 0,25.
const CUARTO = 0.25

export const redondearCuarto = (n) => Math.round(n / CUARTO) * CUARTO

// 1.25 → «+1.25», -0.5 → «-0.50», 0 → «0.00». Siempre con punto y dos decimales (así se guardó siempre y así lo lee la base).
export function formatoDioptria(n) {
  if (!Number.isFinite(n)) return ""
  const r = redondearCuarto(n)
  if (r === 0) return "0.00"
  return (r > 0 ? "+" : "-") + Math.abs(r).toFixed(2)
}

const aNumero = (texto) => parseFloat(String(texto ?? "").replace(",", ".").replace("−", "-"))

// Lo que se escribió, llevado a un valor válido; vacío si no hay número.
export function normalizarDioptria(texto) {
  const t = String(texto ?? "").trim()
  if (t === "" || t === "+" || t === "-" || t === "−") return ""
  const n = aNumero(t)
  return Number.isFinite(n) ? formatoDioptria(n) : ""
}

// Fija el signo (+1 o −1) sin cambiar la cifra; con el campo vacío deja solo el signo para seguir escribiendo.
export function conSigno(texto, signo) {
  const t = String(texto ?? "").trim().replace(",", ".").replace("−", "-")
  const cifra = t.replace(/^[+-]/, "")
  return (signo < 0 ? "-" : "+") + cifra
}

// ↑ y ↓: un cuarto más o menos (de vacío parte de cero).
export function pasoDioptria(texto, delta) {
  const n = aNumero(texto)
  return formatoDioptria((Number.isFinite(n) ? n : 0) + delta)
}

// El eje solo va de 0 a 180, entero.
export function normalizarEje(texto) {
  const solo = String(texto ?? "").replace(/\D/g, "").slice(0, 3)
  if (solo === "") return ""
  return String(Math.min(180, parseInt(solo, 10)))
}
export const pasoEje = (texto, delta) => String(Math.min(180, Math.max(0, (parseInt(texto, 10) || 0) + delta)))
