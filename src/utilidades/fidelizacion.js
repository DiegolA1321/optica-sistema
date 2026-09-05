// ─── Utilidades de fidelización: inactividad, frecuencia y referidos ───
// Centraliza la lógica que usan CRM.jsx e Inicio.jsx para no duplicarla.

const UMBRAL_INACTIVO_DIAS = 180 // ~6 meses sin consulta registrada
const MINIMO_CLIENTE_FRECUENTE = 3 // consultas registradas

function parseFechaFlexible(f) {
  if (!f) return null
  const s = String(f).trim()
  // ISO "2026-08-15"
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.split("T")[0].split("-").map(Number)
    if (y && m && d) return new Date(y, m - 1, d)
  }
  // "DD/MM/YYYY"
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split("/").map(Number)
    if (y && m && d) return new Date(y, m - 1, d)
  }
  return null
}

// Consultas de un paciente: empareja por pacienteId cuando existe (fuente de verdad
// real) y cae a comparar por nombre sólo para fichas guardadas antes de que
// ConsultaMedica.jsx empezara a grabar pacienteId. Emparejar solo por nombre rompía
// el historial en cuanto alguien editaba el nombre del paciente, y fusionaba el
// historial de dos pacientes distintos con el mismo nombre.
function consultasDe(paciente, consultas = []) {
  return consultas.filter((c) => (paciente.id != null && c.pacienteId === paciente.id) || c.paciente === paciente.nombre)
}

// Última visita real de un paciente: la consulta más reciente registrada,
// o su fecha de registro en el sistema si nunca ha tenido consulta.
export function ultimaVisita(paciente, consultas = []) {
  const consultasPaciente = consultasDe(paciente, consultas)
  if (consultasPaciente.length > 0) {
    const fechas = consultasPaciente.map((c) => parseFechaFlexible(c.fecha)).filter(Boolean)
    if (fechas.length > 0) return new Date(Math.max(...fechas.map((f) => f.getTime())))
  }
  return parseFechaFlexible(paciente.fechaRegistro)
}

export function diasDesdeUltimaVisita(paciente, consultas = []) {
  const fecha = ultimaVisita(paciente, consultas)
  if (!fecha) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  fecha.setHours(0, 0, 0, 0)
  return Math.round((hoy - fecha) / 86400000)
}

// Fecha del próximo control clínico recomendado: respeta el intervalo que
// el optómetra fijó en la última consulta (proximoControlDias); si el
// paciente nunca ha tenido consulta, usa el umbral genérico desde su registro.
export function fechaProximoControl(paciente, consultas = []) {
  const consultasPaciente = consultasDe(paciente, consultas)
  const conFecha = consultasPaciente
    .map((c) => ({ c, fecha: parseFechaFlexible(c.fecha) }))
    .filter((x) => x.fecha)

  if (conFecha.length > 0) {
    const masReciente = conFecha.reduce((a, b) => (b.fecha > a.fecha ? b : a))
    const dias = masReciente.c.proximoControlDias || UMBRAL_INACTIVO_DIAS
    const objetivo = new Date(masReciente.fecha)
    objetivo.setDate(objetivo.getDate() + dias)
    return objetivo
  }

  const registro = parseFechaFlexible(paciente.fechaRegistro)
  if (!registro) return null
  const objetivo = new Date(registro)
  objetivo.setDate(objetivo.getDate() + UMBRAL_INACTIVO_DIAS)
  return objetivo
}

// Días de retraso sobre el control recomendado (negativo = aún no vence)
export function diasVencido(paciente, consultas = []) {
  const objetivo = fechaProximoControl(paciente, consultas)
  if (!objetivo) return null
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  objetivo.setHours(0, 0, 0, 0)
  return Math.round((hoy - objetivo) / 86400000)
}

export function esInactivo(paciente, consultas = []) {
  const dias = diasVencido(paciente, consultas)
  return dias !== null && dias >= 0
}

export function contarConsultas(paciente, consultas = []) {
  return consultasDe(paciente, consultas).length
}

export function esClienteFrecuente(paciente, consultas = [], minimo = MINIMO_CLIENTE_FRECUENTE) {
  return contarConsultas(paciente, consultas) >= minimo
}

export { UMBRAL_INACTIVO_DIAS, MINIMO_CLIENTE_FRECUENTE }
