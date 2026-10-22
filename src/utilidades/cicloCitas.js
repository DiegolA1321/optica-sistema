// Las cuentas de las dos tarjetas de la pestaña Citas del perfil: «Asistencia a sus citas» y «Su ciclo de control». Lógica pura.

const PENDIENTES = ["Pendiente", "En Espera", "En Atención"]
const porFechaHora = (a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : String(b.hora || "").localeCompare(String(a.hora || "")))

// «N de M citas atendidas (X %)»: M son las citas que ya se resolvieron (atendidas, no efectuadas y canceladas); las pendientes se cuentan aparte. Sin ninguna resuelta, no hay porcentaje.
export function asistenciaDeCitas(citas = []) {
  const n = (estados) => citas.filter((c) => estados.includes(c.estado)).length
  const atendidas = n(["Atendida"]), noEfectuadas = n(["No Asistió"]), canceladas = n(["Cancelada"]), pendientes = n(PENDIENTES)
  const resueltas = atendidas + noEfectuadas + canceladas
  return { atendidas, noEfectuadas, canceladas, pendientes, resueltas, porcentaje: resueltas > 0 ? Math.round((atendidas / resueltas) * 100) : null }
}

// Las citas por estado, para filtrar el historial con lo mismo que cuenta la tarjeta. «resueltas» son las M del porcentaje.
export const ESTADOS_DE_FILTRO = {
  resueltas: ["Atendida", "No Asistió", "Cancelada"],
  atendidas: ["Atendida"],
  noEfectuadas: ["No Asistió"],
  canceladas: ["Cancelada"],
  pendientes: PENDIENTES,
}
export const NOMBRE_FILTRO = { resueltas: "Citas resueltas", atendidas: "Atendidas", noEfectuadas: "No efectuadas", canceladas: "Canceladas", pendientes: "Pendientes" }

// «Faltó a sus 2 últimas citas»: las dos últimas citas en las que se sabe si vino (atendida o no efectuada; una cancelada no es una falta) son no efectuadas. Devuelve esas citas (la más reciente primero) o [].
export function faltasSeguidas(citas = [], cuantas = 2) {
  const ultimas = citas.filter((c) => c.estado === "Atendida" || c.estado === "No Asistió").slice().sort(porFechaHora).slice(0, cuantas)
  return ultimas.length === cuantas && ultimas.every((c) => c.estado === "No Asistió") ? ultimas : []
}

const dias = (a, b) => Math.round((Date.UTC(...b.split("-").map((x, i) => (i === 1 ? x - 1 : +x))) - Date.UTC(...a.split("-").map((x, i) => (i === 1 ? x - 1 : +x)))) / 86400000)

// El ciclo entre la última consulta (o, sin ella, el registro) y el control recomendado: los días que faltan (negativos si ya venció) y dónde está hoy en la barra (0 a 100).
export function cicloDeControl({ inicio, control, hoy }) {
  if (!inicio || !control) return null
  const total = Math.max(1, dias(inicio, control))
  const transcurridos = dias(inicio, hoy)
  return { diasParaControl: dias(hoy, control), avance: Math.max(0, Math.min(100, Math.round((transcurridos / total) * 100))), vencido: dias(hoy, control) < 0 }
}

// «Viene en promedio cada N meses»: el promedio de días entre los días distintos en que vino, en meses (mínimo 1). Varias atenciones el mismo día cuentan como una sola visita. Solo con dos o más
// días distintos; si no, null.
export function promedioEntreConsultas(consultas = []) {
  const fechas = [...new Set(consultas.map((k) => k.fecha).filter((f) => /^\d{4}-\d{2}-\d{2}/.test(f || "")).map((f) => f.slice(0, 10)))].sort()
  if (fechas.length < 2) return null
  const promedio = dias(fechas[0], fechas[fechas.length - 1]) / (fechas.length - 1)
  return Math.max(1, Math.round(promedio / 30.44))
}
