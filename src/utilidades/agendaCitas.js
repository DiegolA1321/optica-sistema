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

// Minutos que faltan para la hora agendada de la cita (negativo si ya pasó). La hora de la cita viene en 12 h ("09:40 AM") y "ahora"
// es la hora de Ecuador: no se arma una fecha con texto, se comparan días y minutos con las mismas funciones del resto del sistema.
export function minutosHastaCita(cita, ahora = ahoraEcuador()) {
  const dias = Math.round((isoAFechaLocal(cita.fecha) - isoAFechaLocal(fechaAISO(ahora))) / 86400000)
  return dias * 1440 + minutosDesdeMedianoche(cita.hora) - (ahora.getHours() * 60 + ahora.getMinutes())
}

// ¿Ya pasó la hora agendada de la cita? (para ofrecer "No efectuada" manual
// solo mientras la cita sigue pendiente tras su hora)
export function yaPasoLaHora(cita, ahora = ahoraEcuador()) {
  const hoy = fechaAISO(ahora)
  if (cita.fecha < hoy) return true
  if (cita.fecha > hoy) return false
  return minutosDesdeMedianoche(cita.hora) <= ahora.getHours() * 60 + ahora.getMinutes()
}

// ¿Ya terminó el horario de la cita (hora de inicio + su duración)? Es cuando una cita pendiente que nadie abrió pasa sola a «No efectuada» (el servidor usa la misma cuenta).
// `duracionDefault`: la duración de la óptica, para las citas que no traen la suya.
export function yaTerminoSuHorario(cita, ahora = ahoraEcuador(), duracionDefault = 40) {
  const hoy = fechaAISO(ahora)
  if (cita.fecha < hoy) return true
  if (cita.fecha > hoy) return false
  const duracion = Number(cita.duracionMinutos ?? cita.duracion_minutos) || duracionDefault
  return minutosDesdeMedianoche(cita.hora) + duracion <= ahora.getHours() * 60 + ahora.getMinutes()
}

// Llega tarde y ya hay otra cita después: atender ahora a quien llegó tarde ocuparía la hora de la siguiente. Devuelve esa cita siguiente, o null.
//   * Solo cuenta si ya pasó la hora de inicio de la cita (llegó tarde) o si es de otro día (se atiende hoy, a la hora actual).
//   * "Siguiente" = la próxima cita abierta (pendiente o en espera) del mismo profesional hoy, que empieza DESPUÉS de esta y antes de que termine la
//     atención empezando ahora (ahora + duración). Si no hay ninguna, se atiende sin avisar.
//   * El mismo profesional: el de la cita (asignado o quien la atiende); una cita sin profesional se compara con todas.
export function siguienteCitaQueChoca(cita, citas = [], ahora = ahoraEcuador(), duracionDefault = 40) {
  if (!cita || cita.estado === "En Atención" || !cita.hora) return null
  const hoy = fechaAISO(ahora)
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
  const otroDia = cita.fecha !== hoy
  const inicio = minutosDesdeMedianoche(cita.hora)
  if (!otroDia && ahoraMin <= inicio) return null // a tiempo (o antes): se atiende en su horario
  const duracion = Number(cita.duracionMinutos ?? cita.duracion_minutos) || duracionDefault
  const profesional = cita.atendidoPor || cita.asignadoA || null
  const hastaMin = ahoraMin + duracion
  return citas
    .filter((c) => c.id !== cita.id && c.fecha === hoy && ["Pendiente", "En Espera"].includes(c.estado))
    .filter((c) => !profesional || !(c.atendidoPor || c.asignadoA) || (c.atendidoPor || c.asignadoA) === profesional)
    .map((c) => ({ c, inicio: minutosDesdeMedianoche(c.hora) }))
    .filter(({ inicio: i }) => (otroDia ? i >= ahoraMin : i > inicio) && i < hastaMin)
    .sort((a, b) => a.inicio - b.inicio)[0]?.c || null
}
