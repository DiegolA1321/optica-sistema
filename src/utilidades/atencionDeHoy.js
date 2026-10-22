// ¿Este paciente ya tiene una atención hoy? Evita registrar dos veces la misma consulta al pulsar «Atender» otra vez.
//   · enCurso: su cita de hoy que sigue abierta (pendiente, en espera o en atención): «Atender» la continúa, no crea otra.
//   · yaAtendida: ya se atendió hoy (una cita de hoy atendida o una ficha guardada hoy): solo con una confirmación explícita se registra otra consulta.
// Lógica pura: citas y consultas son las de la óptica; el paciente se reconoce por su id (o, si la cita no lo trae, por su nombre).
const ABIERTAS = ["Pendiente", "En Espera", "En Atención"]
const esDe = (x, paciente) => (x.pacienteId != null ? x.pacienteId === paciente.id : x.paciente === paciente.nombre)
const porHora = (a, b) => String(a.hora || "").localeCompare(String(b.hora || ""))

export function atencionDeHoy({ paciente, citas = [], consultas = [], hoy }) {
  const deHoy = citas.filter((c) => c.fecha === hoy && esDe(c, paciente))
  const enCurso = deHoy.filter((c) => ABIERTAS.includes(c.estado)).sort((a, b) => (a.estado === "En Atención" ? -1 : b.estado === "En Atención" ? 1 : porHora(a, b)))[0] || null
  const citaAtendida = deHoy.find((c) => c.estado === "Atendida") || null
  const fichaDeHoy = consultas.find((k) => k.fecha === hoy && esDe(k, paciente)) || null
  return { enCurso, yaAtendida: citaAtendida || fichaDeHoy ? { cita: citaAtendida, consulta: fichaDeHoy } : null }
}

export const TEXTO_OTRA_CONSULTA = "Este paciente ya se atendió hoy. ¿Registrar otra consulta?"
