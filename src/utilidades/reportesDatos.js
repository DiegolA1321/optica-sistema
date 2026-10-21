// Reportes: todo lo que se calcula, en un solo lugar y sin pantalla. Cada número viene con la lista exacta de registros que lo
// compone, para que la ventana de detalle muestre el mismo número que se pulsó. Usa las mismas funciones que Citas, Inicio,
// Pacientes y Ventas (filtrosCitas, vendidoCobrado, embudo, fidelizacion…), no cálculos propios.
import { ahoraEcuador } from "./horaEcuador"
import { coincideOrigen, coincideSeguimiento, responsableDeCita } from "./filtrosCitas"
import { vendidoYCobrado } from "./vendidoCobrado"
import { abonosDeFactura } from "./abonos"
import { pagosDeAbono, pagosAlContado } from "./pagos"
import { calcularEmbudo, consultaEsPrimeraVez, tieneReceta } from "./embudo"
import { esInactivo, fechaProximoControl } from "./fidelizacion"
import { estaAtrasada, ordenesAbiertas, ordenesListasSinAvisar } from "./ordenesLaboratorio"
import { resumenPorLaboratorio, productosMasVendidos, ventasPorTipoLuna } from "./reportesLaboratorio"
import { categoriasDeConsulta, claveDiagnostico, etiquetaDeVariantes, diagnosticosPorMes } from "./reportesDiagnosticos"
import { minutosDesdeMedianoche, fechaAISO } from "./disponibilidad"
import { METODOS_PAGO } from "./ventas"
import { edadEnAnios } from "./edad"
import { enRango, diaDe, porcentaje, ultimosMeses } from "./reportesPeriodo"

export const FILTROS_VACIOS = { motivo: "", origen: "todos", visita: "todos", profesional: "" }
export const hayFiltros = (f) => !!f.motivo || (f.origen && f.origen !== "todos") || (f.visita && f.visita !== "todos") || !!f.profesional

const ESTADOS_PENDIENTES = ["Pendiente", "En Espera", "En Atención"]
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100

// ─── Los filtros únicos aplicados a cada tipo de registro ───
// Origen y Visita usan las mismas funciones que el filtro de Citas, así los números coinciden entre los dos módulos.
export function filtrarDatos(datos, filtros = FILTROS_VACIOS) {
  const { pacientes = [], consultas = [], citas = [], facturas = [], pases = [], ordenes = [], historial = consultas } = datos
  const { motivo = "", origen = "todos", visita = "todos", profesional = "" } = filtros
  const hay = hayFiltros(filtros)
  const citaDe = new Map(citas.map((c) => [c.id, c]))
  // Una ficha sin cita se abrió en recepción: su origen es Recepción.
  const origenDeConsulta = (c) => citaDe.get(c.citaId)?.origen ?? "staff"
  const consultasF = consultas.filter((c) =>
    (!motivo || (c.motivo || "").trim() === motivo) &&
    (!profesional || c.profesionalId === profesional) &&
    (origen === "todos" || origenDeConsulta(c) === origen) &&
    (visita === "todos" || consultaEsPrimeraVez(c, historial) === (visita === "primera")))
  const citasF = citas.filter((c) =>
    (!motivo || (c.motivo || "").trim() === motivo) &&
    coincideOrigen(c, origen) &&
    coincideSeguimiento(c, visita, historial) &&
    (!profesional || responsableDeCita(c) === profesional))
  const idsConsultas = new Set(consultasF.map((c) => c.id))
  const idsPacientes = new Set([...consultasF.map((c) => c.pacienteId), ...citasF.map((c) => c.pacienteId)].filter(Boolean))
  return {
    hay,
    consultas: consultasF,
    citas: citasF,
    // Lo que nace de una consulta (ventas, pases, órdenes) se acota por las consultas que pasaron el filtro.
    facturas: hay ? facturas.filter((f) => f.consultaId && idsConsultas.has(f.consultaId)) : facturas,
    pases: hay ? pases.filter((p) => idsConsultas.has(p.consultaId)) : pases,
    ordenes: hay ? ordenes.filter((o) => o.consultaId && idsConsultas.has(o.consultaId)) : ordenes,
    pacientes: hay ? pacientes.filter((p) => idsPacientes.has(p.id)) : pacientes,
  }
}

// ─── Pagos: los registros que componen "Cobrado" ───
// Cada pago de las ventas: los abonos y, si la venta se pagó completa, lo que no vino en abonos (al contado, el día de la venta).
// La suma de las filas es exactamente lo cobrado (cobradoDeFactura). `facturas` ya vienen acotadas por quien llama.
export function pagosDeFacturas(facturas = [], abonos = [], ventasViejas = []) {
  const filas = []
  for (const f of facturas) {
    if (f.estado === "anulada") continue
    const propios = abonosDeFactura(f.id, abonos)
    for (const a of propios) filas.push({ fecha: diaDe(a.fecha), monto: a.monto, factura: f, esAbono: true, abono: a, pagos: pagosDeAbono(a) })
    if (f.estado === "pagada") {
      const resto = redondear((Number(f.montoTotal) || 0) - propios.reduce((s, a) => s + a.monto, 0))
      if (resto > 0) filas.push({ fecha: diaDe(f.creadoEn), monto: resto, factura: f, esAbono: false, pagos: pagosAlContado(f, resto) })
    }
  }
  for (const v of ventasViejas) filas.push({ fecha: diaDe(v.creadoEn), monto: Number(v.montoTotal) || 0, factura: null, venta: v, esAbono: false, pagos: pagosAlContado({ metodoPago: v.metodoPago }, Number(v.montoTotal) || 0) })
  return filas.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0))
}
export const nombreMetodo = (m) => METODOS_PAGO[m] || m || "—"
export const saldoDeFactura = (f, cobrado) => (f.estado === "anulada" ? 0 : Math.max(0, redondear((Number(f.montoTotal) || 0) - cobrado)))

// Una venta de la tabla anterior (una venta = un producto, sin comprobante) con la forma de un comprobante, para listarla igual.
export const comoFactura = (v) => ({ id: `venta-${v.id}`, numero: null, pacienteId: v.pacienteId, montoTotal: Number(v.montoTotal) || 0, estado: "pagada", creadoEn: v.creadoEn, metodoPago: v.metodoPago, facturaElectronica: "", lineas: [], esVentaSuelta: true })

// ─── Las métricas de un período ───
// `f`: lo ya filtrado (filtrarDatos). `datos`: pacientes, historial, ventas (las de antes), abonos.
export function metricasDelPeriodo(f, datos, rango) {
  const en = (v) => enRango(v, rango)
  const { pacientes = [], historial = [], ventas = [], abonos = [] } = datos
  const cons = f.consultas.filter((c) => en(c.fecha))
  const idsPacientesF = new Set(f.pacientes.map((p) => p.id))
  const nuevos = pacientes.filter((p) => en(p.fechaRegistro) && (!f.hay || idsPacientesF.has(p.id)))
  const facturasPeriodo = f.facturas.filter((x) => x.estado !== "anulada" && en(x.creadoEn))
  const viejasPeriodo = f.hay ? [] : ventas.filter((v) => en(v.creadoEn))
  const vc = vendidoYCobrado({ facturas: f.facturas, ventasViejas: f.hay ? [] : ventas, abonos, enPeriodo: en })
  const cs = f.citas.filter((c) => en(c.fecha))
  const programadas = cs.filter((c) => c.estado !== "Cancelada")
  const noAsistio = cs.filter((c) => c.estado === "No Asistió")
  const atendidas = cs.filter((c) => c.estado === "Atendida")
  const canceladas = cs.filter((c) => c.estado === "Cancelada")
  const pendientes = cs.filter((c) => ESTADOS_PENDIENTES.includes(c.estado))
  const embudo = calcularEmbudo({ consultas: f.consultas, pases: f.pases, facturas: f.facturas, enRango: en, historial, conReceta: true })
  const saldo = Math.max(0, redondear(vc.vendido - vc.cobrado))
  return {
    cons, nuevos, facturasPeriodo, viejasPeriodo, vc, saldo,
    // Todo lo vendido en el período, con la forma de un comprobante: la lista detrás de "Vendido".
    ventasLista: [...facturasPeriodo, ...viejasPeriodo.map(comoFactura)],
    cs, programadas, noAsistio, atendidas, canceladas, pendientes,
    tasaInasist: porcentaje(noAsistio.length, programadas.length),
    embudo, captacion: embudo.compraronSobreConsultaron,
    ticket: vc.cantidad > 0 ? redondear(vc.vendido / vc.cantidad) : null,
    ingresoPorConsulta: cons.length > 0 ? redondear(vc.vendido / cons.length) : null,
  }
}

// ─── Citas ───
const DIAS_SEMANA = [{ id: 1, etiqueta: "Lun" }, { id: 2, etiqueta: "Mar" }, { id: 3, etiqueta: "Mié" }, { id: 4, etiqueta: "Jue" }, { id: 5, etiqueta: "Vie" }, { id: 6, etiqueta: "Sáb" }, { id: 0, etiqueta: "Dom" }]
const diaDeSemana = (iso) => { const [a, m, d] = iso.split("-").map(Number); return new Date(a, m - 1, d).getDay() }
export const horaDeCita = (c) => Math.floor(minutosDesdeMedianoche(c.hora) / 60)

// Cuadrícula día × hora: cuántas citas no efectuadas hubo en cada celda y de cuántas citas (sin canceladas).
export function cuadriculaInasistencias(citasPeriodo) {
  const prog = citasPeriodo.filter((c) => c.estado !== "Cancelada" && c.fecha && c.hora)
  if (prog.length === 0) return { dias: [], horas: [], celdas: new Map(), max: 0 }
  const celdas = new Map()
  for (const c of prog) {
    const clave = `${diaDeSemana(c.fecha)}-${horaDeCita(c)}`
    const x = celdas.get(clave) || { citas: [], noAsistio: [] }
    x.citas.push(c)
    if (c.estado === "No Asistió") x.noAsistio.push(c)
    celdas.set(clave, x)
  }
  const horasUsadas = prog.map(horaDeCita)
  const desde = Math.min(...horasUsadas), hasta = Math.max(...horasUsadas)
  const horas = Array.from({ length: hasta - desde + 1 }, (_, i) => desde + i)
  const usados = new Set(prog.map((c) => diaDeSemana(c.fecha)))
  const dias = DIAS_SEMANA.filter((d) => d.id !== 0 || usados.has(0))
  return { dias, horas, celdas, max: Math.max(0, ...[...celdas.values()].map((x) => x.noAsistio.length)) }
}

// Tasa de citas no efectuadas mes a mes (con los filtros, sin acotar al período).
export function tendenciaInasistencia(citasF, hoy = ahoraEcuador(), n = 12) {
  return ultimosMeses(n, hoy).map((m) => {
    const delMes = citasF.filter((c) => enRango(c.fecha, m) && c.estado !== "Cancelada")
    const noAsistio = delMes.filter((c) => c.estado === "No Asistió")
    return { ...m, programadas: delMes, noAsistio, tasa: porcentaje(noAsistio.length, delMes.length) }
  })
}

// Citas del período agrupadas por una clave (origen, visita, profesional): cuántas, cuántas se atendieron y cuántas no efectuadas.
export function resumenCitasPor(citasPeriodo, claves, claveDe) {
  const filas = claves.map((k) => ({ ...k, citas: [], atendidas: [], noAsistio: [] }))
  const por = new Map(filas.map((x) => [x.id, x]))
  for (const c of citasPeriodo) {
    if (c.estado === "Cancelada") continue
    const x = por.get(claveDe(c)) || null
    if (!x) continue
    x.citas.push(c)
    if (c.estado === "Atendida") x.atendidas.push(c)
    if (c.estado === "No Asistió") x.noAsistio.push(c)
  }
  return filas.map((x) => ({ ...x, tasa: porcentaje(x.noAsistio.length, x.citas.length) }))
}
export const ORIGENES = [{ id: "paciente", etiqueta: "Web" }, { id: "staff", etiqueta: "Recepción" }]
export const VISITAS = [{ id: "primera", etiqueta: "Primera vez" }, { id: "seguimiento", etiqueta: "Seguimiento" }]

// Controles que vencían en el período y cuántos se agendaron. Un control vence a los `proximoControlDias` de la consulta
// (180 si no se indicó). Cuenta a la persona una vez, con su última consulta cuyo control cae en el período y no se
// adelantó (si volvió antes de esa fecha, el control ya era otro). "Agendó" = tiene una consulta o una cita (no cancelada) posterior.
export function efectividadControles({ consultas = [], citas = [], pacientes = [], rango }) {
  const porPaciente = new Map()
  for (const c of consultas) if (c.pacienteId && c.fecha) (porPaciente.get(c.pacienteId) || porPaciente.set(c.pacienteId, []).get(c.pacienteId)).push(c)
  const filas = []
  for (const [pacienteId, suyas] of porPaciente) {
    const paciente = pacientes.find((p) => p.id === pacienteId)
    if (!paciente || paciente.estadoClinico === "De alta") continue
    const candidatas = suyas.map((c) => ({ c, control: fechaProximoControl({ ...paciente, estadoClinico: "" }, [c]) })).filter((x) => x.control)
      .map((x) => ({ ...x, fechaControl: fechaAISO(x.control) }))
      .filter((x) => enRango(x.fechaControl, rango) && !suyas.some((o) => o.fecha > x.c.fecha && o.fecha < x.fechaControl))
      .sort((a, b) => (a.c.fecha < b.c.fecha ? 1 : -1))
    if (candidatas.length === 0) continue
    const { c, fechaControl } = candidatas[0]
    const agendo = suyas.some((o) => o.fecha > c.fecha) || citas.some((x) => x.pacienteId === pacienteId && x.estado !== "Cancelada" && x.fecha > c.fecha)
    filas.push({ paciente, consulta: c, fechaControl, agendo })
  }
  return { filas: filas.sort((a, b) => (a.fechaControl < b.fechaControl ? -1 : 1)), agendaron: filas.filter((x) => x.agendo), sinAgendar: filas.filter((x) => !x.agendo) }
}

// ─── Clínico ───
// Diagnósticos del período: pacientes distintos por diagnóstico (con su consulta más reciente), el más frecuente primero.
export function diagnosticosDelPeriodo(consultasPeriodo) {
  const grupos = new Map()
  for (const c of consultasPeriodo) {
    for (const texto of categoriasDeConsulta(c)) {
      const clave = claveDiagnostico(texto)
      if (!clave) continue
      const g = grupos.get(clave) || { variantes: new Map(), porPaciente: new Map() }
      g.variantes.set(texto, (g.variantes.get(texto) || 0) + 1)
      const quien = c.pacienteId ?? `c${c.id}`
      const previa = g.porPaciente.get(quien)
      if (!previa || c.fecha > previa.fecha) g.porPaciente.set(quien, c)
      grupos.set(clave, g)
    }
  }
  return [...grupos.entries()]
    .map(([clave, g]) => ({ clave, diagnostico: etiquetaDeVariantes(g.variantes), consultas: [...g.porPaciente.values()], pacientes: g.porPaciente.size }))
    .sort((a, b) => b.pacientes - a.pacientes || a.diagnostico.localeCompare(b.diagnostico))
}

export const GRUPOS_EDAD = [
  { id: "menor18", etiqueta: "Menores de 18", cabe: (e) => e < 18 },
  { id: "18a39", etiqueta: "18 a 39", cabe: (e) => e >= 18 && e <= 39 },
  { id: "40a59", etiqueta: "40 a 59", cabe: (e) => e >= 40 && e <= 59 },
  { id: "60mas", etiqueta: "60 o más", cabe: (e) => e >= 60 },
]
// Diagnósticos por grupo de edad (la edad que tenía el paciente el día de la consulta). Devuelve los `limite` más frecuentes.
export function diagnosticosPorEdad(consultasPeriodo, pacientes = [], limite = 8) {
  const nacimiento = new Map(pacientes.map((p) => [p.id, p.fecha_nacimiento]))
  const dias = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split("-").map(Number); return new Date(a, m - 1, d) }
  const grupoDe = (c) => {
    const e = edadEnAnios(nacimiento.get(c.pacienteId), dias(c.fecha))
    return e == null ? "sinDato" : GRUPOS_EDAD.find((g) => g.cabe(e)).id
  }
  const filas = diagnosticosDelPeriodo(consultasPeriodo).slice(0, limite).map((d) => {
    const porGrupo = { sinDato: [] }
    for (const g of GRUPOS_EDAD) porGrupo[g.id] = []
    for (const c of d.consultas) porGrupo[grupoDe(c)].push(c)
    return { clave: d.clave, diagnostico: d.diagnostico, total: d.pacientes, porGrupo }
  })
  return { filas, haySinDato: filas.some((x) => x.porGrupo.sinDato.length > 0) }
}

export const ESTADOS_CORRECCION = ["Bien corregido", "Requiere ajuste", "Sin evaluar", "Sin evaluación"]
export function pacientesPorCorreccion(pacientes) {
  const mapa = Object.fromEntries(ESTADOS_CORRECCION.map((e) => [e, []]))
  for (const p of pacientes) (mapa[p.estadoCorreccion] || mapa["Sin evaluación"]).push(p)
  return mapa
}
export const pacientesControlVencido = (pacientes, historial) => pacientes.filter((p) => esInactivo(p, historial))
export const pacientesDeAlta = (pacientes) => pacientes.filter((p) => p.estadoClinico === "De alta")
export { diagnosticosPorMes }

// ─── Ventas ───
export function ventasPorMetodo(facturasPeriodo) {
  const mapa = new Map()
  for (const f of facturasPeriodo) {
    const clave = f.metodoPago || "sin"
    const x = mapa.get(clave) || { id: clave, etiqueta: nombreMetodo(f.metodoPago), facturas: [], monto: 0 }
    x.facturas.push(f)
    x.monto = redondear(x.monto + (Number(f.montoTotal) || 0))
    mapa.set(clave, x)
  }
  return [...mapa.values()].sort((a, b) => b.monto - a.monto)
}
export const sinFacturaElectronica = (facturasPeriodo) => facturasPeriodo.filter((f) => !String(f.facturaElectronica || "").trim())

// Las líneas vendidas (producto o luna) de los comprobantes del período, con los mismos criterios que los rankings.
export function lineasVendidas(facturas, rango, tipo) {
  const filas = []
  for (const f of facturas) {
    if (f.estado === "anulada" || !enRango(f.creadoEn, rango)) continue
    for (const l of f.lineas || []) if (l.tipo === tipo) filas.push({ factura: f, linea: l, cantidad: Number(l.cantidad) || 1 })
  }
  return filas
}
export const rankingProductos = (facturas, ventasViejas, rango, limite = 8) => productosMasVendidos({ facturas, ventas: ventasViejas, enRango: (v) => enRango(v, rango), limite })
export const lunasPorTipo = (facturas, rango) => ventasPorTipoLuna(facturas, { enRango: (v) => enRango(v, rango) })

// ─── Laboratorios ───
export function resumenLaboratorios(ordenes, rango, hoy = ahoraEcuador()) {
  return resumenPorLaboratorio(ordenes, { hoy, enRango: (cuando) => !!cuando && enRango(cuando, rango) })
}
export { estaAtrasada, ordenesAbiertas, ordenesListasSinAvisar, tieneReceta }
