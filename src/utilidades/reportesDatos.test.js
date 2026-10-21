import { describe, it, expect } from "vitest"
import { filtrarDatos, metricasDelPeriodo, FILTROS_VACIOS, pagosDeFacturas, cuadriculaInasistencias, tendenciaInasistencia, resumenCitasPor, ORIGENES, VISITAS, efectividadControles, diagnosticosDelPeriodo, diagnosticosPorEdad, pacientesPorCorreccion, ventasPorMetodo, sinFacturaElectronica, lineasVendidas, lunasPorTipo, rankingProductos } from "./reportesDatos"
import { citaPasaFiltros, coincideSeguimiento } from "./filtrosCitas"
import { filtrarComprobantes } from "./saldosVentas"
import { vendidoYCobrado } from "./vendidoCobrado"
import { ventasDelMes } from "./inicio"
import { calcularEmbudo } from "./embudo"
import { esInactivo } from "./fidelizacion"
import { resumenPorLaboratorio } from "./reportesLaboratorio"
import { enRango } from "./reportesPeriodo"

// Los números de Reportes son los mismos que cuentan Citas, Ventas, Pacientes y el Inicio con los mismos filtros, con cualquier dato.
// Los datos se generan con una semilla fija (cada corrida es igual) y se cuentan con las funciones de los otros módulos.
const semilla = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const elegir = (azar, lista) => lista[Math.floor(azar() * lista.length)]
const dos = (n) => String(n).padStart(2, "0")
const dia = (azar) => `2026-${dos(8 + Math.floor(azar() * 3))}-${dos(1 + Math.floor(azar() * 28))}` // ago, sept y oct de 2026
const ESTADOS = ["Pendiente", "En Espera", "En Atención", "Atendida", "Atendida", "No Asistió", "No Asistió", "Cancelada"]
const MOTIVOS = ["Consulta General", "Examen de Control", "Primera consulta"]
const PROFESIONALES = ["u1", "u2", undefined]
const RANGO = { inicio: "2026-09-01", fin: "2026-10-12" }

function generar(azar) {
  const pacientes = Array.from({ length: 8 }, (_, i) => ({ id: "p" + i, nombre: "Paciente " + i, cedula: "170000000" + i, telefono: "09900000" + i, fechaRegistro: dia(azar), fecha_nacimiento: `${1950 + Math.floor(azar() * 60)}-0${1 + Math.floor(azar() * 9)}-15`, estadoCorreccion: elegir(azar, ["Bien corregido", "Requiere ajuste", "Sin evaluar", undefined]), estadoClinico: azar() < 0.15 ? "De alta" : "Activo" }))
  const citas = Array.from({ length: 30 }, (_, i) => ({ id: "c" + i, pacienteId: elegir(azar, pacientes).id, paciente: "x", fecha: dia(azar), hora: `${dos(8 + Math.floor(azar() * 8))}:00 ${azar() < 0.5 ? "AM" : "PM"}`.replace(/^(1[3-9]|2\d)/, "09"), estado: elegir(azar, ESTADOS), origen: elegir(azar, ["paciente", "staff"]), motivo: elegir(azar, MOTIVOS), asignadoA: elegir(azar, PROFESIONALES), atendidoPor: azar() < 0.3 ? elegir(azar, ["u1", "u2"]) : undefined, canceladaPor: elegir(azar, ["paciente", "staff"]) }))
  const consultas = Array.from({ length: 24 }, (_, i) => ({ id: "k" + i, pacienteId: elegir(azar, pacientes).id, fecha: dia(azar), motivo: elegir(azar, MOTIVOS), profesionalId: elegir(azar, ["u1", "u2"]), citaId: azar() < 0.7 ? elegir(azar, citas).id : undefined, od: { esfera: azar() < 0.8 ? "-1.00" : "" }, oi: {}, diagnosticoCategorias: [elegir(azar, ["Miopía", "Astigmatismo", "Presbicia"])], proximoControlDias: 90 }))
  const facturas = Array.from({ length: 14 }, (_, i) => ({ id: "f" + i, numero: i + 1, pacienteId: elegir(azar, pacientes).id, consultaId: azar() < 0.8 ? elegir(azar, consultas).id : undefined, estado: elegir(azar, ["pagada", "pagada", "pendiente_pago", "anulada"]), montoTotal: 50 + Math.floor(azar() * 200), creadoEn: `${dia(azar)}T${dos(10 + Math.floor(azar() * 12))}:00:00-05:00`, metodoPago: elegir(azar, ["directo", "tarjeta", "cuotas"]), facturaElectronica: azar() < 0.4 ? "001-001-000000123" : "", lineas: [{ tipo: "luna", cantidad: 1, precioUnitario: 40, descripcion: "Luna", detalle: { tipo_lente: elegir(azar, ["monofocal", "progresivo"]) } }, { tipo: "producto", cantidad: 1 + Math.floor(azar() * 2), precioUnitario: 30, descripcion: elegir(azar, ["Montura A", "Montura B"]) }] }))
  const abonos = facturas.filter((f) => f.estado === "pendiente_pago").flatMap((f) => [{ id: "a" + f.id, facturaId: f.id, monto: Math.floor(f.montoTotal / 3), fecha: dia(azar), creadoEn: "2026-10-01T10:00:00Z" }])
  return { pacientes, citas, consultas, historial: consultas, facturas, abonos, ventas: [], pases: [], ordenes: [] }
}

describe("Reportes cuenta lo mismo que Citas, con los mismos filtros", () => {
  it("las citas de cada estado, origen, visita y profesional coinciden con la lista de Citas (40 conjuntos de datos)", () => {
    const azar = semilla(20261012)
    for (let corrida = 0; corrida < 40; corrida++) {
      const datos = generar(azar)
      const filtros = { motivo: elegir(azar, ["", ...MOTIVOS]), origen: elegir(azar, ["todos", "paciente", "staff"]), visita: elegir(azar, ["todos", "primera", "seguimiento"]), profesional: elegir(azar, ["", "u1", "u2"]) }
      const f = filtrarDatos(datos, filtros)
      const m = metricasDelPeriodo(f, datos, RANGO)
      const enCitas = (estado) => datos.citas.filter((c) => citaPasaFiltros(c, { estado, alta: "todas", origen: filtros.origen, seguimiento: filtros.visita, responsable: filtros.profesional || "todos", motivo: filtros.motivo, texto: "", periodo: { filtro: "todas", desde: RANGO.inicio, hasta: RANGO.fin } }, datos.historial)).length
      expect(m.programadas.length + m.canceladas.length, "Citas «Todas» (canceladas aparte) = citas del período + canceladas").toBe(enCitas("todas"))
      expect(m.atendidas.length).toBe(enCitas("atendida"))
      expect(m.noAsistio.length).toBe(enCitas("noAsistio"))
      expect(m.canceladas.length).toBe(enCitas("cancelada"))
      expect(m.pendientes.length, "Pendientes = por atender").toBe(enCitas("abiertas"))
      // Las partes suman el total que se anuncia; lo cancelado va aparte.
      expect(m.atendidas.length + m.noAsistio.length + m.pendientes.length).toBe(m.programadas.length)
    }
  })

  it("origen y visita usan exactamente el criterio del filtro de Citas", () => {
    const azar = semilla(7)
    const datos = generar(azar)
    const web = filtrarDatos(datos, { ...FILTROS_VACIOS, origen: "paciente" }).citas
    expect(web.every((c) => c.origen === "paciente")).toBe(true)
    const primera = filtrarDatos(datos, { ...FILTROS_VACIOS, visita: "primera" }).citas
    expect(primera.every((c) => coincideSeguimiento(c, "primera", datos.historial))).toBe(true)
    expect(web.length + datos.citas.filter((c) => c.origen === "staff").length).toBe(datos.citas.length)
  })
})

describe("Reportes cuenta lo mismo que Ventas y el Inicio", () => {
  it("Vendido, Saldo pendiente y Sin factura electrónica coinciden con la lista de comprobantes de Ventas (40 conjuntos)", () => {
    const azar = semilla(20261013)
    for (let corrida = 0; corrida < 40; corrida++) {
      const datos = generar(azar)
      const f = filtrarDatos(datos, FILTROS_VACIOS)
      const m = metricasDelPeriodo(f, datos, RANGO)
      const filtro = { desde: RANGO.inicio, hasta: RANGO.fin, periodo: "rango", pacientes: datos.pacientes, abonos: datos.abonos }
      const vigentes = filtrarComprobantes(datos.facturas, { ...filtro, estado: "vigentes" })
      expect(m.facturasPeriodo.map((x) => x.id).sort()).toEqual(vigentes.map((x) => x.id).sort())
      expect(m.vc.vendido).toBeCloseTo(vigentes.reduce((s, x) => s + x.montoTotal, 0), 2)
      const conSaldo = filtrarComprobantes(datos.facturas, { ...filtro, estado: "saldo" })
      const saldo = conSaldo.reduce((s, x) => s + (x.montoTotal - datos.abonos.filter((a) => a.facturaId === x.id).reduce((t, a) => t + a.monto, 0)), 0)
      expect(m.saldo).toBeCloseTo(saldo, 2)
      expect(sinFacturaElectronica(m.facturasPeriodo).map((x) => x.id).sort()).toEqual(filtrarComprobantes(datos.facturas, { ...filtro, estado: "vigentes", sinFacturaElectronica: true }).map((x) => x.id).sort())
      // Vendido = Cobrado + Saldo, y los pagos de la lista suman exactamente lo cobrado.
      expect(m.vc.vendido).toBeCloseTo(m.vc.cobrado + m.saldo, 2)
      const pagos = pagosDeFacturas(m.facturasPeriodo, datos.abonos, m.viejasPeriodo)
      expect(pagos.reduce((s, p) => s + p.monto, 0)).toBeCloseTo(m.vc.cobrado, 2)
    }
  })

  it("'Vendido' de este mes es el mismo número que la tarjeta Ventas del Inicio", () => {
    const azar = semilla(99)
    const datos = generar(azar)
    const ahora = new Date(2026, 9, 12, 20, 0)
    const mes = { inicio: "2026-10-01", fin: "2026-10-31" }
    const reportes = vendidoYCobrado({ facturas: datos.facturas, abonos: datos.abonos, enPeriodo: (v) => enRango(v, mes) })
    const inicio = ventasDelMes(datos.facturas, ahora, datos.abonos)
    expect(inicio.total).toBe(reportes.vendido)
    expect(inicio.cobrado).toBe(reportes.cobrado)
  })

  it("el ticket promedio y el ingreso por consulta son Vendido entre ventas y Vendido entre consultas", () => {
    const azar = semilla(5)
    const datos = generar(azar)
    const m = metricasDelPeriodo(filtrarDatos(datos, FILTROS_VACIOS), datos, RANGO)
    expect(m.ticket).toBeCloseTo(m.vc.vendido / m.vc.cantidad, 2)
    expect(m.ingresoPorConsulta).toBeCloseTo(m.vc.vendido / m.cons.length, 2)
  })

  it("con filtros de consulta solo cuentan las ventas que salieron de una consulta que pasa el filtro", () => {
    const datos = { ...generar(semilla(3)) }
    const f = filtrarDatos(datos, { ...FILTROS_VACIOS, motivo: "Examen de Control" })
    const ids = new Set(f.consultas.map((c) => c.id))
    expect(f.facturas.every((x) => x.consultaId && ids.has(x.consultaId))).toBe(true)
  })
})

describe("Reportes cuenta lo mismo que Pacientes", () => {
  it("el control vencido y los tratamientos finalizados son los de Pacientes y el Inicio", () => {
    const datos = generar(semilla(11))
    const f = filtrarDatos(datos, FILTROS_VACIOS)
    expect(f.pacientes).toHaveLength(datos.pacientes.length)
    const vencidos = f.pacientes.filter((p) => esInactivo(p, datos.historial))
    expect(vencidos.every((p) => p.estadoClinico !== "De alta")).toBe(true)
    const porEstado = pacientesPorCorreccion(f.pacientes)
    expect(Object.values(porEstado).flat()).toHaveLength(datos.pacientes.length) // cada paciente en un solo estado
  })
  it("los pacientes nuevos son los registrados en el período (por su fecha de registro)", () => {
    const datos = generar(semilla(12))
    const m = metricasDelPeriodo(filtrarDatos(datos, FILTROS_VACIOS), datos, RANGO)
    expect(m.nuevos.map((p) => p.id).sort()).toEqual(datos.pacientes.filter((p) => p.fechaRegistro >= RANGO.inicio && p.fechaRegistro <= RANGO.fin).map((p) => p.id).sort())
  })
})

describe("Embudo de captación (R40) con los atendidos con receta", () => {
  const enMes = (f) => !!f && f.slice(0, 7) === "2026-10"
  const consultas = [
    { id: "a", pacienteId: "p1", fecha: "2026-10-02", od: { esfera: "-1.00" }, oi: {} },
    { id: "b", pacienteId: "p2", fecha: "2026-10-03", od: { esfera: "-2.00" }, oi: {} },
    { id: "c", pacienteId: "p3", fecha: "2026-10-04", od: { esfera: "" }, oi: { eje: "90" } },
    { id: "d", pacienteId: "p4", fecha: "2026-10-05", od: {}, oi: {} }, // sin receta: no cuenta
  ]
  it("solo cuenta a los que salieron con receta y entrega los ids detrás de cada número", () => {
    const e = calcularEmbudo({
      enRango: enMes, consultas, conReceta: true,
      pases: [{ id: 1, consultaId: "a", estado: "vendido" }, { id: 2, consultaId: "b", estado: "descartado", motivoDescarte: "precio" }],
      facturas: [{ id: "f", consultaId: "a", estado: "pagada" }],
    })
    expect(e.consultaron).toBe(3)
    expect(e.compraron).toBe(1)
    expect(e.compraronSobreConsultaron).toBe(33)
    expect([...e.ids.consultaron].sort()).toEqual(["a", "b", "c"])
    expect([...e.ids.compraron]).toEqual(["a"])
    expect(e.ids.noCompraronPorMotivo.precio).toEqual(["b"])
    expect(e.noCompraron).toBe(1)
  })
  it("sin la opción conReceta cuenta todas las consultas, como antes", () => {
    expect(calcularEmbudo({ enRango: enMes, consultas, pases: [], facturas: [] }).consultaron).toBe(4)
  })
})

describe("Citas: cita no efectuada por día y hora, por origen y por visita", () => {
  const citas = [
    { id: "1", fecha: "2026-10-05", hora: "09:00 AM", estado: "No Asistió", origen: "paciente" }, // lunes
    { id: "2", fecha: "2026-10-12", hora: "09:30 AM", estado: "Atendida", origen: "staff" }, // lunes
    { id: "3", fecha: "2026-10-06", hora: "03:00 PM", estado: "No Asistió", origen: "staff" }, // martes
    { id: "4", fecha: "2026-10-06", hora: "03:15 PM", estado: "Cancelada", origen: "staff" }, // las canceladas no entran
    { id: "5", fecha: "2026-10-11", hora: "10:00 AM", estado: "Atendida", origen: "staff" }, // domingo
  ]
  it("la cuadrícula cuenta las citas no efectuadas de cada celda y de cuántas citas, sin canceladas", () => {
    const c = cuadriculaInasistencias(citas)
    expect(c.celdas.get("1-9").citas).toHaveLength(2)
    expect(c.celdas.get("1-9").noAsistio).toHaveLength(1)
    expect(c.celdas.get("2-15").noAsistio).toHaveLength(1)
    expect(c.celdas.get("2-15").citas).toHaveLength(1) // la cancelada no cuenta
    expect(c.horas[0]).toBe(9)
    expect(c.horas.at(-1)).toBe(15)
    expect(c.dias.map((d) => d.etiqueta)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]) // hay una cita en domingo
    expect(c.max).toBe(1)
  })
  it("sin citas no hay cuadrícula", () => {
    expect(cuadriculaInasistencias([]).dias).toEqual([])
  })
  it("por origen: cuántas citas, cuántas atendidas, cuántas no efectuada y la tasa", () => {
    const filas = resumenCitasPor(citas, ORIGENES, (c) => c.origen)
    const web = filas.find((x) => x.id === "paciente")
    const rec = filas.find((x) => x.id === "staff")
    expect([web.citas.length, web.noAsistio.length, web.tasa]).toEqual([1, 1, 100])
    expect([rec.citas.length, rec.atendidas.length, rec.noAsistio.length, rec.tasa]).toEqual([3, 2, 1, 33])
    expect(web.citas.length + rec.citas.length).toBe(4) // la cancelada no cuenta
  })
  it("por visita reparte las citas en primera vez y seguimiento", () => {
    const filas = resumenCitasPor(citas, VISITAS, (c) => (c.id === "2" ? "seguimiento" : "primera"))
    expect(filas.map((x) => x.citas.length)).toEqual([3, 1])
  })
  it("la tendencia mensual da la tasa de cada mes", () => {
    const t = tendenciaInasistencia(citas, new Date(2026, 9, 12))
    expect(t).toHaveLength(12)
    expect(t[11].clave).toBe("2026-10")
    expect(t[11].noAsistio).toHaveLength(2)
    expect(t[11].tasa).toBe(50)
    expect(t[0].tasa).toBeNull()
  })
})

describe("Efectividad de los controles", () => {
  const pacientes = [{ id: "p1", nombre: "Ana" }, { id: "p2", nombre: "Beto" }, { id: "p3", nombre: "Cris", estadoClinico: "De alta" }]
  const consultas = [
    { id: "a", pacienteId: "p1", fecha: "2026-07-10", proximoControlDias: 90 }, // control: 8 oct
    { id: "b", pacienteId: "p2", fecha: "2026-07-12", proximoControlDias: 90 }, // control: 10 oct
    { id: "c", pacienteId: "p3", fecha: "2026-07-10", proximoControlDias: 90 }, // de alta: no cuenta
  ]
  const rango = { inicio: "2026-10-01", fin: "2026-10-31" }
  it("cuenta a quien tenía el control en el período y si agendó (cita no cancelada posterior)", () => {
    const citas = [{ id: "x", pacienteId: "p1", fecha: "2026-10-20", estado: "Pendiente" }, { id: "y", pacienteId: "p2", fecha: "2026-10-20", estado: "Cancelada" }]
    const r = efectividadControles({ consultas, citas, pacientes, rango })
    expect(r.filas.map((x) => x.paciente.id)).toEqual(["p1", "p2"])
    expect(r.agendaron.map((x) => x.paciente.id)).toEqual(["p1"])
    expect(r.sinAgendar.map((x) => x.paciente.id)).toEqual(["p2"])
  })
  it("si la persona volvió antes de su control, ese control ya no vencía en el período", () => {
    const r = efectividadControles({ consultas: [...consultas, { id: "d", pacienteId: "p1", fecha: "2026-09-01", proximoControlDias: 400 }], citas: [], pacientes, rango })
    expect(r.filas.map((x) => x.paciente.id)).toEqual(["p2"])
  })
})

describe("Diagnósticos", () => {
  const pacientes = [{ id: "p1", fecha_nacimiento: "2015-06-01" }, { id: "p2", fecha_nacimiento: "1985-06-01" }, { id: "p3", fecha_nacimiento: "1950-06-01" }, { id: "p4" }]
  const consultas = [
    { id: 1, pacienteId: "p1", fecha: "2026-10-02", diagnosticoCategorias: ["Miopía"] },
    { id: 2, pacienteId: "p1", fecha: "2026-10-09", diagnosticoCategorias: ["Miopía"] }, // la misma persona: cuenta una vez
    { id: 3, pacienteId: "p2", fecha: "2026-10-03", diagnosticoCategorias: ["miopia", "Astigmatismo"] },
    { id: 4, pacienteId: "p3", fecha: "2026-10-04", diagnosticoCategorias: ["Presbicia"] },
    { id: 5, pacienteId: "p4", fecha: "2026-10-05", diagnosticoCategorias: ["Miopía"] },
  ]
  it("cuenta pacientes distintos por diagnóstico y entrega la lista que lo compone", () => {
    const d = diagnosticosDelPeriodo(consultas)
    expect(d[0]).toMatchObject({ diagnostico: "Miopía", pacientes: 3 })
    expect(d[0].consultas).toHaveLength(3)
    expect(d[0].consultas.find((c) => c.pacienteId === "p1").id).toBe(2) // la más reciente de esa persona
  })
  it("por grupo de edad, con la edad del día de la consulta y los que no tienen fecha de nacimiento aparte", () => {
    const e = diagnosticosPorEdad(consultas, pacientes)
    const miopia = e.filas.find((x) => x.diagnostico === "Miopía")
    expect(miopia.porGrupo.menor18).toHaveLength(1)
    expect(miopia.porGrupo["40a59"]).toHaveLength(1)
    expect(miopia.porGrupo.sinDato).toHaveLength(1)
    expect(miopia.total).toBe(3)
    expect(e.haySinDato).toBe(true)
    expect(e.filas.find((x) => x.diagnostico === "Presbicia").porGrupo["60mas"]).toHaveLength(1)
  })
})

describe("Ventas: qué se vende y cómo se paga", () => {
  const rango = { inicio: "2026-10-01", fin: "2026-10-31" }
  const facturas = [
    { id: "a", numero: 1, estado: "pagada", montoTotal: 100, creadoEn: "2026-10-02T10:00:00-05:00", metodoPago: "tarjeta", lineas: [{ tipo: "luna", cantidad: 2, precioUnitario: 30, detalle: { tipo_lente: "progresivo" } }, { tipo: "producto", cantidad: 1, descripcion: "Montura A" }] },
    { id: "b", numero: 2, estado: "pagada", montoTotal: 50, creadoEn: "2026-10-03T10:00:00-05:00", metodoPago: "directo", lineas: [{ tipo: "producto", cantidad: 3, descripcion: "Montura A" }] },
    { id: "c", numero: 3, estado: "anulada", montoTotal: 999, creadoEn: "2026-10-03T10:00:00-05:00", metodoPago: "directo", lineas: [{ tipo: "producto", cantidad: 9, descripcion: "Montura A" }] },
  ]
  it("las listas detrás de lunas y productos suman las mismas unidades que los rankings", () => {
    const productos = rankingProductos(facturas, [], rango)
    expect(productos).toEqual([{ label: "Montura A", valor: 4 }])
    expect(lineasVendidas(facturas, rango, "producto").reduce((s, x) => s + x.cantidad, 0)).toBe(4)
    expect(lunasPorTipo(facturas, rango)).toMatchObject([{ id: "progresivo", unidades: 2 }])
    expect(lineasVendidas(facturas, rango, "luna").reduce((s, x) => s + x.cantidad, 0)).toBe(2)
  })
  it("por método de pago agrupa los comprobantes vigentes y suma su monto", () => {
    const m = ventasPorMetodo(facturas.filter((f) => f.estado !== "anulada"))
    expect(m.map((x) => [x.id, x.monto, x.facturas.length])).toEqual([["tarjeta", 100, 1], ["directo", 50, 1]])
  })
})

describe("Laboratorios: porcentaje entregado a tiempo", () => {
  const entregada = (id, prometida, entregadaEl) => ({ id, estado: "entregada", laboratorio: "Lab A", creadaEn: "2026-10-01T10:00:00-05:00", fechaPrometida: prometida, historial: [{ estado: "entregada", cambiadoEn: entregadaEl }] })
  it("una orden entregada en la fecha prometida o antes cuenta a tiempo; después, no", () => {
    const r = resumenPorLaboratorio([
      entregada(1, "2026-10-10", "2026-10-09T12:00:00-05:00"),
      entregada(2, "2026-10-10", "2026-10-10T20:00:00-05:00"), // el mismo día de Ecuador (01:00 UTC del 11): a tiempo
      entregada(3, "2026-10-10", "2026-10-12T09:00:00-05:00"),
    ], { hoy: new Date(2026, 9, 13) })
    expect(r[0]).toMatchObject({ entregadas: 3, aTiempo: 2, pctATiempo: 67 })
  })
  it("sin entregas no hay porcentaje", () => {
    expect(resumenPorLaboratorio([{ id: 1, estado: "enviada", laboratorio: "Lab A", fechaPrometida: "2026-12-01", historial: [] }], { hoy: new Date(2026, 9, 13) })[0].pctATiempo).toBeNull()
  })
})
