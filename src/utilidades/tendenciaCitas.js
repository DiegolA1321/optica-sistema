// La tendencia de las citas de un paciente por semana, mes o año (perfil del paciente, pestaña Citas). Lógica pura.
// Las canceladas no cuentan: la línea dice cuántas veces vino (o tenía que venir), no las que se cayeron. Una sola función de fechas (formatoFecha) para las etiquetas.
import { fechaAISO, isoAFechaLocal } from "./disponibilidad"
import { nombreMes } from "./formatoFecha"

export const ESCALAS_TENDENCIA = [
  { id: "semana", etiqueta: "Semana", ayuda: "Citas por semana, las últimas 12 semanas", cuantos: 12 },
  { id: "mes", etiqueta: "Mes", ayuda: "Citas por mes, los últimos 12 meses", cuantos: 12 },
  { id: "anio", etiqueta: "Año", ayuda: "Citas por año, los últimos 5 años", cuantos: 5 },
]
export const ESCALA_POR_DEFECTO = "mes"

const lunesDe = (iso) => { const d = isoAFechaLocal(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d }
const dosD = (n) => String(n).padStart(2, "0")

// Los cubos (del más antiguo al de hoy) con su clave, etiqueta corta y etiqueta larga: [{ clave, etiqueta, larga, total, atendidas }]
function cubos(escala, hoy) {
  const n = ESCALAS_TENDENCIA.find((e) => e.id === escala)?.cuantos ?? 12
  const lista = []
  if (escala === "semana") {
    const base = lunesDe(hoy)
    for (let i = n - 1; i >= 0; i--) {
      const ini = new Date(base.getFullYear(), base.getMonth(), base.getDate() - 7 * i)
      const fin = new Date(ini.getFullYear(), ini.getMonth(), ini.getDate() + 6)
      lista.push({ clave: fechaAISO(ini), fin: fechaAISO(fin), etiqueta: `${ini.getDate()} ${nombreMes(ini.getMonth(), "corto")}`, larga: `Semana del ${ini.getDate()} ${nombreMes(ini.getMonth(), "corto")} al ${fin.getDate()} ${nombreMes(fin.getMonth(), "corto")}`, total: 0, atendidas: 0 })
    }
  } else if (escala === "anio") {
    const anio = Number(hoy.slice(0, 4))
    for (let i = n - 1; i >= 0; i--) lista.push({ clave: String(anio - i), etiqueta: String(anio - i), larga: String(anio - i), total: 0, atendidas: 0 })
  } else {
    const [anio, mes] = hoy.split("-").map(Number)
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(anio, mes - 1 - i, 1)
      lista.push({ clave: `${d.getFullYear()}-${dosD(d.getMonth() + 1)}`, etiqueta: nombreMes(d.getMonth(), "corto"), larga: `${nombreMes(d.getMonth(), "largo")} ${d.getFullYear()}`, total: 0, atendidas: 0 })
    }
  }
  return lista
}

export function tendenciaDeCitas(citas = [], escala = ESCALA_POR_DEFECTO, hoy) {
  const lista = cubos(escala, hoy)
  for (const c of citas) {
    if (c.estado === "Cancelada" || !c.fecha) continue
    const cubo = escala === "semana" ? lista.find((x) => c.fecha >= x.clave && c.fecha <= x.fin) : escala === "anio" ? lista.find((x) => x.clave === c.fecha.slice(0, 4)) : lista.find((x) => x.clave === c.fecha.slice(0, 7))
    if (!cubo) continue
    cubo.total++
    if (c.estado === "Atendida") cubo.atendidas++
  }
  return lista
}

// «Visitas por año» del perfil del paciente: una línea por año o por trimestre, desde su primera visita hasta hoy (los períodos sin visitas valen 0, para que la línea no salte).
// Como arriba, las canceladas no cuentan. Hasta 6 años o 8 trimestres, los más recientes. Devuelve [{ clave, etiqueta, larga, total }], del más antiguo al más reciente.
export const ESCALAS_VISITAS = [
  { id: "anio", etiqueta: "Por año", cuantos: 6 },
  { id: "trimestre", etiqueta: "Por trimestre", cuantos: 8 },
]
export function visitasPorPeriodo(citas = [], escala = "anio", hoy) {
  const porAnio = escala === "anio"
  const cuantos = ESCALAS_VISITAS.find((e) => e.id === escala)?.cuantos ?? 6
  const indice = (f) => { const a = Number(f.slice(0, 4)); return porAnio ? a : a * 4 + Math.floor((Number(f.slice(5, 7)) - 1) / 3) }
  const validas = citas.filter((c) => c.estado !== "Cancelada" && /^\d{4}-\d{2}/.test(c.fecha || ""))
  const actual = indice(hoy)
  const claves = validas.map((c) => indice(c.fecha))
  const ultimo = Math.max(actual, ...claves)
  const primero = claves.length ? Math.min(...claves) : actual
  const desde = Math.max(primero, ultimo - (cuantos - 1))
  const lista = []
  for (let k = desde; k <= ultimo; k++) {
    const anio = porAnio ? k : Math.floor(k / 4)
    const t = porAnio ? 0 : (k % 4) + 1
    lista.push({ clave: String(k), etiqueta: porAnio ? String(anio) : `T${t} ${anio}`, larga: porAnio ? String(anio) : `${t}.º trimestre de ${anio}`, total: 0 })
  }
  for (const c of validas) { const p = lista.find((x) => x.clave === String(indice(c.fecha))); if (p) p.total++ }
  return lista
}
