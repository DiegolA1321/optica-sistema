// Lógica de "agendar una cita" compartida por el módulo Citas y el perfil del paciente, para que
// la hora personalizada, "Atender ahora" y el guardado funcionen siempre igual en los dos.
import { horaA12, hoyISO, conflictoHorarioPersonalizado } from "./disponibilidad"
import { esErrorHoraInvalida, MENSAJE_HORA_INVALIDA, esHoraOcupadaError, MENSAJE_HORA_OCUPADA } from "./erroresCitas"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "./permisos"

// Llegó fuera de la grilla y la cita es de hoy: al confirmar pasa directo a "En Atención" y a la ficha.
export const esAtencionInmediata = ({ horaPersonalizada, fecha, puedeAtender }) =>
  !!horaPersonalizada && fecha === hoyISO() && !!puedeAtender

// Devuelve el texto del problema (error general o del horario), o ambos vacíos si el horario elegido es válido.
export function validarHorarioCita({ fecha, hora, horaPersonalizada, horaCustom, duracionCustom, disponibilidad, citas }) {
  if (!fecha || (horaPersonalizada ? !horaCustom : !hora)) {
    return { error: horaPersonalizada ? "Selecciona fecha y escribe la hora personalizada." : "Selecciona fecha y hora en el calendario.", errorHorario: "" }
  }
  if (horaPersonalizada && conflictoHorarioPersonalizado(fecha, horaA12(horaCustom), duracionCustom, disponibilidad, citas)) {
    return { error: "", errorHorario: "Ese horario se cruza con otra cita que sigue en agenda — elige otra hora o duración." }
  }
  return { error: "", errorHorario: "" }
}

export const textoErrorAgendar = (error) =>
  esHoraOcupadaError(error)
    ? MENSAJE_HORA_OCUPADA
    : esErrorHoraInvalida(error) ? MENSAJE_HORA_INVALIDA
    : esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO
    : "No se pudo registrar la cita. Revisa tu conexión e intenta de nuevo."

export const inicialesDe = (nombre) => {
  const partes = String(nombre || "").trim().split(" ").filter(Boolean)
  return (partes.length > 1 ? partes[0][0] + partes[1][0] : partes[0]?.[0] || "P").toUpperCase()
}

// Vuelve a pedir a la base las citas de hoy en adelante y las mezcla con las que ya hay en pantalla (al perder una hora por otra cita, para que los horarios se vean al día).
export async function refrescarCitas(supabase, opticaId, setCitas, desde) {
  if (!supabase || !opticaId || !setCitas) return
  const { data, error } = await supabase.from("citas").select("*").eq("optica_id", opticaId).gte("fecha", desde)
  if (error || !Array.isArray(data)) return
  setCitas((prev) => {
    const mapa = new Map(prev.map((c) => [c.id, c]))
    for (const f of data) {
      mapa.set(f.id, { ...(mapa.get(f.id) || { id: f.id, pacienteId: f.paciente_id, paciente: f.paciente, cedula: f.cedula, telefono: f.telefono, motivo: f.motivo, origen: f.origen }), fecha: f.fecha, hora: f.hora, estado: f.estado, duracionMinutos: f.duracion_minutos, asignadoA: f.asignado_a || null })
    }
    return [...mapa.values()]
  })
}

// Inserta la cita (o, sin base conectada, le da un id local). Devuelve { cita } o { error: texto }.
// `origen`: "presencial" cuando el paciente llegó sin cita y se le abre una al momento («Atender ahora»); si no, no se manda y la cita queda como de recepción.
export async function registrarCita(supabase, opticaId, paciente, { fecha, hora, duracionMinutos = null, motivo, asignadoA = null, estado = "Pendiente", origen = null }) {
  const cita = {
    pacienteId: paciente.id, paciente: paciente.nombre, cedula: paciente.cedula, telefono: paciente.telefono,
    fecha, hora, duracionMinutos, motivo, asignadoA: asignadoA || null, atendidoPor: null,
    iniciales: inicialesDe(paciente.nombre), estado, origen: origen || "staff",
  }
  if (supabase && opticaId) {
    const { data, error } = await supabase
      .from("citas")
      .insert({
        optica_id: opticaId,
        paciente_id: typeof paciente.id === "string" ? paciente.id : null,
        paciente: cita.paciente, cedula: cita.cedula, telefono: cita.telefono,
        fecha, hora, duracion_minutos: duracionMinutos, motivo, estado, asignado_a: cita.asignadoA, ...(origen ? { origen } : {}),
      })
      .select()
      .single()
    if (error) return { error: textoErrorAgendar(error), horaOcupada: esHoraOcupadaError(error) }
    cita.id = data.id
    cita.creadoEn = data.created_at
  } else {
    cita.id = Date.now()
  }
  return { cita }
}
