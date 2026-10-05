// Lógica pura de la vista Semana de Citas: qué días mostrar, qué rango de
// horas, qué franjas sombrear, cómo repartir los bloques de cada día y si una
// cita se puede soltar en un destino. Sin React ni acceso a datos: todo sale
// de `citas` y `disponibilidad`, las mismas fuentes que ya usan la lista y el
// agendamiento (disponibilidad.js), para que no haya una segunda verdad.
import {
  fechaAISO,
  isoAFechaLocal,
  horarioEfectivo,
  diaAbierto,
  ausenciasDeFecha,
  minutosDesde24h,
  minutosDesdeMedianoche,
  conflictoHorarioPersonalizado,
  horaA12,
} from "./disponibilidad"

export const PASO_MINUTOS = 30

export function sumarDiasISO(iso, dias) {
  const d = isoAFechaLocal(iso)
  d.setDate(d.getDate() + dias)
  return fechaAISO(d)
}

// Lunes de la semana (la semana empieza en lunes, igual que la vista Mes).
export function lunesDeSemana(iso) {
  const d = isoAFechaLocal(iso)
  return sumarDiasISO(iso, -((d.getDay() + 6) % 7))
}

export function minutosAHHMM(min) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`
}

// Lunes a sábado siempre; el domingo solo si la óptica atiende ese día
// (horario semanal o excepción) o ya hay una cita agendada.
export function diasDeSemana(lunesISO, disponibilidad, citas = []) {
  const dias = Array.from({ length: 6 }, (_, i) => sumarDiasISO(lunesISO, i))
  const domingo = sumarDiasISO(lunesISO, 6)
  if (diaAbierto(horarioEfectivo(domingo, disponibilidad)) || citas.some((c) => c.fecha === domingo)) dias.push(domingo)
  return dias
}

// Sesiones de atención de una fecha, en minutos desde medianoche.
export function sesionesDelDia(fechaISO, disponibilidad) {
  const h = horarioEfectivo(fechaISO, disponibilidad)
  return [h?.manana, h?.tarde]
    .filter((s) => s?.activo && s.inicio && s.fin)
    .map((s) => ({ inicio: minutosDesde24h(s.inicio), fin: minutosDesde24h(s.fin) }))
    .sort((a, b) => a.inicio - b.inicio)
}

const duracionDe = (cita, duracionDefault) => Number(cita.duracionMinutos ?? cita.duracion_minutos) || duracionDefault

// Rango vertical de la grilla: de la primera apertura a la última hora de
// cierre de los días mostrados, ampliado si alguna cita cae fuera. Redondeado
// al paso de la grilla. Sin horario ni citas, un rango por defecto razonable.
export function rangoHoras(dias, disponibilidad, citas = []) {
  const duracionDefault = disponibilidad?.duracionCita || 40
  let min = Infinity
  let max = -Infinity
  for (const dia of dias) {
    for (const s of sesionesDelDia(dia, disponibilidad)) {
      min = Math.min(min, s.inicio)
      max = Math.max(max, s.fin)
    }
  }
  for (const c of citas) {
    if (!dias.includes(c.fecha)) continue
    const ini = minutosDesdeMedianoche(c.hora)
    min = Math.min(min, ini)
    max = Math.max(max, ini + duracionDe(c, duracionDefault))
  }
  if (!Number.isFinite(min)) return { inicio: 8 * 60, fin: 18 * 60 }
  return {
    inicio: Math.floor(min / PASO_MINUTOS) * PASO_MINUTOS,
    fin: Math.ceil(max / PASO_MINUTOS) * PASO_MINUTOS,
  }
}

// Franjas que se sombrean en la columna de un día, dentro de `rango`:
// "cerrado" (fuera de horario, o todo el día cerrado), "almuerzo" (hueco entre
// la sesión de la mañana y la de la tarde) y "ausencia" (Mi horario).
export function franjasSombreadas(fechaISO, disponibilidad, rango) {
  const franjas = []
  const recortar = (inicio, fin, tipo, motivo) => {
    const i = Math.max(inicio, rango.inicio)
    const f = Math.min(fin, rango.fin)
    if (f > i) franjas.push({ inicio: i, fin: f, tipo, motivo })
  }
  const sesiones = sesionesDelDia(fechaISO, disponibilidad)
  if (sesiones.length === 0) {
    recortar(rango.inicio, rango.fin, "cerrado")
  } else {
    recortar(rango.inicio, sesiones[0].inicio, "cerrado")
    for (let i = 0; i < sesiones.length - 1; i++) recortar(sesiones[i].fin, sesiones[i + 1].inicio, "almuerzo")
    recortar(sesiones[sesiones.length - 1].fin, rango.fin, "cerrado")
  }
  for (const a of ausenciasDeFecha(fechaISO, disponibilidad)) {
    recortar(minutosDesde24h(a.inicio), minutosDesde24h(a.fin), "ausencia", a.motivo)
  }
  return franjas
}

// Reparte las citas de un día en bloques con su posición: citas que se
// solapan comparten el ancho en columnas. Las canceladas no ocupan agenda (su
// horario queda libre), así que van aparte, a ancho completo y al fondo.
export function bloquesDelDia(citas, fechaISO, duracionDefault = 40) {
  const delDia = citas
    .filter((c) => c.fecha === fechaISO)
    .map((cita) => {
      const inicio = minutosDesdeMedianoche(cita.hora)
      return { cita, inicio, fin: inicio + duracionDe(cita, duracionDefault), col: 0, cols: 1, cancelada: cita.estado === "Cancelada" }
    })
    .sort((a, b) => a.inicio - b.inicio || a.fin - b.fin)

  const activos = delDia.filter((b) => !b.cancelada)
  let grupo = []
  let finGrupo = -Infinity
  const cerrarGrupo = () => {
    const columnas = []
    for (const b of grupo) {
      let c = columnas.findIndex((fin) => fin <= b.inicio)
      if (c === -1) { c = columnas.length; columnas.push(0) }
      columnas[c] = b.fin
      b.col = c
    }
    for (const b of grupo) b.cols = columnas.length
    grupo = []
  }
  for (const b of activos) {
    if (grupo.length > 0 && b.inicio >= finGrupo) { cerrarGrupo(); finGrupo = -Infinity }
    grupo.push(b)
    finGrupo = Math.max(finGrupo, b.fin)
  }
  if (grupo.length > 0) cerrarGrupo()
  return delDia
}

// ¿Cabe [inicio, inicio+duración) completo dentro de una sola sesión de ese día?
export function dentroDeHorario(fechaISO, inicioMin, duracion, disponibilidad) {
  return sesionesDelDia(fechaISO, disponibilidad).some((s) => inicioMin >= s.inicio && inicioMin + duracion <= s.fin)
}

// Reglas para soltar una cita (arrastrar y soltar): solo reutiliza la
// validación real de disponibilidad (cruce con otras citas y ausencias) y le
// suma las dos que ahí no existen — no al pasado y dentro del horario abierto.
export function validarMovimiento(cita, fechaISO, inicioMin, disponibilidad, citas = [], ahora = new Date()) {
  const duracion = duracionDe(cita, disponibilidad?.duracionCita || 40)
  if (fechaISO === cita.fecha && inicioMin === minutosDesdeMedianoche(cita.hora)) return { ok: false, motivo: "Es el mismo horario." }
  const hoy = fechaAISO(ahora)
  if (fechaISO < hoy || (fechaISO === hoy && inicioMin <= ahora.getHours() * 60 + ahora.getMinutes())) {
    return { ok: false, motivo: "No se puede mover una cita al pasado." }
  }
  if (!dentroDeHorario(fechaISO, inicioMin, duracion, disponibilidad)) {
    return { ok: false, motivo: "Ese horario está fuera del horario de atención." }
  }
  if (conflictoHorarioPersonalizado(fechaISO, horaA12(minutosAHHMM(inicioMin)), duracion, disponibilidad, citas, cita.id)) {
    return { ok: false, motivo: "Ese horario está ocupado o bloqueado." }
  }
  return { ok: true }
}


// ¿Se puede agendar al hacer clic en esta celda de la grilla? Debe estar
// dentro de una sesión de atención, fuera de las ausencias, no ser pasada y no
// caer sobre una cita que sigue en agenda (las canceladas dejan el horario libre).
export function celdaLibre(fechaISO, inicioMin, disponibilidad, citas = [], ahora = new Date()) {
  const hoy = fechaAISO(ahora)
  if (fechaISO < hoy) return false
  if (fechaISO === hoy && inicioMin <= ahora.getHours() * 60 + ahora.getMinutes()) return false
  if (!sesionesDelDia(fechaISO, disponibilidad).some((s) => inicioMin >= s.inicio && inicioMin < s.fin)) return false
  if (ausenciasDeFecha(fechaISO, disponibilidad).some((a) => inicioMin >= minutosDesde24h(a.inicio) && inicioMin < minutosDesde24h(a.fin))) return false
  const duracionDefault = disponibilidad?.duracionCita || 40
  return !citas.some((c) => {
    if (c.fecha !== fechaISO || c.estado === "Cancelada") return false
    const ini = minutosDesdeMedianoche(c.hora)
    return inicioMin >= ini && inicioMin < ini + duracionDe(c, duracionDefault)
  })
}
