// Cálculos del Inicio por rol (R52-R56). Cada fila de tarjetas habla de una sola cosa y lo dice en su título:
// "Totales", "Hoy", "Este mes" o "Para vender". Funciones puras, con los datos que ya carga la aplicación.
import { esHoy, parseFechaFlexible, minutosDesdeMedianoche } from "./disponibilidad"
import { saldoFactura } from "./abonos"

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
    siguiente: porVenir.find((c) => c.estado !== "Cancelada") || null,
    citas: vigentes,
  }
}

// Citas del mes en curso: atendidas, no atendidas (no asistió) y canceladas.
export function resumenMes(citas, ahora = new Date()) {
  const delMes = citas.filter((c) => { const f = parseFechaFlexible(c.fecha); return f && f.getFullYear() === ahora.getFullYear() && f.getMonth() === ahora.getMonth() })
  const cuenta = (estado) => delMes.filter((c) => c.estado === estado).length
  return { registradas: delMes.length, atendidas: cuenta("Atendida"), noAtendidas: cuenta("No Asistió"), canceladas: cuenta("Cancelada") }
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
