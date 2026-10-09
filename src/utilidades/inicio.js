import { ahoraEcuador } from "./horaEcuador"
// Cálculos del Inicio por rol (R52-R56). Cada fila de tarjetas habla de una sola cosa y lo dice en su título:
// "Totales", "Hoy", "Este mes" o "Para vender". Funciones puras, con los datos que ya carga la aplicación.
import { esHoy, hoyISO, fechaAISO, parseFechaFlexible, minutosDesdeMedianoche } from "./disponibilidad"
import { saldoFactura } from "./abonos"
import { lunesDeSemana, sumarDiasISO } from "./calendarioSemana"

export const PLANTILLAS_INICIO = ["administrador", "optometra", "recepcion", "ventas", "general"]

// Qué Inicio corresponde a la vista activa. Sin vista de rol, el administrador ve el del negocio.
export function plantillaInicio(vista, usuario) {
  if (vista?.tipo === "rol") return PLANTILLAS_INICIO.includes(vista.inicio) ? vista.inicio : "general"
  if (usuario?.rol === "admin" || usuario?.rol === "superadmin") return "administrador"
  return "general"
}

// "Propio" (R49): asignadas a mí, atendidas por mí, o que todavía no tienen responsable.
export const esCitaPropia = (cita, usuarioId) => (cita.asignadoA === usuarioId) || (cita.atendidoPor === usuarioId) || (!cita.asignadoA && !cita.atendidoPor)
export const citasPropias = (citas, usuarioId) => citas.filter((c) => esCitaPropia(c, usuarioId))

const ordenar = (lista) => lista.slice().sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
const sinCancelar = (c) => c.estado !== "Cancelada"

// Resumen del día: todo lo de hoy con sus estados.
export function resumenHoy(citas) {
  const hoy = citas.filter((c) => esHoy(c.fecha))
  const vigentes = ordenar(hoy.filter(sinCancelar))
  const cuenta = (estado) => hoy.filter((c) => c.estado === estado).length
  const porVenir = vigentes.filter((c) => !["Atendida", "No Asistió", "En Atención"].includes(c.estado))
  return {
    total: vigentes.length,
    pendientes: cuenta("Pendiente"),
    enEspera: cuenta("En Espera"),
    enAtencion: cuenta("En Atención"),
    atendidas: cuenta("Atendida"),
    noAsistieron: cuenta("No Asistió"),
    canceladas: cuenta("Cancelada"),
    // Quien ya llegó (En espera) va primero: está en la sala, y el que sigue por hora puede no haber llegado todavía.
    siguiente: porVenir.find((c) => c.estado === "En Espera") || porVenir.find((c) => c.estado !== "Cancelada") || null,
    citas: vigentes,
  }
}

// Períodos del desenlace: "hoy", "semana" (lunes a domingo, igual que Citas), "mes" (el mes en curso) o "siempre".
export const PERIODOS_DESENLACE = [["hoy", "Hoy"], ["semana", "Esta semana"], ["mes", "Este mes"], ["siempre", "Todas"]]

// Las citas que caen dentro del período.
export function citasDelPeriodo(citas, periodo = "mes", ahora = ahoraEcuador()) {
  if (periodo === "siempre") return citas
  const hoy = fechaAISO(ahora)
  const isoDe = (c) => { const f = parseFechaFlexible(c.fecha); return f ? fechaAISO(f) : null }
  if (periodo === "hoy") return citas.filter((c) => isoDe(c) === hoy)
  if (periodo === "semana") {
    const lunes = lunesDeSemana(hoy), domingo = sumarDiasISO(lunes, 6)
    return citas.filter((c) => { const i = isoDe(c); return i && i >= lunes && i <= domingo })
  }
  return citas.filter((c) => { const f = parseFechaFlexible(c.fecha); return f && f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth() })
}

// Desenlace de las citas en un período. Cuenta atendidas, no asistieron y canceladas. "registradas" son las citas del período sin
// las canceladas (las mismas que lista el Inicio y que muestra Citas por defecto); las canceladas se cuentan aparte.
// "enAtencion" son las que, dentro del período, están en atención en este momento.
export function resumenPeriodo(citas, periodo = "mes", ahora = ahoraEcuador()) {
  const delPeriodo = citasDelPeriodo(citas, periodo, ahora)
  const cuenta = (estado) => delPeriodo.filter((c) => c.estado === estado).length
  return { registradas: delPeriodo.filter(sinCancelar).length, atendidas: cuenta("Atendida"), noAtendidas: cuenta("No Asistió"), canceladas: cuenta("Cancelada"), enAtencion: cuenta("En Atención") }
}

// Las citas del período para la lista del Inicio, según la tarjeta del desenlace elegida (atendida | noAsistio | cancelada | null).
// Sin tarjeta elegida no entran las canceladas (igual que "Todas" en Citas). Hoy y la semana van en orden de agenda; el mes y "Todas", las más recientes primero.
const ESTADO_POR_TARJETA = { atendida: "Atendida", noAsistio: "No Asistió", cancelada: "Cancelada" }
export function citasParaLista(citas, periodo, tarjeta = null, ahora = ahoraEcuador()) {
  const delPeriodo = citasDelPeriodo(citas, periodo, ahora)
  const filtradas = tarjeta ? delPeriodo.filter((c) => c.estado === ESTADO_POR_TARJETA[tarjeta]) : delPeriodo.filter(sinCancelar)
  const clave = (c) => { const f = parseFechaFlexible(c.fecha); return (f ? fechaAISO(f) : "") + String(minutosDesdeMedianoche(c.hora)).padStart(5, "0") }
  const asc = periodo === "hoy" || periodo === "semana"
  return filtradas.slice().sort((a, b) => (asc ? (clave(a) < clave(b) ? -1 : 1) : (clave(a) < clave(b) ? 1 : -1)))
}

// Cuántos registros se dieron de alta este mes (para el "+N este mes" de los Totales). Sin fecha de alta no cuenta.
export function creadosEsteMes(lista, campo, ahora = ahoraEcuador()) {
  return lista.filter((x) => { const f = x[campo] ? new Date(x[campo]) : null; return f && !isNaN(f) && f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth() }).length
}
export const resumenMes = (citas, ahora) => resumenPeriodo(citas, "mes", ahora)

// Primer y último día del mes en curso, en ISO (para abrir Citas filtrada por el mismo período).
export function rangoDelMes(ahora = ahoraEcuador()) {
  const y = ahora.getFullYear(), m = ahora.getMonth()
  return { desde: fechaAISO(new Date(y, m, 1)), hasta: fechaAISO(new Date(y, m + 1, 0)) }
}

// "Hoy": la agenda del día; si hoy no hay citas, las próximas (nunca las ya pasadas).
export function agendaHoyOProximas(citas, limite = 5, hoy = hoyISO()) {
  const delDia = resumenHoy(citas).citas
  if (delDia.length > 0) return { modo: "hoy", citas: delDia }
  const proximas = citas
    .filter((c) => sinCancelar(c) && c.estado !== "Atendida" && c.estado !== "No Asistió" && String(c.fecha) > hoy)
    .sort((a, b) => (String(a.fecha) < String(b.fecha) ? -1 : String(a.fecha) > String(b.fecha) ? 1 : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)))
    .slice(0, limite)
  return { modo: "proximas", citas: proximas }
}

// Pacientes que todavía no tuvieron ninguna consulta.
export function pacientesSinAtender(pacientes, consultas) {
  const conConsulta = new Set(consultas.map((c) => c.pacienteId).filter(Boolean))
  return pacientes.filter((p) => !conConsulta.has(p.id))
}

// Lo que se debe cobrar: ventas con saldo y la suma.
export function saldosPorCobrar(facturas, abonos) {
  const conSaldo = facturas.map((f) => ({ f, saldo: saldoFactura(f, abonos) })).filter((x) => x.saldo > 0)
  return { cantidad: conSaldo.length, total: Math.round(conSaldo.reduce((s, x) => s + x.saldo, 0) * 100) / 100 }
}

// Pacientes a los que ya se les dio una proforma y siguen "lo pensará" (listo con proforma entregada).
export const proformasEnSeguimiento = (pases) => pases.filter((p) => p.estado === "listo" && p.proformaEntregadaEn)
export const pasesListos = (pases) => pases.filter((p) => p.estado === "listo")

// Fichas sin terminar: las atenciones que esta persona dejó abiertas ("En Atención" a su nombre), la más antigua primero.
export function fichasSinTerminar(citas, usuarioId) {
  return citas
    .filter((c) => c.estado === "En Atención" && usuarioId != null && c.atendidoPor === usuarioId)
    .sort((a, b) => (String(a.fecha) < String(b.fecha) ? -1 : String(a.fecha) > String(b.fecha) ? 1 : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)))
}
