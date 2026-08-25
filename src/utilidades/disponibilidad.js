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

export function esPasada(f) {
  const fecha = parseFechaFlexible(f)
  if (!fecha) return false
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaLimpia = new Date(fecha)
  fechaLimpia.setHours(0, 0, 0, 0)
  return fechaLimpia < hoy
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

// Slots de una fecha, marcando cuáles ya están ocupados por citas existentes.
// Si la fecha es hoy, también descarta los horarios que ya pasaron — antes se
// podía agendar (desde cualquiera de los 4 flujos que comparten esta función)
// una cita a una hora anterior a la actual del mismo día.
export function slotsDisponibles(fechaISO, disponibilidad, citas = []) {
  const horario = horarioEfectivo(fechaISO, disponibilidad)
  if (!diaAbierto(horario)) return []
  const todos = generarSlots({ manana: horario.manana, tarde: horario.tarde, duracion: disponibilidad?.duracionCita || 40 })
  const ocupados = new Set(citas.filter((c) => c.fecha === fechaISO).map((c) => c.hora))
  const esHoyFecha = fechaISO === hoyISO()
  const ahoraMin = esHoyFecha ? new Date().getHours() * 60 + new Date().getMinutes() : null
  return todos.map((h) => ({
    hora: h,
    libre: !ocupados.has(h) && (!esHoyFecha || minutosDesdeMedianoche(h) > ahoraMin),
  }))
}

// ¿Hay al menos un cupo libre ese día? (para pintar el calendario de agendamiento)
export function diaTieneCupo(fechaISO, disponibilidad, citas = []) {
  return slotsDisponibles(fechaISO, disponibilidad, citas).some((s) => s.libre)
}
