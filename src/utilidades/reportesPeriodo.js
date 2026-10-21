// Reportes: períodos, período anterior equivalente y variación. Lógica pura, sin pantalla.
import { ahoraEcuador, aEcuador } from "./horaEcuador"
import { fechaAISO } from "./disponibilidad"
import { sumarDiasISO } from "./controles"
import { formatoFecha } from "./formatoFecha"

export const PERIODOS = [
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
  { id: "trimestre", label: "Últimos 3 meses" },
  { id: "semestre", label: "Últimos 6 meses" },
  { id: "anio", label: "Este año" },
  { id: "personalizado", label: "Personalizado" },
]

const iso = (y, m, d) => fechaAISO(new Date(y, m, d))
const diasEnMes = (y, m) => new Date(y, m + 1, 0).getDate()

export function rangoDePeriodo(id, personalizado = {}, hoy = ahoraEcuador()) {
  const y = hoy.getFullYear(), m = hoy.getMonth()
  const hoyISO = iso(y, m, hoy.getDate())
  if (id === "personalizado") return { inicio: personalizado.inicio || iso(y, m, 1), fin: personalizado.fin || hoyISO }
  if (id === "mesPasado") return { inicio: iso(y, m - 1, 1), fin: iso(y, m, 0) }
  if (id === "trimestre") return { inicio: iso(y, m - 2, 1), fin: hoyISO }
  if (id === "semestre") return { inicio: iso(y, m - 5, 1), fin: hoyISO }
  if (id === "anio") return { inicio: iso(y, 0, 1), fin: hoyISO }
  return { inicio: iso(y, m, 1), fin: hoyISO }
}

const diasEntre = (a, b) => Math.round((Date.UTC(...b.split("-").map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(...a.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000)

// Período anterior equivalente: el mes en curso se compara con el mismo tramo de días del mes anterior (1–12 contra 1–12),
// no con el mes completo; el año en curso, con el mismo tramo del año anterior; el resto, con la ventana inmediata de igual largo.
export function rangoAnterior(id, rango, hoy = ahoraEcuador()) {
  const y = hoy.getFullYear(), m = hoy.getMonth()
  if (id === "mes") return { inicio: iso(y, m - 1, 1), fin: iso(y, m - 1, Math.min(hoy.getDate(), diasEnMes(y, m - 1))) }
  if (id === "mesPasado") return { inicio: iso(y, m - 2, 1), fin: iso(y, m - 1, 0) }
  if (id === "anio") return { inicio: iso(y - 1, 0, 1), fin: iso(y - 1, hoy.getMonth(), Math.min(hoy.getDate(), diasEnMes(y - 1, hoy.getMonth()))) }
  const largo = diasEntre(rango.inicio, rango.fin) + 1
  const fin = sumarDiasISO(rango.inicio, -1)
  return { inicio: sumarDiasISO(fin, -(largo - 1)), fin }
}

// Cómo se dice un tramo de días: "1 al 12 sept", "28 sept al 12 oct" o, con otro año, "1 al 12 sept 2025".
export function textoRango(r, hoy = ahoraEcuador()) {
  const [ai, mi] = r.inicio.split("-").map(Number)
  const [af, mf] = r.fin.split("-").map(Number)
  const conAnio = af !== hoy.getFullYear() || ai !== af
  const fin = formatoFecha(r.fin, conAnio ? "medio" : "medioSinAnio")
  if (r.inicio === r.fin) return fin
  if (ai === af && mi === mf) return `${Number(r.inicio.slice(8, 10))} al ${fin}`
  return `${formatoFecha(r.inicio, ai === af ? "medioSinAnio" : "medio")} al ${fin}`
}
export const etiquetaComparacion = (previo, hoy) => `vs. ${textoRango(previo, hoy)}`

// La fecha calendario (de Ecuador) de una fecha pura "AAAA-MM-DD" o de un instante con hora.
export const diaDe = (valor) => (!valor ? "" : String(valor).includes("T") ? fechaAISO(aEcuador(valor)) : String(valor).slice(0, 10))
export const enRango = (valor, rango) => { const d = diaDe(valor); return !!d && d >= rango.inicio && d <= rango.fin }

// Variación frente al período anterior. `buenoSiSube`: más ventas es bueno; más citas no efectuadas es malo.
// `puntos`: tasas (se resta, no se divide). Con una base pequeña (`baseMinima`) no se da un porcentaje que exagere
// ("+400 %" por pasar de 1 a 5): se dice el valor anterior ("antes 1").
export function variacion(actual, previo, { buenoSiSube = true, puntos = false, baseMinima = 10, formato = (n) => String(n) } = {}) {
  if (previo == null || actual == null) return { texto: "sin dato anterior", tono: "neutro", flecha: "" }
  if (actual === previo) return { texto: "igual", tono: "neutro", flecha: "→" }
  const sube = actual > previo
  const tono = sube === buenoSiSube ? "bueno" : "malo"
  const flecha = sube ? "↑" : "↓"
  if (puntos) return { texto: `${Math.round(Math.abs(actual - previo) * 10) / 10} pts`, tono, flecha }
  if (previo < baseMinima) return { texto: `antes ${formato(previo)}`, tono, flecha }
  return { texto: `${Math.abs(Math.round(((actual - previo) / previo) * 100))}%`, tono, flecha }
}

export const porcentaje = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null)

// Los últimos `n` meses terminando en el mes de `hoy`: { clave: "2026-10", inicio, fin, etiqueta: "oct 2026" }.
export function ultimosMeses(n = 12, hoy = ahoraEcuador()) {
  const out = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const y = d.getFullYear(), m = d.getMonth()
    const inicio = iso(y, m, 1)
    out.push({ clave: inicio.slice(0, 7), inicio, fin: iso(y, m, diasEnMes(y, m)), etiqueta: formatoFecha(inicio, "mesAnioCorto") })
  }
  return out
}

// Los meses que toca un rango, del primero al último ({ clave, inicio, fin, etiqueta }); cada mes entero, para el "mes a mes" de una exportación.
export function mesesDelRango(rango, tope = 36) {
  const [a, m] = rango.inicio.split("-").map(Number)
  const [af, mf] = rango.fin.split("-").map(Number)
  const out = []
  for (let i = 0; i < tope; i++) {
    const d = new Date(a, m - 1 + i, 1)
    if (d.getFullYear() > af || (d.getFullYear() === af && d.getMonth() + 1 > mf)) break
    const inicio = iso(d.getFullYear(), d.getMonth(), 1)
    out.push({ clave: inicio.slice(0, 7), inicio, fin: iso(d.getFullYear(), d.getMonth(), diasEnMes(d.getFullYear(), d.getMonth())), etiqueta: formatoFecha(inicio, "mesAnioCorto") })
  }
  return out
}
