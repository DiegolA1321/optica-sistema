// El horario y las ausencias de cada persona (Ronda 5). Lógica pura, sin React.
//
// · Cada persona usa el horario de la óptica por defecto. La administración puede darle uno propio (mañana y tarde por día, cada turno activable) que debe quedar DENTRO del de la óptica.
// · Una ausencia aprobada (todo el día, la mañana, la tarde o varios días) bloquea ese tiempo en la agenda de la persona.
// · La agenda de cada profesional y las horas que ofrece la web salen de eso: una hora se ofrece si algún profesional (quien atiende pacientes) trabaja y no está ausente.
//   Una óptica sin profesionales marcados, o sin horario propio ni ausencias, se comporta como siempre (el horario de la óptica).
// El servidor aplica la misma regla en la reserva web (migración 0146: _profesional_disponible).
import { DIAS_SEMANA, horarioEfectivo, minutosDesde24h, minutosDesdeMedianoche } from "./disponibilidad"

export const TURNOS = ["manana", "tarde"]
export const ETIQUETA_TURNO = { manana: "Mañana", tarde: "Tarde" }
export const TIPOS_AUSENCIA = [
  { id: "cita_medica", etiqueta: "Cita médica" },
  { id: "vacaciones", etiqueta: "Vacaciones" },
  { id: "permiso_personal", etiqueta: "Permiso personal" },
  { id: "calamidad", etiqueta: "Calamidad" },
  { id: "otro", etiqueta: "Otro" },
]
export const etiquetaTipoAusencia = (id) => TIPOS_AUSENCIA.find((t) => t.id === id)?.etiqueta || "Otro"
export const FRANJAS = [{ id: "todo", etiqueta: "Todo el día" }, { id: "manana", etiqueta: "Mañana" }, { id: "tarde", etiqueta: "Tarde" }]
export const MAX_BYTES_DOCUMENTO = 5 * 1024 * 1024
export const TIPOS_DOCUMENTO = ["application/pdf", "image/png", "image/jpeg", "image/webp"]
export const ESTADOS_AUSENCIA = {
  pendiente: { etiqueta: "Por aprobar", tono: "ambar" },
  aprobada: { etiqueta: "Aprobada", tono: "verde" },
  rechazada: { etiqueta: "Rechazada", tono: "rojo" },
  cancelada: { etiqueta: "Retirada", tono: "gris" },
}

const diaDeFecha = (iso) => DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]
const turnoActivo = (t) => Boolean(t?.activo && t.inicio && t.fin && minutosDesde24h(t.fin) > minutosDesde24h(t.inicio))
const tieneTurno = (dia) => TURNOS.some((k) => turnoActivo(dia?.[k]))

// El día de la semana de un horario semanal: el de la persona si tiene uno propio; si no, el de la óptica de esa fecha (con sus excepciones).
export const diaEfectivo = (profesional, fechaISO, disponibilidad) => {
  const opticaDia = horarioEfectivo(fechaISO, disponibilidad)
  if (!profesional || profesional.usaOptica !== false || !profesional.horario) return opticaDia
  return profesional.horario[diaDeFecha(fechaISO)] || null
}

// ¿Trabaja la persona en ese minuto del día? (la hora de inicio cae dentro de un turno suyo, y la óptica atiende ese día)
export function trabajaEnMinuto(profesional, fechaISO, minuto, disponibilidad) {
  const opticaDia = horarioEfectivo(fechaISO, disponibilidad)
  if (!tieneTurno(opticaDia)) return false
  const dia = diaEfectivo(profesional, fechaISO, disponibilidad)
  return TURNOS.some((k) => turnoActivo(dia?.[k]) && minuto >= minutosDesde24h(dia[k].inicio) && minuto < minutosDesde24h(dia[k].fin))
}

// ¿Una ausencia aprobada cubre ese minuto? «Mañana» o «tarde» son esa sesión del horario de la óptica de ese día.
export function ausenciaCubreMinuto(ausencia, fechaISO, minuto, disponibilidad) {
  if (!ausencia || fechaISO < ausencia.desde || fechaISO > ausencia.hasta) return false
  if (ausencia.franja === "todo" || !ausencia.franja) return true
  const sesion = horarioEfectivo(fechaISO, disponibilidad)?.[ausencia.franja]
  return turnoActivo(sesion) && minuto >= minutosDesde24h(sesion.inicio) && minuto < minutosDesde24h(sesion.fin)
}

export const estaAusente = (profesional, fechaISO, minuto, disponibilidad) => (profesional?.ausencias || []).some((a) => ausenciaCubreMinuto(a, fechaISO, minuto, disponibilidad))

// ¿Esta persona atiende en ese minuto? (trabaja y no está ausente)
export const disponibleEnMinuto = (profesional, fechaISO, minuto, disponibilidad) => trabajaEnMinuto(profesional, fechaISO, minuto, disponibilidad) && !estaAusente(profesional, fechaISO, minuto, disponibilidad)

// Los profesionales que cuentan para ofrecer una hora: todos, o solo uno (la agenda de esa persona). Una persona que no es profesional (no atiende pacientes) no restringe nada.
export function profesionalesDe(disponibilidad, profesionalId = null) {
  const todos = disponibilidad?.profesionales || []
  if (!profesionalId) return todos
  const uno = todos.find((p) => p.id === profesionalId)
  return uno ? [uno] : todos
}

// ¿Se ofrece esa hora? Sin profesionales marcados siempre (la óptica atiende como siempre); con ellos, si alguno de los que cuentan está disponible.
export function horaOfrecida(disponibilidad, fechaISO, minuto, profesionalId = null) {
  const pros = profesionalesDe(disponibilidad, profesionalId)
  if (pros.length === 0) return true
  return pros.some((p) => disponibleEnMinuto(p, fechaISO, minuto, disponibilidad))
}

// ── El horario semanal de una persona, para editarlo y mostrarlo ──
const turnoVacio = (inicio, fin) => ({ activo: false, inicio, fin })
export const diaVacio = () => ({ manana: turnoVacio("09:00", "13:00"), tarde: turnoVacio("14:00", "18:00") })
export const semanaVacia = () => Object.fromEntries(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((d) => [d, diaVacio()]))
export const ORDEN_DIAS = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

// Una copia del horario de la óptica (cada turno como está) para que la administración parta de ahí.
export function semanaDeLaOptica(disponibilidad) {
  const base = disponibilidad?.horarioSemanal || {}
  return Object.fromEntries(ORDEN_DIAS.map((d) => [d, { manana: { ...turnoVacio("09:00", "13:00"), ...(base[d]?.manana || {}) }, tarde: { ...turnoVacio("14:00", "18:00"), ...(base[d]?.tarde || {}) } }]))
}

// La semana de una persona completa (lo que no tenga guardado queda apagado).
export function semanaDe(profesional, disponibilidad) {
  if (!profesional || profesional.usaOptica !== false || !profesional.horario) return semanaDeLaOptica(disponibilidad)
  return Object.fromEntries(ORDEN_DIAS.map((d) => [d, { manana: { ...turnoVacio("09:00", "13:00"), ...(profesional.horario[d]?.manana || {}) }, tarde: { ...turnoVacio("14:00", "18:00"), ...(profesional.horario[d]?.tarde || {}) } }]))
}

// Horas por semana de un horario semanal (turnos activos).
export function horasPorSemana(semana) {
  let min = 0
  for (const d of ORDEN_DIAS) for (const k of TURNOS) if (turnoActivo(semana?.[d]?.[k])) min += minutosDesde24h(semana[d][k].fin) - minutosDesde24h(semana[d][k].inicio)
  return Math.round((min / 60) * 10) / 10
}
export const textoHoras = (h) => `${String(h).replace(/\.0$/, "")} h/sem`

// «Medio tiempo · 24 h/sem» o «Horario de la óptica».
export function resumenDeJornada(profesional, disponibilidad) {
  if (!profesional || profesional.usaOptica !== false) return "Horario de la óptica"
  const h = horasPorSemana(semanaDe(profesional, disponibilidad))
  if (h === 0) return "Sin turnos"
  return `${h < 30 ? "Medio tiempo" : "Tiempo completo"} · ${textoHoras(h)}`
}

// Lo que no cabe en el horario de la óptica: [{ dia, turno }]. Cada turno activo debe estar entero dentro de una sesión activa de la óptica de ese día.
export function turnosFueraDeLaOptica(semana, disponibilidad) {
  const optica = disponibilidad?.horarioSemanal
  if (!optica) return []
  const fuera = []
  for (const d of ORDEN_DIAS) {
    for (const k of TURNOS) {
      const t = semana?.[d]?.[k]
      if (!turnoActivo(t)) continue
      const i = minutosDesde24h(t.inicio)
      const f = minutosDesde24h(t.fin)
      const cabe = TURNOS.some((s) => turnoActivo(optica[d]?.[s]) && i >= minutosDesde24h(optica[d][s].inicio) && f <= minutosDesde24h(optica[d][s].fin))
      if (!cabe) fuera.push({ dia: d, turno: k })
    }
  }
  return fuera
}

const ESTADOS_ABIERTOS = ["Pendiente", "En Espera"]
const esDeLaPersona = (cita, id) => cita.asignadoA === id
const futura = (cita, hoy) => cita.fecha >= hoy && ESTADOS_ABIERTOS.includes(cita.estado)

// Citas abiertas de la persona (de hoy en adelante) que quedarían fuera de su nuevo horario: se avisan antes de guardar.
export function citasFueraDelHorario({ persona, semanaNueva, usaOptica = false, citas = [], disponibilidad, hoy }) {
  const candidata = { id: persona, usaOptica, horario: usaOptica ? null : semanaNueva, ausencias: [] }
  return citas.filter((c) => esDeLaPersona(c, persona) && futura(c, hoy) && !trabajaEnMinuto(candidata, c.fecha, minutosDesdeMedianoche(c.hora), disponibilidad))
}

// Citas abiertas de la persona dentro de una ausencia (para listarlas y reagendarlas o reasignarlas antes de aprobar).
export function citasEnAusencia({ ausencia, personaId, citas = [], disponibilidad }) {
  return citas.filter((c) => esDeLaPersona(c, personaId) && ESTADOS_ABIERTOS.includes(c.estado) && ausenciaCubreMinuto({ desde: ausencia.fechaDesde ?? ausencia.desde, hasta: ausencia.fechaHasta ?? ausencia.hasta, franja: ausencia.franja }, c.fecha, minutosDesdeMedianoche(c.hora), disponibilidad))
    .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)))
}

// «30 oct · todo el día», «4 nov · mañana», «15 al 19 oct».
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"]
const corto = (iso) => `${Number(iso.slice(8, 10))} ${MESES[Number(iso.slice(5, 7)) - 1]}`
export function textoCuando(a) {
  const desde = a.fechaDesde ?? a.desde
  const hasta = a.fechaHasta ?? a.hasta
  if (hasta !== desde) {
    const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7)
    return mismoMes ? `${Number(desde.slice(8, 10))} al ${corto(hasta)}` : `${corto(desde)} al ${corto(hasta)}`
  }
  return `${corto(desde)} · ${a.franja === "manana" ? "mañana" : a.franja === "tarde" ? "tarde" : "todo el día"}`
}

// Los días (AAAA-MM-DD) de un rango, ambos incluidos.
export function diasDelRango(desde, hasta) {
  const dias = []
  const d = new Date(`${desde}T12:00:00`)
  const fin = new Date(`${hasta}T12:00:00`)
  while (d <= fin && dias.length < 400) {
    dias.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
    d.setDate(d.getDate() + 1)
  }
  return dias
}

// Problema de un documento de respaldo (PDF o foto, hasta 5 MB) o "".
export function problemaDeDocumento(archivo) {
  if (!archivo) return ""
  if (!TIPOS_DOCUMENTO.includes(archivo.type)) return "El documento debe ser un PDF o una foto (PNG, JPG o WEBP)."
  if (archivo.size > MAX_BYTES_DOCUMENTO) return "El documento puede pesar hasta 5 MB."
  return ""
}
