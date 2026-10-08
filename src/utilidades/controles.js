import { fechaProximoControl, ordenarPorFechaYCreacion } from "./fidelizacion"
import { diaTieneCupo, fechaAISO, hoyISO, isoAFechaLocal } from "./disponibilidad"

// Citas que todavía "ocupan" el lugar de un control: la persona sigue esperada en la óptica.
const ESTADOS_ACTIVOS = ["Pendiente", "En Espera", "En Atención"]

export function sumarDiasISO(iso, dias) {
  const d = isoAFechaLocal(iso)
  d.setDate(d.getDate() + dias)
  return fechaAISO(d)
}

// Día hábil (abierto y con cupo) más cercano a `iso`, nunca antes de hoy. Si el propio día sirve, devuelve ese.
// Con empate prefiere el día anterior, para que el control no se pase de la fecha recomendada.
export function diaHabilMasCercano(iso, disponibilidad, citas = [], { hoy = hoyISO(), radio = 21 } = {}) {
  for (let i = 0; i <= radio; i++) {
    for (const signo of i === 0 ? [1] : [-1, 1]) {
      const candidato = sumarDiasISO(iso, signo * i)
      if (candidato >= hoy && diaTieneCupo(candidato, disponibilidad, citas)) return candidato
    }
  }
  return null
}

// A quién se le asigna por defecto la cita de un control: a quien atendió esa consulta. Las fichas nuevas guardan su id
// (controlAsignadoA); en las anteriores se busca por el nombre del profesional. Solo si sigue activo en el equipo.
export function asignadoDelControl(consulta, equipo = []) {
  if (!consulta) return ""
  if (consulta.controlAsignadoA) return consulta.controlAsignadoA
  const miembro = equipo.find((m) => m.activo !== false && m.nombre && m.nombre === consulta.profesionalNombre)
  return miembro?.id || ""
}

// Pacientes cuya última ficha dejó un control por agendar (el optómetra eligió "Agendar ahora" o "Agendar después")
// y hoy no tienen ninguna cita pendiente posterior a esa ficha: o se eligió "después", o la cita del control se canceló
// o no se pudo crear. Ordenados por la fecha del control, el más próximo primero.
export function controlesSinAgendar(pacientes = [], consultas = [], citas = []) {
  const resultado = []
  for (const paciente of pacientes) {
    const esSuyo = (x) => (paciente.id != null && x.pacienteId === paciente.id) || x.paciente === paciente.nombre
    const suyas = consultas.filter(esSuyo)
    if (suyas.length === 0) continue
    const ultima = suyas.slice().sort(ordenarPorFechaYCreacion)[0]
    if (!ultima.controlAgenda) continue
    const fechaControl = fechaProximoControl(paciente, consultas)
    if (!fechaControl) continue
    const conCita = citas.some((c) => esSuyo(c) && ESTADOS_ACTIVOS.includes(c.estado) && c.fecha > ultima.fecha)
    if (conCita) continue
    resultado.push({ paciente, consulta: ultima, fechaControl })
  }
  return resultado.sort((a, b) => a.fechaControl - b.fechaControl)
}

// Citas "para reagendar": las que el paciente no asistió o las que el propio paciente canceló, y nadie retomó.
// Una por paciente (la más reciente), de los últimos `dias` días o futuras, y solo si esa persona no tiene otra cita
// activa ni atendida posterior. Las más antiguas primero. Las canceladas por recepción no cuentan: recepción ya lo sabe.
export const requiereReagendar = (c) => c.estado === "No Asistió" || (c.estado === "Cancelada" && c.canceladaPor === "paciente")
export function citasParaReagendar(citas = [], { hoy = hoyISO(), dias = 30 } = {}) {
  const desde = sumarDiasISO(hoy, -dias)
  const claveDe = (c) => (c.pacienteId != null ? "id:" + c.pacienteId : "n:" + c.paciente)
  const porPaciente = new Map()
  for (const c of citas) {
    if (!requiereReagendar(c) || c.fecha < desde) continue
    const previa = porPaciente.get(claveDe(c))
    if (!previa || c.fecha > previa.fecha) porPaciente.set(claveDe(c), c)
  }
  return [...porPaciente.values()]
    .filter((c) => !citas.some((o) => o.id !== c.id && claveDe(o) === claveDe(c) && (ESTADOS_ACTIVOS.includes(o.estado) || o.estado === "Atendida") && o.fecha >= c.fecha))
    .sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}
