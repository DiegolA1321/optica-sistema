import { describe, it, expect } from "vitest"
import { plantillaInicio, esCitaPropia, citasPropias, resumenHoy, resumenMes, resumenPeriodo, citasDelPeriodo, citasParaLista, creadosEsteMes, rangoDelMes, agendaHoyOProximas, fichasSinTerminar, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "./inicio"
import { hoyISO, fechaAISO } from "./disponibilidad"

const hoy = hoyISO()
const cita = (extra) => ({ id: Math.random(), fecha: hoy, hora: "09:00 AM", estado: "Pendiente", ...extra })

describe("plantillaInicio", () => {
  it("el administrador ve el del negocio; una vista de rol, el de ese rol", () => {
    expect(plantillaInicio(null, { rol: "admin" })).toBe("administrador")
    expect(plantillaInicio({ tipo: "admin", inicio: "administrador" }, { rol: "admin" })).toBe("administrador")
    expect(plantillaInicio({ tipo: "rol", inicio: "optometra" }, { rol: "admin" })).toBe("optometra")
    expect(plantillaInicio({ tipo: "rol", inicio: "ventas" }, { rol: "asistente" })).toBe("ventas")
    expect(plantillaInicio({ tipo: "rol", inicio: "raro" }, { rol: "asistente" })).toBe("general")
    expect(plantillaInicio(null, { rol: "asistente" })).toBe("general")
  })
})

describe("citas propias (R49)", () => {
  it("son las asignadas a mí, las que atendí y las que no tienen responsable", () => {
    expect(esCitaPropia(cita({ asignadoA: "yo" }), "yo")).toBe(true)
    expect(esCitaPropia(cita({ atendidoPor: "yo" }), "yo")).toBe(true)
    expect(esCitaPropia(cita({}), "yo")).toBe(true)
    expect(esCitaPropia(cita({ asignadoA: "otra" }), "yo")).toBe(false)
    expect(citasPropias([cita({ asignadoA: "yo" }), cita({ asignadoA: "otra" }), cita({})], "yo")).toHaveLength(2)
  })
})

describe("resúmenes del día y del mes", () => {
  it("cuenta el día por estado y encuentra el siguiente paciente", () => {
    const r = resumenHoy([
      cita({ id: 1, estado: "Atendida", hora: "08:00 AM" }),
      cita({ id: 2, estado: "En Atención", hora: "09:00 AM" }),
      cita({ id: 3, estado: "Pendiente", hora: "11:00 AM" }),
      cita({ id: 4, estado: "En Espera", hora: "10:00 AM" }),
      cita({ id: 5, estado: "No Asistió", hora: "07:00 AM" }),
      cita({ id: 6, estado: "Cancelada", hora: "12:00 PM" }),
      cita({ id: 7, fecha: "2020-01-01" }),
    ])
    expect(r.total).toBe(5)
    expect(r).toMatchObject({ pendientes: 1, enEspera: 1, enAtencion: 1, atendidas: 1, noAsistieron: 1, canceladas: 1 })
    expect(r.siguiente.id).toBe(4)
  })
  it("el siguiente paciente es quien ya llegó (En espera), aunque otra cita sea más temprana", () => {
    const r = resumenHoy([
      cita({ id: 1, estado: "Pendiente", hora: "09:00 AM" }),
      cita({ id: 2, estado: "En Espera", hora: "11:00 AM" }),
      cita({ id: 3, estado: "Pendiente", hora: "10:00 AM" }),
    ])
    expect(r.siguiente.id).toBe(2)
    expect(resumenHoy([cita({ id: 1, estado: "Pendiente", hora: "09:00 AM" }), cita({ id: 3, estado: "Pendiente", hora: "10:00 AM" })]).siguiente.id).toBe(1)
  })
  it("cuenta las citas del mes en curso", () => {
    const ahora = new Date(2026, 9, 15)
    const r = resumenMes([
      cita({ fecha: "2026-10-02", estado: "Atendida" }), cita({ fecha: "2026-10-03", estado: "Atendida" }),
      cita({ fecha: "2026-10-04", estado: "No Asistió" }), cita({ fecha: "2026-10-05", estado: "Cancelada" }),
      cita({ fecha: "2026-09-30", estado: "Atendida" }),
    ], ahora)
    expect(r).toEqual({ registradas: 3, atendidas: 2, noAtendidas: 1, canceladas: 1, enAtencion: 0 })
  })
  it("los pacientes sin atender son los que nunca tuvieron consulta", () => {
    expect(pacientesSinAtender([{ id: "a" }, { id: "b" }], [{ pacienteId: "a" }]).map((p) => p.id)).toEqual(["b"])
  })
})

describe("lo de quien vende", () => {
  it("suma los saldos por cobrar de las ventas pendientes", () => {
    const facturas = [
      { id: "f1", estado: "pendiente_pago", montoTotal: 100 }, { id: "f2", estado: "pendiente_pago", montoTotal: 50 },
      { id: "f3", estado: "pagada", montoTotal: 80 }, { id: "f4", estado: "anulada", montoTotal: 30 },
    ]
    expect(saldosPorCobrar(facturas, [{ facturaId: "f1", monto: 40 }])).toEqual({ cantidad: 2, total: 110 })
  })
  it("separa los listos para venta de las proformas en seguimiento", () => {
    const pases = [{ estado: "listo", proformaEntregadaEn: "2026-10-01" }, { estado: "listo" }, { estado: "vendido", proformaEntregadaEn: "2026-10-01" }]
    expect(pasesListos(pases)).toHaveLength(2)
    expect(proformasEnSeguimiento(pases)).toHaveLength(1)
  })
})

describe("desenlace por período", () => {
  const citas = [
    cita({ estado: "Atendida" }), cita({ estado: "No Asistió" }), cita({ estado: "Cancelada" }),
    cita({ estado: "Atendida", fecha: "2020-01-15" }), cita({ estado: "Cancelada", fecha: "2020-01-16" }),
  ]
  it("'mes' cuenta solo el mes en curso y 'siempre' todo lo registrado", () => {
    expect(resumenPeriodo(citas, "mes")).toEqual({ registradas: 2, atendidas: 1, noAtendidas: 1, canceladas: 1, enAtencion: 0 })
    expect(resumenPeriodo(citas, "siempre")).toEqual({ registradas: 3, atendidas: 2, noAtendidas: 1, canceladas: 2, enAtencion: 0 })
    expect(resumenMes(citas).registradas).toBe(2)
  })
  it("el rango del mes va del primer al último día", () => {
    expect(rangoDelMes(new Date(2026, 1, 10))).toEqual({ desde: "2026-02-01", hasta: "2026-02-28" })
    expect(rangoDelMes(new Date(2026, 9, 7))).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" })
  })
})

describe("agenda de hoy o próximas", () => {
  const manana = fechaAISO(new Date(Date.now() + 86400000))
  const ayer = fechaAISO(new Date(Date.now() - 86400000))
  it("con citas hoy muestra solo las de hoy, sin canceladas", () => {
    const r = agendaHoyOProximas([cita({ hora: "10:00 AM" }), cita({ estado: "Cancelada" }), cita({ fecha: manana })])
    expect(r.modo).toBe("hoy")
    expect(r.citas).toHaveLength(1)
  })
  it("sin citas hoy muestra las próximas en orden y nunca las pasadas", () => {
    const r = agendaHoyOProximas([cita({ fecha: ayer }), cita({ fecha: manana, hora: "11:00 AM" }), cita({ fecha: manana, hora: "09:00 AM" }), cita({ fecha: manana, estado: "Cancelada" })])
    expect(r.modo).toBe("proximas")
    expect(r.citas.map((c) => c.hora)).toEqual(["09:00 AM", "11:00 AM"])
  })
  it("respeta el límite", () => {
    const muchas = Array.from({ length: 9 }, (_, i) => cita({ fecha: manana, hora: `${String(i + 1).padStart(2, "0")}:00 AM` }))
    expect(agendaHoyOProximas(muchas, 5).citas).toHaveLength(5)
  })
})

describe("fichas sin terminar", () => {
  it("son las atenciones abiertas a nombre de la persona, la más antigua primero", () => {
    const mias = [cita({ estado: "En Atención", atendidoPor: "yo", fecha: "2026-10-05" }), cita({ estado: "En Atención", atendidoPor: "yo", fecha: "2026-10-03" })]
    const lista = fichasSinTerminar([...mias, cita({ estado: "En Atención", atendidoPor: "otra" }), cita({ estado: "Atendida", atendidoPor: "yo" }), cita({ estado: "Pendiente", asignadoA: "yo" })], "yo")
    expect(lista.map((c) => c.fecha)).toEqual(["2026-10-03", "2026-10-05"])
    expect(fichasSinTerminar(mias, null)).toEqual([])
  })
})

describe("Períodos del desenlace y lista del Inicio", () => {
  // Miércoles 7 de octubre de 2026: la semana va del lunes 5 al domingo 11
  const ahora = new Date(2026, 9, 7, 10, 0)
  const citas = [
    { id: "a", fecha: "2026-10-07", hora: "09:00 AM", estado: "Atendida" },
    { id: "b", fecha: "2026-10-07", hora: "08:00 AM", estado: "No Asistió" },
    { id: "c", fecha: "2026-10-05", hora: "10:00 AM", estado: "Cancelada" },
    { id: "d", fecha: "2026-10-11", hora: "10:00 AM", estado: "Pendiente" },
    { id: "e", fecha: "2026-10-12", hora: "10:00 AM", estado: "Pendiente" },
    { id: "f", fecha: "2026-09-30", hora: "10:00 AM", estado: "Atendida" },
  ]
  it("hoy, semana (lunes a domingo), mes y todas", () => {
    expect(citasDelPeriodo(citas, "hoy", ahora).map((c) => c.id)).toEqual(["a", "b"])
    expect(citasDelPeriodo(citas, "semana", ahora).map((c) => c.id)).toEqual(["a", "b", "c", "d"])
    expect(citasDelPeriodo(citas, "mes", ahora)).toHaveLength(5)
    expect(citasDelPeriodo(citas, "siempre", ahora)).toHaveLength(6)
    expect(resumenPeriodo(citas, "hoy", ahora)).toEqual({ registradas: 2, atendidas: 1, noAtendidas: 1, canceladas: 0, enAtencion: 0 })
  })
  it("la lista sigue la tarjeta elegida y, sin tarjeta, deja fuera las canceladas", () => {
    expect(citasParaLista(citas, "semana", null, ahora).map((c) => c.id)).toEqual(["b", "a", "d"])
    expect(citasParaLista(citas, "semana", "cancelada", ahora).map((c) => c.id)).toEqual(["c"])
    expect(citasParaLista(citas, "siempre", "atendida", ahora).map((c) => c.id)).toEqual(["a", "f"])
    expect(citasParaLista(citas, "hoy", "noAsistio", ahora).map((c) => c.id)).toEqual(["b"])
  })
  it("cuenta lo dado de alta este mes y no cuenta lo que no trae fecha", () => {
    const lista = [{ creadoEn: "2026-10-02T10:00:00Z" }, { creadoEn: "2026-09-02T10:00:00Z" }, {}]
    expect(creadosEsteMes(lista, "creadoEn", ahora)).toBe(1)
  })
})
