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
