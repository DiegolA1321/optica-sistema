// La base solo acepta la hora de una cita en el formato del sistema, "hh:mm AM/PM" (restricción
// citas_hora_formato, migración 0092). Si la rechaza, se muestra un mensaje claro y no el error técnico.
export const MENSAJE_HORA_INVALIDA = "La hora de la cita no es válida."

export const esErrorHoraInvalida = (error) => /citas_hora_formato/i.test(String(error?.message || error || ""))

// Quien llega segundo a una hora pierde: la base lo rechaza (migración 0149) con este mensaje (código 23505 en un insert o update directo).
// Un solo mensaje y una sola detección para toda pantalla que agenda, reagenda o mueve una cita.
export const MENSAJE_HORA_OCUPADA = "Esa hora acaba de ocuparse. Elige otra."

// «Acaba de ocuparse» (0149), el código 23505 (unique_violation: el índice o el disparador de choques) y el mensaje de antes de la 0149 («ya no está disponible» / «horario»).
export const esHoraOcupadaError = (error) => {
  if (!error) return false
  if (error.code === "23505") return true
  return /acaba de ocuparse|ya no est[aá] disponible|horario ya|ya est[aá] ocupad/i.test(String(error.message || error))
}

// Mensaje para mostrar: el de la hora inválida si corresponde; si no, el que se le indique.
export const mensajeErrorCita = (error, porDefecto) => (esErrorHoraInvalida(error) ? MENSAJE_HORA_INVALIDA : esHoraOcupadaError(error) ? MENSAJE_HORA_OCUPADA : porDefecto)
