import { describe, it, expect } from "vitest"
import { plantillaInicio, esCitaPropia, citasPropias, resumenHoy, resumenMes, pacientesSinAtender, saldosPorCobrar, proformasEnSeguimiento, pasesListos } from "./inicio"
import { hoyISO } from "./disponibilidad"

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
  it("cuenta las citas del mes en curso", () => {
    const ahora = new Date(2026, 9, 15)
    const r = resumenMes([
      cita({ fecha: "2026-10-02", estado: "Atendida" }), cita({ fecha: "2026-10-03", estado: "Atendida" }),
      cita({ fecha: "2026-10-04", estado: "No Asistió" }), cita({ fecha: "2026-10-05", estado: "Cancelada" }),
      cita({ fecha: "2026-09-30", estado: "Atendida" }),
    ], ahora)
    expect(r).toEqual({ registradas: 4, atendidas: 2, noAtendidas: 1, canceladas: 1 })
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
