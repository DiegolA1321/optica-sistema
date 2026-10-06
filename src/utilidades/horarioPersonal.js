// Horarios ocupados y disponibles de una persona del equipo (R19).
//
// Su horario personal (el de "Mi horario") dice cuándo atiende; sus citas
// ocupadas son las que tiene asignadas (asignado_a) o, si la cita no tenía a
// nadie asignado, las que atendió. Una cita sin responsable no ocupa el
// horario de nadie. Lógica pura, sin React.
import { DIAS_SEMANA, generarSlots, minutosDesdeMedianoche, finCitaMinutos, haySolapamiento, fechaAISO, horarioEfectivo, diaAbierto } from "./disponibilidad"
import { sumarDiasISO } from "./calendarioSemana"

export function citasDePersona(citas, personaId) {
  return citas.filter((c) => c.asignadoA === personaId || (!c.asignadoA && c.atendidoPor === personaId))
}

const diaDeFecha = (iso) => DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]

// Un día: cuántos turnos tiene según su horario personal, cuántos están
// ocupados por citas suyas y cuántos quedan libres (hoy no cuentan los que ya
// pasaron). Si la persona no configuró ese día, se usa el horario general de la
// óptica (con sus cierres y excepciones) y el resultado lo marca con
// `segunGeneral`.
export function resumenDia({ fecha, horarioSemanal, disponibilidad, citas, duracion = 40, ahora = new Date() }) {
  let dia = horarioSemanal?.[diaDeFecha(fecha)]
  let segunGeneral = false
  if (!diaAbierto(dia) && disponibilidad) {
    dia = horarioEfectivo(fecha, disponibilidad)
    segunGeneral = true
  }
  const slots = dia ? generarSlots({ manana: dia.manana, tarde: dia.tarde, duracion }) : []
  if (slots.length === 0) return { fecha, cerrado: true, segunGeneral, total: 0, ocupados: 0, libres: 0 }
  const esHoy = fecha === fechaAISO(ahora)
  const ahoraMin = esHoy ? ahora.getHours() * 60 + ahora.getMinutes() : null
  const delDia = citas
    .filter((c) => c.fecha === fecha && c.estado !== "Cancelada")
    .map((c) => ({ inicio: minutosDesdeMedianoche(c.hora), fin: finCitaMinutos(c, duracion, ahoraMin) }))
  let ocupados = 0
  let libres = 0
  for (const hora of slots) {
    const inicio = minutosDesdeMedianoche(hora)
    if (delDia.some((o) => haySolapamiento(inicio, inicio + duracion, o.inicio, o.fin))) ocupados++
    else if (!esHoy || inicio > ahoraMin) libres++
  }
  return { fecha, cerrado: false, segunGeneral, total: slots.length, ocupados, libres }
}

// Los 7 días desde `lunes`, con su resumen.
export function resumenSemana({ lunes, horarioSemanal, disponibilidad, citas, duracion = 40, ahora = new Date() }) {
  return Array.from({ length: 7 }, (_, i) => resumenDia({ fecha: sumarDiasISO(lunes, i), horarioSemanal, disponibilidad, citas, duracion, ahora }))
}

// Estado de la persona en este momento, para el panel del equipo.
export function estadoAhora({ horarioSemanal, disponibilidad, citas, duracion = 40, ahora = new Date() }) {
  const hoy = fechaAISO(ahora)
  const dia = resumenDia({ fecha: hoy, horarioSemanal, disponibilidad, citas, duracion, ahora })
  if (dia.cerrado) return "sinHorario"
  const ahoraMin = ahora.getHours() * 60 + ahora.getMinutes()
  const deHoy = citas.filter((c) => c.fecha === hoy && c.estado !== "Cancelada")
  if (deHoy.some((c) => c.estado === "En Atención")) return "enAtencion"
  if (deHoy.some((c) => {
    const inicio = minutosDesdeMedianoche(c.hora)
    return !["Atendida", "No Asistió"].includes(c.estado) && haySolapamiento(ahoraMin, ahoraMin + 1, inicio, finCitaMinutos(c, duracion))
  })) return "citaAhora"
  return "libre"
}
