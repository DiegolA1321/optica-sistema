// Una cita de otro día que se atiende hoy se mueve a hoy, con la hora real: el calendario y los reportes la ven en el día en que ocurrió, y
// nunca queda una cita "En atención" con fecha futura. Lo usan Citas ("Atender") y la ficha clínica (entrar desde el perfil del paciente).
import { ahoraEcuador } from "./horaEcuador"
import { hoyISO, horaA12 } from "./disponibilidad"
import { esErrorHoraInvalida, MENSAJE_HORA_INVALIDA } from "./erroresCitas"
import { MENSAJE_SIN_PERMISO, fueBloqueadoPorPermiso } from "./permisos"
import { registrarLog } from "./logs"
import { fechaLegible } from "./formatoFecha"

// La hora de ahora; si ya hay otra cita hoy a esa hora (un horario por óptica, fecha y hora), la primera de los próximos 30 minutos que esté libre.
export function horaLibreAhora(citas, citaId, ahora = ahoraEcuador(), hoy = hoyISO()) {
  const dos = (n) => String(n).padStart(2, "0")
  for (let extra = 0; extra < 30; extra++) {
    const t = new Date(ahora.getTime() + extra * 60_000)
    if (t.getDate() !== ahora.getDate()) break
    const candidata = horaA12(`${dos(t.getHours())}:${dos(t.getMinutes())}`)
    if (!citas.some((c) => c.id !== citaId && c.fecha === hoy && c.hora === candidata && c.estado !== "Cancelada")) return candidata
  }
  return horaA12(`${dos(ahora.getHours())}:${dos(ahora.getMinutes())}`)
}

// ¿Esta cita hay que moverla a hoy antes de atenderla? Las que ya están en atención, atendidas, canceladas o sin asistir no se tocan.
export const necesitaMoverseAHoy = (cita, hoy = hoyISO()) => !!cita && !!cita.fecha && cita.fecha !== hoy && !["En Atención", "Atendida", "Cancelada", "No Asistió"].includes(cita.estado)

// → { cita } con la cita ya movida, o { error } con el mensaje para mostrar (sin permiso, hora no válida o sin conexión).
export async function moverCitaAHoy({ supabase, opticaId, cita, citas, setCitas, usuario }) {
  const hoy = hoyISO()
  const hora = horaLibreAhora(citas, cita.id)
  if (supabase && opticaId) {
    const { data, error } = await supabase.from("citas").update({ fecha: hoy, hora }).eq("id", cita.id).select()
    if (fueBloqueadoPorPermiso({ error, data })) return { error: MENSAJE_SIN_PERMISO }
    if (error) return { error: esErrorHoraInvalida(error) ? MENSAJE_HORA_INVALIDA : "No se pudo mover la cita al día de hoy. Revisa tu conexión e intenta de nuevo." }
  }
  setCitas?.((prev) => prev.map((c) => (c.id === cita.id ? { ...c, fecha: hoy, hora } : c)))
  registrarLog(usuario, "citas", "Movió una cita al día en que se atiende", `${cita.paciente} · de ${fechaLegible(cita.fecha)} a hoy, ${hora}`)
  return { cita: { ...cita, fecha: hoy, hora } }
}
