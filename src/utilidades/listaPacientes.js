// La lista de Pacientes: las cuatro tarjetas de arriba (total, nuevos este mes, con control vencido y con saldo pendiente) y los filtros rápidos, con UNA sola definición de cada uno
// (reglas 2 y 5): la tarjeta, la etiqueta y la lista que abren cuentan lo mismo, y cuentan como el Inicio, Ventas y Reportes (esInactivo, esDeEsteMes, saldosPorPaciente, pacientesSinAtender).
// Lógica pura, sin pantalla.
import { esInactivo } from "./fidelizacion"
import { esDeEsteMes, pacientesSinAtender } from "./inicio"
import { saldosPorPaciente } from "./saldosVentas"
import { ahoraEcuador } from "./horaEcuador"
import { hoyISO } from "./disponibilidad"

// Un paciente de alta tiene el tratamiento finalizado: así se llama en toda la pantalla (no solo «De alta»).
export const etiquetaEstadoClinico = (estado) => (estado === "De alta" ? "Tratamiento finalizado" : estado)

// Los filtros rápidos, en el orden en que se muestran. `tarjeta`: el que también es una tarjeta de arriba. `ayuda`: lo que explica al pasar el cursor.
// `consultas` / `ventas`: lo que necesita para contarse (sin permiso de Ficha clínica o de Ventas no se ofrece, porque contaría con datos que la persona no recibe).
export const FILTROS_LISTA = [
  { id: "Todos", etiqueta: "Todos", ayuda: "Todos los pacientes registrados, sin filtrar." },
  { id: "NuevosMes", etiqueta: "Nuevos este mes", ayuda: "Pacientes que se registraron en el mes en curso." },
  { id: "ControlVencido", etiqueta: "Control vencido", ayuda: "Su próximo control recomendado ya pasó. No incluye a quienes tienen el tratamiento finalizado.", consultas: true },
  { id: "ConSaldo", etiqueta: "Con saldo pendiente", ayuda: "Tienen una venta con dinero por cobrar (la misma cuenta de Ventas).", ventas: true },
  { id: "SinConsulta", etiqueta: "Sin consulta", ayuda: "Se registraron pero todavía no tienen ninguna consulta (ninguna ficha clínica).", consultas: true },
  { id: "DadosDeAlta", etiqueta: "Dados de alta", ayuda: "Tienen el tratamiento finalizado: el optómetra los dio de alta." },
]

// Los filtros que solo se ven mientras están activos (llegan desde un aviso del Inicio o desde Reportes y se quitan con un gesto): regla 6.
export const FILTROS_POR_ENLACE = {
  ControlSinAgendar: { id: "ControlSinAgendar", etiqueta: "Control sin agendar" },
  NoCompraron: { id: "NoCompraron", etiqueta: "Consultaron y no compraron" },
  Recientes: { id: "Recientes", etiqueta: "Visitas recientes" },
}

// Los conjuntos de ids de cada filtro. Una sola pasada por los datos; la tarjeta, la etiqueta y la lista usan estos mismos conjuntos.
export function conjuntosLista({ pacientes = [], consultas = [], facturas = [], abonos = [], ventas = [], ahora = ahoraEcuador() } = {}) {
  const ids = (lista) => new Set(lista.map((p) => p.id))
  return {
    NuevosMes: ids(pacientes.filter((p) => esDeEsteMes(p.fechaRegistro, ahora))),
    ControlVencido: ids(pacientes.filter((p) => esInactivo(p, consultas))),
    ConSaldo: new Set(saldosPorPaciente({ pacientes, facturas, abonos, ventas }).map((s) => s.pacienteId)),
    SinConsulta: ids(pacientesSinAtender(pacientes, consultas)),
    DadosDeAlta: ids(pacientes.filter((p) => p.estadoClinico === "De alta")),
  }
}

export const cumpleFiltroLista = (paciente, filtro, conjuntos) => (filtro === "Todos" || !conjuntos[filtro] ? true : conjuntos[filtro].has(paciente.id))

// Cuántos pacientes trae cada filtro (sobre todos los pacientes que la persona ve).
export function conteosLista(pacientes, conjuntos) {
  const n = { Todos: pacientes.length }
  for (const k of Object.keys(conjuntos)) n[k] = pacientes.filter((p) => conjuntos[k].has(p.id)).length
  return n
}

// La próxima cita de cada paciente: la más cercana que sigue en pie (pendiente, en espera o en atención) desde hoy; «En atención» de hoy cuenta. Mapa pacienteId → cita.
const ESTADOS_EN_PIE = ["Pendiente", "En Espera", "En Atención"]
const minutos = (hora) => {
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(String(hora || "").trim())
  if (!m) return 0
  return ((Number(m[1]) % 12) + (m[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + Number(m[2])
}
export function proximaCitaPorPaciente(citas = [], hoy = hoyISO()) {
  const mapa = new Map()
  for (const c of citas) {
    if (!c.pacienteId || !ESTADOS_EN_PIE.includes(c.estado) || !c.fecha || c.fecha < hoy) continue
    const actual = mapa.get(c.pacienteId)
    if (!actual || c.fecha < actual.fecha || (c.fecha === actual.fecha && minutos(c.hora) < minutos(actual.hora))) mapa.set(c.pacienteId, c)
  }
  return mapa
}
