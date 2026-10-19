// Reglas de la refracción de la ficha clínica: transposición del cilindro y validación de esfera, cilindro, eje y adición. Un solo lugar: la ficha, la vista previa y la receta usan estas funciones.
//   · Esfera de −30 a +30, cilindro siempre negativo (o cero), eje de 1 a 180, adición de +0.50 a +4.00; todo en pasos de 0.25.

export const ESFERA_MIN = -30
export const ESFERA_MAX = 30
export const ADICION_MIN = 0.5
export const ADICION_MAX = 4

// «-1,25» y «-1.25» son lo mismo; un texto que no es número da null.
export const aNumero = (v) => {
  const t = String(v ?? "").trim().replace(",", ".")
  if (t === "" || t === "-" || t === "+" || t === ".") return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

// Pasos de 0.25 (con tolerancia de redondeo).
export const esPaso025 = (n) => Math.abs(n * 4 - Math.round(n * 4)) < 1e-9

// Escritura de una dioptría: «+1.25», «-0.50», «0.00».
export const formatoDioptria = (n) => {
  const r = Math.round(n * 100) / 100
  return (r > 0 ? "+" : "") + (Object.is(r, -0) ? 0 : r).toFixed(2)
}

// Transposición: esfera + cilindro, cilindro con el signo contrario y eje a 90° de distancia (dentro de 1–180). −1.50 +0.50 × 90 → −1.00 −0.50 × 180.
export function transponer({ esfera, cilindro, eje }) {
  const e = aNumero(esfera)
  const c = aNumero(cilindro)
  const x = aNumero(eje)
  if (e === null || c === null || x === null) return null
  const nuevoEje = x <= 90 ? x + 90 : x - 90
  return { esfera: formatoDioptria(e + c), cilindro: formatoDioptria(-c), eje: String(nuevoEje) }
}

// Errores de un ojo (esfera, cilindro, eje) por campo. `transponible` avisa que el cilindro positivo se puede pasar a negativo con la transposición.
export function validarOjo({ esfera = "", cilindro = "", eje = "" } = {}) {
  const errs = {}
  const e = aNumero(esfera)
  const c = aNumero(cilindro)
  const x = aNumero(eje)
  if (String(esfera).trim() && e === null) errs.esfera = "Número no válido"
  else if (e !== null && (e < ESFERA_MIN || e > ESFERA_MAX)) errs.esfera = "La esfera va de −30 a +30"
  else if (e !== null && !esPaso025(e)) errs.esfera = "Va de 0.25 en 0.25"
  if (String(cilindro).trim() && c === null) errs.cilindro = "Número no válido"
  else if (c !== null && c > 0) { errs.cilindro = "El cilindro va en negativo"; errs.transponible = true }
  else if (c !== null && c < ESFERA_MIN) errs.cilindro = "El cilindro va hasta −30"
  else if (c !== null && !esPaso025(c)) errs.cilindro = "Va de 0.25 en 0.25"
  if (String(eje).trim() && x === null) errs.eje = "Número no válido"
  else if (x !== null && (!Number.isInteger(x) || x < 1 || x > 180)) errs.eje = "El eje va de 1° a 180°"
  else if (x === null && c !== null && c !== 0) errs.eje = "Indica el eje del cilindro"
  return errs
}

// Adición: vacía es válida (no todos la llevan); si se escribe, de +0.50 a +4.00 en pasos de 0.25.
export function validarAdicion(valor) {
  if (!String(valor ?? "").trim()) return ""
  const n = aNumero(valor)
  if (n === null) return "Número no válido"
  if (n < ADICION_MIN || n > ADICION_MAX) return "La adición va de +0.50 a +4.00"
  if (!esPaso025(n)) return "Va de 0.25 en 0.25"
  return ""
}

// Una dioptría como se LEE en pantalla, en la receta impresa, en el perfil y en el portal: signo siempre visible (+ en los positivos, − de verdad en los negativos), punto decimal y dos decimales: «+1.75», «−0.50», «0.00».
// Vacío si no es un número. Es el único formato de lectura de esfera, cilindro y adición.
export function dioptriaTexto(v) {
  const n = aNumero(v)
  if (n === null) return ""
  const r = Math.round(n * 100) / 100
  if (r === 0) return "0.00"
  return (r > 0 ? "+" : "−") + Math.abs(r).toFixed(2)
}

// El texto de un ojo para la receta y las listas: «−1.75 −0.75 × 10°». Sin esfera ni cilindro, vacío.
export const textoOjoCompleto = (o) => {
  if (!o || (!String(o.esfera ?? "").trim() && !String(o.cilindro ?? "").trim())) return ""
  return [dioptriaTexto(o.esfera) || "0.00", dioptriaTexto(o.cilindro), o.eje ? `× ${o.eje}°` : ""].filter(Boolean).join(" ")
}
