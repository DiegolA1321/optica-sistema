import { ahoraEcuador } from "./horaEcuador"
// Lógica pura de la agenda de Citas (propuesta de flujo de atención, Ronda 1):
// la lista abre en hoy y lo próximo; lo pasado se consulta aparte.
import { fechaAISO, isoAFechaLocal, minutosDesdeMedianoche } from "./disponibilidad"

const porFechaHora = (a, b) => {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
  return minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)
}

// Citas de hoy en adelante (más próxima primero) y anteriores (más reciente
// primero). Las fechas son ISO (YYYY-MM-DD), así que comparan como texto.
export function particionarAgenda(citas, hoy) {
  const proximas = citas.filter((c) => c.fecha >= hoy).sort(porFechaHora)
  const anteriores = citas.filter((c) => c.fecha < hoy).sort((a, b) => porFechaHora(b, a))
  return { proximas, anteriores }
}

// Orden cronológico (o inverso) de una lista de citas.
export function ordenarCitas(citas, descendente = false) {
  return [...citas].sort(descendente ? (a, b) => porFechaHora(b, a) : porFechaHora)
}

// Agrupa citas ya ordenadas por día, conservando el orden recibido.
export function agruparPorDia(citas) {
  const mapa = new Map()
  for (const c of citas) {
    if (!mapa.has(c.fecha)) mapa.set(c.fecha, [])
    mapa.get(c.fecha).push(c)
  }
  return Array.from(mapa.entries())
}

const sumarDias = (iso, dias) => {
  const d = isoAFechaLocal(iso)
  d.setDate(d.getDate() + dias)
  return fechaAISO(d)
}

// Mueve el rango de fechas una semana hacia atrás (-1) o adelante (+1).
// Sin rango previo, parte de la semana que empieza hoy.
export function desplazarRango(desde, hasta, sentido, hoy) {
  const d = desde || hoy
  const h = hasta || sumarDias(d, 6)
  const salto = 7 * sentido
  return { desde: sumarDias(d, salto), hasta: sumarDias(h, salto) }
}

// ¿Ya pasó la hora agendada de la cita? (para ofrecer "No asistió" manual
// solo mientras la cita sigue pendiente tras su hora)
export function yaPasoLaHora(cita, ahora = ahoraEcuador()) {
  const hoy = fechaAISO(ahora)
  if (cita.fecha < hoy) return true
  if (cita.fecha > hoy) return false
  return minutosDesdeMedianoche(cita.hora) <= ahora.getHours() * 60 + ahora.getMinutes()
}
