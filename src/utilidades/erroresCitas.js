// La base solo acepta la hora de una cita en el formato del sistema, "hh:mm AM/PM" (restricción
// citas_hora_formato, migración 0092). Si la rechaza, se muestra un mensaje claro y no el error técnico.
export const MENSAJE_HORA_INVALIDA = "La hora de la cita no es válida."

export const esErrorHoraInvalida = (error) => /citas_hora_formato/i.test(String(error?.message || error || ""))

// Mensaje para mostrar: el de la hora inválida si corresponde; si no, el que se le indique.
export const mensajeErrorCita = (error, porDefecto) => (esErrorHoraInvalida(error) ? MENSAJE_HORA_INVALIDA : porDefecto)
