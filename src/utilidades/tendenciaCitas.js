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
