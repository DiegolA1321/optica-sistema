// El panel de arriba del CRM (Ronda 5): cumpleaños próximos, los más fieles, los que más refieren y lo del mes. Cada lista sale de las mismas fuentes de sus pestañas
// (Fidelización y Seguimiento), así que lo que se ve arriba es lo que se ve al abrirlas. Lógica pura.
import { ahoraEcuador } from "./horaEcuador"
import { diasParaCumpleanos } from "./fidelizacion"
import { fechaAISO, isoAFechaLocal } from "./disponibilidad"
import { resultadoEfectivo, rankingReferidores } from "./crmContactos"
import { enPeriodo, diaDeRegistro } from "./periodoLista"

// Cuántas personas caben en cada lista del panel de arriba.
export const CUPO_PANEL = 3

const nacimientoDe = (p) => p.fechaNacimiento || p.fecha_nacimiento || p.fechaDeNacimiento || ""
const activo = (p) => !p.anonimizado && p.estadoClinico !== "Anonimizado"
const partes = (nacimiento) => String(nacimiento).split(/[-/T]/).slice(0, 3).map(Number)
const bisiesto = (a) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0
const dosDigitos = (n) => String(n).padStart(2, "0")

// La edad que cumple en el año `anio` (año del cumpleaños menos año de nacimiento).
export const edadAlCumplir = (nacimiento, anio) => { const [a] = partes(nacimiento); return Number.isFinite(a) && a > 0 ? anio - a : null }

// El día de ese año en que cumple (el 29 de febrero, en años no bisiestos, se celebra el 28).
function fechaDeCumple(nacimiento, anio) {
  const [, m, d] = partes(nacimiento)
  if (!m || !d) return null
  return `${anio}-${dosDigitos(m)}-${dosDigitos(m === 2 && d === 29 && !bisiesto(anio) ? 28 : d)}`
}

// Los cumpleaños que vienen, del más cercano al más lejano: [{ paciente, dias, fecha (ISO), edad }]. Hoy cuenta como 0. `edad` es la que cumple.
export function proximosCumpleanos(pacientes = [], hoy = fechaAISO(ahoraEcuador()), limite = Infinity) {
  const inicio = isoAFechaLocal(hoy)
  return pacientes
    .filter(activo)
    .map((p) => ({ paciente: p, dias: diasParaCumpleanos(nacimientoDe(p), inicio) }))
    .filter((x) => x.dias !== null)
    .sort((a, b) => a.dias - b.dias || a.paciente.nombre.localeCompare(b.paciente.nombre))
    .slice(0, limite)
    .map((x) => { const d = new Date(inicio); d.setDate(d.getDate() + x.dias); return { ...x, fecha: fechaAISO(d), edad: edadAlCumplir(nacimientoDe(x.paciente), d.getFullYear()) } })
}

// Los cumpleaños de un mes (`mesOffset` 0 = este mes, 1 = el próximo), por día: [{ paciente, fecha, edad, pasado, grupo }].
// grupo: este mes → «semana» (de hoy al domingo), «adelante» (después del domingo) o «pasaron» (ya fue); el próximo mes → «mes».
export function cumpleanosDelMes(pacientes = [], hoy = fechaAISO(ahoraEcuador()), mesOffset = 0) {
  const base = isoAFechaLocal(hoy)
  const ref = new Date(base.getFullYear(), base.getMonth() + mesOffset, 1)
  const anio = ref.getFullYear()
  const mes = ref.getMonth() + 1
  const domingo = new Date(base); domingo.setDate(base.getDate() + ((7 - base.getDay()) % 7))
  const finSemana = fechaAISO(domingo)
  return pacientes
    .filter(activo)
    .map((p) => { const [, m] = partes(nacimientoDe(p)); return m === mes ? { paciente: p, fecha: fechaDeCumple(nacimientoDe(p), anio) } : null })
    .filter((x) => x && x.fecha)
    .map((x) => {
      const pasado = x.fecha < hoy
      const grupo = mesOffset !== 0 ? "mes" : pasado ? "pasaron" : x.fecha <= finSemana ? "semana" : "adelante"
      return { ...x, edad: edadAlCumplir(nacimientoDe(x.paciente), anio), pasado, grupo }
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.paciente.nombre.localeCompare(b.paciente.nombre))
}

// ¿Ya se le saludó por su cumpleaños en el año de `fecha`? (un contacto del motivo «cumpleanos», de campaña o no)
export const saludadoEnElAnio = (paciente, fecha, contactos = []) => contactos.some((c) => c.pacienteId === paciente.id && c.motivo === "cumpleanos" && diaDeRegistro(c.creadoEn).slice(0, 4) === fecha.slice(0, 4))

// El puesto de cada uno en un ranking ya ordenado: con empates comparten el mismo puesto y el siguiente salta (1, 1, 3, 4).
export function conPuestos(ranking = []) {
  const salida = []
  ranking.forEach((x, i) => salida.push({ ...x, lugar: i > 0 && ranking[i - 1].valor === x.valor ? salida[i - 1].lugar : i + 1 }))
  return salida
}

// El ranking de puntos del programa de fidelización de la óptica (Configuración › Fidelización: consultas, referidos y lo pagado).
export const rankingPorPuntos = (pacientes = [], puntosDe) => pacientes
  .map((p) => ({ paciente: p, valor: puntosDe(p).puntos.total })).filter((x) => x.valor > 0)
  .sort((a, b) => b.valor - a.valor || a.paciente.nombre.localeCompare(b.paciente.nombre))

// «hoy», «mañana», «en 2 días».
export const enDias = (n) => (n === 0 ? "hoy" : n === 1 ? "mañana" : `en ${n} días`)

// Las cuatro listas del panel. `puntosDe(paciente)` es la cuenta del programa ({ puntos: { total }, nivel: { nombre } }).
//   cumples: los 3 próximos (con total del mes), fieles / referidores: los 3 primeros (con el total de quienes aparecen en su ranking), mes: contactados, volvieron a agendar y campañas enviadas.
export function resumenCrm({ pacientes = [], contactos = [], citas = [], puntosDe, hoy = fechaAISO(ahoraEcuador()) }) {
  const cumples = proximosCumpleanos(pacientes, hoy)
  const fieles = conPuestos(rankingPorPuntos(pacientes, puntosDe))
  const referidores = conPuestos(rankingReferidores(pacientes))
  const delMes = contactos.filter((c) => enPeriodo(c.creadoEn, { filtro: "mes", ref: "", desde: "", hasta: "" }, hoy))
  return {
    cumples: { lista: cumples.slice(0, CUPO_PANEL), total: cumples.length, delMes: cumpleanosDelMes(pacientes, hoy, 0).length },
    fieles: { lista: fieles.slice(0, CUPO_PANEL).map((x) => ({ ...x, nivel: puntosDe(x.paciente).nivel?.nombre || "" })), total: fieles.length },
    referidores: { lista: referidores.slice(0, CUPO_PANEL), total: referidores.length, todos: referidores },
    mes: {
      contactados: delMes.length,
      volvieron: delMes.filter((c) => resultadoEfectivo(c, citas) === "agendo").length,
      campanas: new Set(delMes.filter((c) => c.campanaId).map((c) => c.campanaId)).size,
    },
  }
}
