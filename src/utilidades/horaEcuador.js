// "Ahora" y "hoy" SIEMPRE en la hora de Ecuador (America/Guayaquil, UTC-5 todo el año, sin horario de verano), sin depender de la
// zona horaria del equipo: las óptica atienden en Ecuador y su horario, sus citas y "hoy" se miden con el reloj de Ecuador.
//
// ahoraEcuador() devuelve un Date cuyos campos locales (getFullYear, getMonth, getDate, getHours, getMinutes...) son la hora de pared
// de Ecuador en ese instante. Así todo el código que ya lee esos campos (y fechaAISO, setHours, etc.) sigue funcionando igual, y en un
// equipo en zona de Ecuador devuelve exactamente el instante actual. No sirve para guardar marcas de tiempo: para eso, toISOString()
// de un `new Date()` normal (el instante real).
export const ZONA_ECUADOR = "America/Guayaquil"

const formateador = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_ECUADOR,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
})

export function ahoraEcuador(instante = new Date()) {
  const p = {}
  for (const x of formateador.formatToParts(instante)) p[x.type] = x.value
  return new Date(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second), instante.getMilliseconds())
}
