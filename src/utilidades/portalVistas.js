// Piezas puras de las pantallas del portal (tercera ronda de diseño): la gráfica de la graduación, el saldo, el control en palabras, el historial por año, los avisos del
// paciente y el archivo de calendario. Siempre con las mismas funciones y cuentas del sistema del personal (regla 2 y 18).
import { ahoraEcuador } from "./horaEcuador"
import { fechaAISO, minutosDesdeMedianoche, estadoAtencionHoy, horarioEfectivo, horaA12 } from "./disponibilidad"
import { formatoFecha } from "./formatoFecha"
import { puntosMedidos } from "./tendenciaGraduacion"

// Los puntos de la gráfica (de la receta más antigua a la más reciente): los MISMOS de la tendencia del perfil del paciente (`puntosMedidos`, equivalente esférico).
export const serieDeGraduacion = (consultasRecientePrimero = []) => puntosMedidos([...consultasRecientePrimero].reverse())

// Saldo: el porcentaje que ya abonó, de 0 a 100.
export const porcentajeAbonado = (total, abonado) => (Number(total) > 0 ? Math.max(0, Math.min(100, Math.round((Number(abonado) / Number(total)) * 100))) : 0)

// Próximo control en palabras: «en 2 meses».
export function enCuantoTiempo(dias) {
  if (dias < 0) return "ya venció"
  if (dias === 0) return "es hoy"
  if (dias === 1) return "es mañana"
  if (dias < 45) return `en ${dias} días`
  const meses = Math.round(dias / 30)
  return `en ${meses} ${meses === 1 ? "mes" : "meses"}`
}

// El historial de citas por año (la lista ya viene de la más reciente a la más antigua).
export function agruparPorAnio(citas = []) {
  const grupos = []
  for (const c of citas) {
    const anio = String(c.fecha).slice(0, 4)
    const g = grupos.find((x) => x.anio === anio)
    if (g) g.citas.push(c)
    else grupos.push({ anio, citas: [c] })
  }
  return grupos
}

// Avisos del paciente (la campanita): los generan los mismos hechos que el personal ve: una orden lista (Ventas), una cita para hoy o mañana (Citas) y un control
// próximo o vencido (Inicio y CRM). `va` es la pantalla a la que lleva cada aviso.
export function avisosDelPaciente({ ordenes = [], proximaCita = null, control = null, hoy = ahoraEcuador() } = {}) {
  const avisos = []
  for (const o of ordenes) if (o.estado === "lista") avisos.push({ id: "lista-" + o.id, tipo: "lentes", texto: "Tus lentes están listos para retirar", va: "compras" })
  if (proximaCita) {
    const dias = Math.round((new Date(proximaCita.fecha + "T00:00:00Z") - new Date(fechaAISO(hoy) + "T00:00:00Z")) / 86400000)
    if (dias === 0) avisos.push({ id: "cita-" + proximaCita.id, tipo: "cita", texto: `Hoy tienes cita a las ${proximaCita.hora}`, va: "citas" })
    else if (dias === 1) avisos.push({ id: "cita-" + proximaCita.id, tipo: "cita", texto: `Mañana tienes cita a las ${proximaCita.hora}`, va: "citas" })
  }
  if (control && !proximaCita) {
    if (control.vencido) avisos.push({ id: "control", tipo: "control", texto: "Tu control ya venció: agéndalo cuanto antes", va: "resumen" })
    else if (control.pronto) avisos.push({ id: "control", tipo: "control", texto: `Tu control está próximo: ${formatoFecha(control.iso, "medio")}`, va: "resumen" })
  }
  return avisos
}

// «Agregar a mi calendario»: un archivo .ics con el día y la hora de Ecuador, el motivo, el lugar y un recordatorio un día antes.
const dos = (n) => String(n).padStart(2, "0")
const escapar = (t) => String(t).replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n")
export function archivoIcs({ cita, optica = "la óptica", direccion = "", ahora = new Date() }) {
  const [a, m, d] = cita.fecha.split("-")
  const inicio = minutosDesdeMedianoche(cita.hora)
  const marca = (min) => `${a}${m}${d}T${dos(Math.floor(min / 60))}${dos(min % 60)}00`
  const sello = ahora.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sistema Optica//Portal del paciente//ES", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:cita-${cita.id}@sistema-optica`, `DTSTAMP:${sello}`,
    `DTSTART;TZID=America/Guayaquil:${marca(inicio)}`, `DTEND;TZID=America/Guayaquil:${marca(inicio + 40)}`,
    `SUMMARY:${escapar(`Cita en ${optica}`)}`, `DESCRIPTION:${escapar(cita.motivo || "Consulta")}`, ...(direccion ? [`LOCATION:${escapar(direccion)}`] : []),
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", "DESCRIPTION:Mañana tienes cita", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR", "",
  ].join("\r\n")
}
export function descargarIcs(datos) {
  const url = URL.createObjectURL(new Blob([archivoIcs(datos)], { type: "text/calendar;charset=utf-8" }))
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = "mi-cita.ics"
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

// ── La óptica, hoy ──
// «Abierto hoy hasta las 6:00 PM» o «Cerrado hoy · abre el lunes a las 9:00 AM»: la misma regla de la página pública (`estadoAtencionHoy`) y el mismo horario efectivo
// (con las excepciones de días cerrados) que usa Citas. Sin horario cargado devuelve null.
export function estadoDeLaOpticaHoy(disponibilidad, ahora = ahoraEcuador()) {
  if (!disponibilidad) return null
  const estado = estadoAtencionHoy(disponibilidad, ahora)
  if (estado.abierto) return { abierto: true, texto: estado.texto }
  if (/abre a las/.test(estado.texto)) return { abierto: false, texto: estado.texto.replace("Cerrado ahora — abre a las", "Cerrado ahora · abre hoy a las") }
  for (let d = 1; d <= 14; d++) {
    const f = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d)
    const h = horarioEfectivo(fechaAISO(f), disponibilidad)
    const sesiones = [h?.manana, h?.tarde].filter((s) => s?.activo && s.inicio).sort((a, b) => a.inicio.localeCompare(b.inicio))
    if (sesiones.length) {
      const cuando = d === 1 ? "mañana" : `el ${formatoFecha(f, "largo").split(",")[0].toLowerCase()}`
      return { abierto: false, texto: `Cerrado hoy · abre ${cuando} a las ${horaA12(sesiones[0].inicio)}` }
    }
  }
  return { abierto: false, texto: "Cerrado hoy" }
}
