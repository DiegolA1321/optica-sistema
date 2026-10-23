// Piezas del agendamiento en la web pública: borrador en la pestaña, texto de la fecha, archivo de calendario (.ics) y enlaces del paso «Listo».
import { formatoFecha, nombreMes, horaSinCero as horaTexto } from "./formatoFecha"
import { minutosDesdeMedianoche, isoAFechaLocal } from "./disponibilidad"

// ─── Borrador (sessionStorage de la pestaña; nunca la base) ───
// Guarda solo lo que la persona escribió o eligió. La cédula y el teléfono son datos personales: viven solo en esta pestaña y se borran al terminar la reserva o al salir.
const claveBorrador = (opticaId) => `agendar-cita:${opticaId}`
export function leerBorrador(opticaId) {
  if (!opticaId) return null
  try {
    const crudo = window.sessionStorage.getItem(claveBorrador(opticaId))
    const b = crudo ? JSON.parse(crudo) : null
    return b && typeof b === "object" ? b : null
  } catch { return null }
}
export function guardarBorrador(opticaId, borrador) {
  if (!opticaId) return
  try { window.sessionStorage.setItem(claveBorrador(opticaId), JSON.stringify(borrador)) } catch { /* sin almacenamiento: sigue sin recordar */ }
}
export function borrarBorrador(opticaId) {
  if (!opticaId) return
  try { window.sessionStorage.removeItem(claveBorrador(opticaId)) } catch { /* nada que borrar */ }
}

// ─── Textos de fecha ───
// «Miércoles 29 de octubre» (sin coma ni año) para la línea del paso «Listo» y el título de las horas.
export const fechaDiaLargo = (iso) => (iso ? formatoFecha(iso, "calendario").replace(",", "") : "")
// «Mié 29 de octubre» para la fila Fecha del resumen.
export const fechaDiaCorto = (iso) => (iso ? `${formatoFecha(iso, "diaNumero")} de ${nombreMes(Number(iso.slice(5, 7)) - 1)}` : "")

// ─── Calendario (.ics) ───
const ZONA = "America/Guayaquil"
const dos = (n) => String(n).padStart(2, "0")
const sinSeparadores = (iso) => iso.replace(/-/g, "")
const aTextoIcs = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
const sumarMinutos = (iso, min) => {
  const d = isoAFechaLocal(iso)
  d.setMinutes(min)
  return `${d.getFullYear()}${dos(d.getMonth() + 1)}${dos(d.getDate())}T${dos(d.getHours())}${dos(d.getMinutes())}00`
}

// El texto del archivo .ics de una cita: fecha, hora, duración, dirección de la óptica y el código. La zona es Ecuador (sin horario de verano).
export function crearIcs({ codigo, fecha, hora, duracionMinutos = 40, titulo, direccion = "", descripcion = "" }) {
  const inicio = minutosDesdeMedianoche(hora)
  const inicioTxt = sumarMinutos(fecha, inicio)
  const finTxt = sumarMinutos(fecha, inicio + (Number(duracionMinutos) || 40))
  const sello = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Optica//Agendar cita//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    `TZID:${ZONA}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0500",
    "TZNAME:ECT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${codigo || sinSeparadores(fecha) + inicio}@cita`,
    `DTSTAMP:${sello}`,
    `DTSTART;TZID=${ZONA}:${inicioTxt}`,
    `DTEND;TZID=${ZONA}:${finTxt}`,
    `SUMMARY:${aTextoIcs(titulo)}`,
    ...(direccion ? [`LOCATION:${aTextoIcs(direccion)}`] : []),
    `DESCRIPTION:${aTextoIcs([descripcion, codigo ? `Código de tu cita: ${codigo}` : ""].filter(Boolean).join("\n"))}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT60M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Tu cita es en una hora",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
  return lineas.join("\r\n") + "\r\n"
}

// Descarga el .ics (un enlace temporal en la página; no abre ventanas).
export function descargarIcs(datos) {
  const blob = new Blob([crearIcs(datos)], { type: "text/calendar;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `cita-${datos.codigo || sinSeparadores(datos.fecha)}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Enlace de Google Maps con la dirección de la óptica; vacío si no hay dirección.
export const enlaceComoLlegar = (direccion) => (String(direccion || "").trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(String(direccion).trim())}` : "")

// «Miércoles 29 de octubre · 10:40 AM» (línea corta de una cita).
export const cuandoTexto = (fecha, hora) => [fechaDiaLargo(fecha), horaTexto(hora)].filter(Boolean).join(" · ")
