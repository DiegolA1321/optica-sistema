import { ahoraEcuador } from "./horaEcuador"
// Edad en años cumplidos a partir de una fecha de nacimiento ("AAAA-MM-DD" o Date). null si no hay fecha válida.
export function edadEnAnios(nacimiento, hoy = ahoraEcuador()) {
  if (!nacimiento) return null
  const n = nacimiento instanceof Date ? nacimiento : (() => { const [a, m, d] = String(nacimiento).slice(0, 10).split("-").map(Number); return a && m && d ? new Date(a, m - 1, d) : null })()
  if (!n || Number.isNaN(n.getTime())) return null
  let edad = hoy.getFullYear() - n.getFullYear()
  const m = hoy.getMonth() - n.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) edad--
  return edad >= 0 ? edad : null
}

// El cumpleaños del paciente, en una frase corta: «Cumplirá 37 · en 350 días» (o «Cumple 37 años · hoy»). Una sola redacción para el perfil; sin edad, solo cuándo.
export function fraseCumpleanos(edad, dias) {
  if (dias == null) return ""
  const cuando = dias === 0 ? "hoy" : `en ${dias} día${dias === 1 ? "" : "s"}`
  if (edad == null) return dias === 0 ? "Cumple hoy" : `Cumple ${cuando}`
  if (dias === 0) return `Cumple ${edad} año${edad === 1 ? "" : "s"} · hoy`
  const n = edad + 1
  return `Cumplirá ${n === 1 ? "1 año" : n} · ${cuando}`
}

// Cuánto hace que es paciente, en palabras: «este mes», «3 meses», «1 año y medio», «2 años». Desde una fecha «AAAA-MM-DD» hasta hoy.
export function antiguedadEnPalabras(desde, hoy = ahoraEcuador()) {
  if (!desde) return ""
  const [a, m, d] = String(desde).slice(0, 10).split("-").map(Number)
  if (!a || !m || !d) return ""
  let meses = (hoy.getFullYear() - a) * 12 + (hoy.getMonth() + 1 - m)
  if (hoy.getDate() < d) meses--
  if (meses < 0) return ""
  if (meses < 1) return "este mes"
  if (meses < 12) return `${meses} mes${meses === 1 ? "" : "es"}`
  const anios = Math.floor(meses / 12)
  const resto = meses % 12
  return `${anios} año${anios === 1 ? "" : "s"}${resto >= 6 ? " y medio" : ""}`
}
