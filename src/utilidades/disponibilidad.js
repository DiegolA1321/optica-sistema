// ─── Utilidades de disponibilidad y horario del optómetra ───
// Toda la lógica de "qué días/horas puede reservar un paciente" vive aquí,
// para que el panel del optómetra (Horario.jsx) y los flujos de agendamiento
// (AgendarCitaPublica.jsx, PortalPaciente.jsx) queden sincronizados.

export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]

export const ETIQUETAS_DIA = {
  domingo: "Domingo",
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
}

const ORDEN_SEMANA_LABORAL = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

// "9:00 AM - 6:00 PM" para un día con una sola sesión, "9:00 AM - 1:00 PM y
// 2:00 PM - 6:00 PM" si tiene mañana y tarde. null si el día está cerrado.
function resumenSesionesDia(horario) {
  const sesiones = [horario?.manana, horario?.tarde]
    .filter((s) => s?.activo && s.inicio && s.fin)
    .map((s) => `${horaA12(s.inicio)} - ${horaA12(s.fin)}`)
  return sesiones.length ? sesiones.join(" y ") : null
}

// Agrupa el horario semanal en franjas legibles para mostrar en un footer
// público (ej. login de la óptica) — junta días consecutivos con el mismo
// horario ("Lunes a Viernes · 9:00 AM - 6:00 PM") en vez de listar los 7 días
// sueltos, y omite los días cerrados.
export function resumenHorarioSemanal(horarioSemanal) {
  if (!horarioSemanal) return []
  const dias = ORDEN_SEMANA_LABORAL.map((clave) => ({
    clave,
    etiqueta: ETIQUETAS_DIA[clave],
    texto: resumenSesionesDia(horarioSemanal[clave]),
  })).filter((d) => d.texto)

  const grupos = []
  for (const dia of dias) {
    const anterior = grupos[grupos.length - 1]
    const esConsecutivo =
      anterior &&
      anterior.texto === dia.texto &&
      ORDEN_SEMANA_LABORAL.indexOf(dia.clave) === ORDEN_SEMANA_LABORAL.indexOf(anterior.clavesFin) + 1
    if (esConsecutivo) {
      anterior.etiquetas.push(dia.etiqueta)
      anterior.clavesFin = dia.clave
    } else {
      grupos.push({ texto: dia.texto, etiquetas: [dia.etiqueta], clavesFin: dia.clave })
    }
  }

  return grupos.map((g) => ({
    etiqueta: g.etiquetas.length > 1 ? `${g.etiquetas[0]} a ${g.etiquetas[g.etiquetas.length - 1]}` : g.etiquetas[0],
    horario: g.texto,
  }))
}

export function fechaAISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function isoAFechaLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function hoyISO() {
  return fechaAISO(new Date())
}

export function horaA12(hhmm) {
  if (!hhmm) return ""
  const [h, m] = hhmm.split(":").map(Number)
  const periodo = h >= 12 ? "PM" : "AM"
  let h12 = h % 12
  if (h12 === 0) h12 = 12
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${periodo}`
}

// Horario "efectivo" de una fecha concreta: una excepción puntual manda sobre
// el horario semanal habitual (para cerrar un día que normalmente abre, o
// abrir uno que normalmente no, con horas propias si aplica). El horario de
// cada día se maneja como dos sesiones independientes (mañana/tarde) en vez
// de un solo rango + una pausa global — el hueco entre ambas sesiones ya es
// la pausa, sin necesidad de configurarla aparte.
export function horarioEfectivo(fechaISO, disponibilidad) {
  const excepcion = disponibilidad?.excepciones?.[fechaISO]
  if (excepcion) return excepcion
  const dia = isoAFechaLocal(fechaISO)
  const clave = DIAS_SEMANA[dia.getDay()]
  return disponibilidad?.horarioSemanal?.[clave] || { manana: { activo: false }, tarde: { activo: false } }
}

// ¿Tiene alguna sesión activa este horario? (mañana y/o tarde)
export function diaAbierto(horario) {
  return !!(horario?.manana?.activo || horario?.tarde?.activo)
}

// Estado de atención "ahora mismo" para un badge corto en la página pública
// (ej. login) — Séptima Mirada: el horario completo de la semana en una
// sola oración se pasaba desapercibido en el hero, con el mismo peso visual
// que un aviso legal. Esto da una frase corta y accionable en su lugar; el
// horario completo se queda donde ya estaba, en el pie de página.
export function estadoAtencionHoy(disponibilidad, ahora = new Date()) {
  const horario = horarioEfectivo(fechaAISO(ahora), disponibilidad)
  const sesiones = [horario?.manana, horario?.tarde]
    .filter((s) => s?.activo && s.inicio && s.fin)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
  if (sesiones.length === 0) return { abierto: false, texto: "Cerrado hoy" }

  const ahoraHHMM = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`
  const sesionActiva = sesiones.find((s) => ahoraHHMM >= s.inicio && ahoraHHMM < s.fin)
  if (sesionActiva) return { abierto: true, texto: `Abierto hoy hasta las ${horaA12(sesionActiva.fin)}` }

  const proximaSesion = sesiones.find((s) => ahoraHHMM < s.inicio)
  if (proximaSesion) return { abierto: false, texto: `Cerrado ahora — abre a las ${horaA12(proximaSesion.inicio)}` }

  return { abierto: false, texto: "Cerrado por hoy" }
}

// Genera los horarios (formato "09:00 AM") de las sesiones activas (mañana y/o tarde).
export function generarSlots({ manana, tarde, duracion = 40 }) {
  const slots = []
  const agregarRango = (rango) => {
    if (!rango?.activo || !rango.inicio || !rango.fin) return
    const [hIni, mIni] = rango.inicio.split(":").map(Number)
    const [hFin, mFin] = rango.fin.split(":").map(Number)
    let actual = hIni * 60 + mIni
    const limite = hFin * 60 + mFin
    while (actual + duracion <= limite) {
      const hh = String(Math.floor(actual / 60)).padStart(2, "0")
      const mm = String(actual % 60).padStart(2, "0")
      slots.push(horaA12(`${hh}:${mm}`))
      actual += duracion
    }
  }
  agregarRango(manana)
  agregarRango(tarde)
  return slots
}

// Convierte "HH:MM" (24h, el formato que usan los inputs <input type="time">
// del horario del optómetra) a minutos desde medianoche.
export function minutosDesde24h(hhmm) {
  if (!hhmm) return 0
  const [h, m] = hhmm.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Convierte "hh:mm AM/PM" a minutos desde medianoche, para poder ordenar horas
// cronológicamente (comparar los strings directamente falla: "09:00 AM" > "01:00 PM"
// alfabéticamente, aunque las 9 de la mañana sean antes que la 1 de la tarde).
export function minutosDesdeMedianoche(horaAmPm) {
  if (!horaAmPm) return 0
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(horaAmPm.trim())
  if (!m) return 0
  let h = Number(m[1]) % 12
  if (m[3].toUpperCase() === "PM") h += 12
  return h * 60 + Number(m[2])
}

// ─── Comparación de fechas de citas contra "hoy" ───
// Antes cada módulo (Citas.jsx, Reportes.jsx, Inicio.jsx) reimplementaba esto por su cuenta
// y terminaban desincronizados (una cita "Pendiente" en un módulo y "Atendida" en otro).
// Acepta tanto "AAAA-MM-DD" (formato real que usa SelectorFechaHora) como "DD/MM/AAAA"
// (por si queda algún dato legado con ese formato).
export function parseFechaFlexible(f) {
  if (!f) return null
  if (typeof f !== "string") return null

  if (f.includes("-")) {
    const partes = f.split("T")[0].split("-")
    if (partes.length === 3) {
      const [a, m, d] = partes.map(Number)
      if (a && m && d) return new Date(a, m - 1, d)
    }
  }

  if (f.includes("/")) {
    const partes = f.split("/")
    if (partes.length === 3) {
      const [d, m, a] = partes.map(Number)
      if (a && m && d) return new Date(a, m - 1, d)
    }
  }

  const d = new Date(f)
  return isNaN(d.getTime()) ? null : d
}

export function esHoy(f) {
  const fecha = parseFechaFlexible(f)
  if (!fecha) return false
  const hoy = new Date()
  return (
    fecha.getDate() === hoy.getDate() &&
    fecha.getMonth() === hoy.getMonth() &&
    fecha.getFullYear() === hoy.getFullYear()
  )
}

// Futuras estricta (excluye Hoy y Pasadas)
export function esFutura(f) {
  const fecha = parseFechaFlexible(f)
  if (!fecha) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaLimpia = new Date(fecha)
  fechaLimpia.setHours(0, 0, 0, 0)
  return fechaLimpia > hoy
}

export function etiquetaFecha(f) {
  const fecha = parseFechaFlexible(f)
  if (!fecha) return f || "Sin fecha"
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaLimpia = new Date(fecha)
  fechaLimpia.setHours(0, 0, 0, 0)

  const diff = Math.round((fechaLimpia - hoy) / 86400000)
  if (diff === 0) return "Hoy"
  if (diff === 1) return "Mañana"
  if (diff === -1) return "Ayer"
  return fecha.toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })
}

// El ing probó en vivo el caso de un paciente que llega en un horario
// distinto al de la grilla ("¿qué pasa si te atiendo a las 3:40?") y señaló
// dos reglas concretas que antes no existían en ningún lado del sistema:
//   1. El "fin" real de una cita es su hora + duración estimada, no solo su
//      slot nominal — dos citas se cruzan si sus rangos [inicio, fin) se
//      solapan, sin importar si empiezan en horas distintas de la grilla.
//   2. Una cita que todavía NO se finalizó (no está Atendida/No Asistió/
//      Cancelada) sigue "ocupando" su horario más allá de su fin estimado
//      mientras no se marque su desenlace — textual suyo: "hasta que no
//      finalice, los horarios siguientes no van a estar disponibles...
//      si le doy finalizar, ahí sí aparece disponible".
const ESTADOS_TERMINALES_CITA = ["Atendida", "No Asistió", "Cancelada"]

// Minuto en que una cita deja de "ocupar" agenda. `ahoraMin` (minutos desde
// medianoche de HOY) solo aplica si la cita es de hoy — una cita futura o
// pasada nunca se estira por el reloj actual.
export function finCitaMinutos(cita, duracionDefault = 40, ahoraMin = null) {
  const inicio = minutosDesdeMedianoche(cita.hora)
  const duracion = Number(cita.duracionMinutos ?? cita.duracion_minutos) || duracionDefault
  let fin = inicio + duracion
  const terminal = ESTADOS_TERMINALES_CITA.includes(cita.estado)
  if (!terminal && ahoraMin != null && ahoraMin > fin) fin = ahoraMin
  return fin
}

export function haySolapamiento(inicioA, finA, inicioB, finB) {
  return inicioA < finB && inicioB < finA
}

// Slots de una fecha, marcando cuáles ya están ocupados por citas existentes.
// Si la fecha es hoy, también descarta los horarios que ya pasaron — antes se
// podía agendar (desde cualquiera de los 4 flujos que comparten esta función)
// una cita a una hora anterior a la actual del mismo día.
export function slotsDisponibles(fechaISO, disponibilidad, citas = []) {
  const horario = horarioEfectivo(fechaISO, disponibilidad)
  if (!diaAbierto(horario)) return []
  const duracionDefault = disponibilidad?.duracionCita || 40
  const todos = generarSlots({ manana: horario.manana, tarde: horario.tarde, duracion: duracionDefault })
  const esHoyFecha = fechaISO === hoyISO()
  const ahoraMin = esHoyFecha ? new Date().getHours() * 60 + new Date().getMinutes() : null
  // "Cancelada" no debe bloquear el horario — el hallazgo E7 encontró que
  // una cita cancelada por el paciente (que se marca así, no se borra —
  // ver cancelar_cita_publica) dejaba el horario inutilizable para
  // siempre en este cálculo, aunque en la base ya estuviera libre. El
  // solapamiento por duración (en vez de comparar el string de hora tal
  // cual) es lo que permite que una cita con horario personalizado más
  // larga que un slot bloquee también el/los siguientes.
  const ocupados = citas
    .filter((c) => c.fecha === fechaISO && c.estado !== "Cancelada")
    .map((c) => ({ inicio: minutosDesdeMedianoche(c.hora), fin: finCitaMinutos(c, duracionDefault, ahoraMin) }))
  return todos.map((h) => {
    const inicioSlot = minutosDesdeMedianoche(h)
    const finSlot = inicioSlot + duracionDefault
    const ocupado = ocupados.some((o) => haySolapamiento(inicioSlot, finSlot, o.inicio, o.fin))
    return {
      hora: h,
      libre: !ocupado && (!esHoyFecha || inicioSlot > ahoraMin),
    }
  })
}

// Valida un horario personalizado (no alineado a la grilla de slots fijos) —
// usado cuando el personal atiende a alguien que llegó fuera de los horarios
// generados por defecto. `citaIdExcluir` deja pasar el propio registro al
// reagendar/editar una cita existente.
export function conflictoHorarioPersonalizado(fechaISO, horaAMPM, duracionMinutos, disponibilidad, citas = [], citaIdExcluir = null) {
  const duracionDefault = disponibilidad?.duracionCita || 40
  const duracion = Number(duracionMinutos) || duracionDefault
  const inicio = minutosDesdeMedianoche(horaAMPM)
  const fin = inicio + duracion
  const esHoyFecha = fechaISO === hoyISO()
  const ahoraMin = esHoyFecha ? new Date().getHours() * 60 + new Date().getMinutes() : null
  return citas
    .filter((c) => c.fecha === fechaISO && c.estado !== "Cancelada" && c.id !== citaIdExcluir)
    .some((c) => haySolapamiento(inicio, fin, minutosDesdeMedianoche(c.hora), finCitaMinutos(c, duracionDefault, ahoraMin)))
}

// ¿Hay al menos un cupo libre ese día? (para pintar el calendario de agendamiento)
export function diaTieneCupo(fechaISO, disponibilidad, citas = []) {
  return slotsDisponibles(fechaISO, disponibilidad, citas).some((s) => s.libre)
}
