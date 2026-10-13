import { describe, it, expect } from "vitest"
import { catalogoExportaciones } from "./catalogo"
import { crearColumnas } from "./listas"
import { filtrarDatos, FILTROS_VACIOS } from "../../utilidades/reportesDatos"
import { modeloAHoja, ENCABEZADO_FILAS } from "../../utilidades/reportesExcel"

const pacientes = [{ id: "p1", nombre: "Ana Pérez", cedula: "17001", telefono: "099", fechaRegistro: "2026-09-10" }, { id: "p2", nombre: "Beto Ríos", cedula: "17002", telefono: "098", fechaRegistro: "2026-10-03" }]
const consultas = [
  { id: "k1", pacienteId: "p1", fecha: "2026-09-12", motivo: "Consulta General", diagnosticoCategorias: ["Miopía"], profesionalNombre: "Paula", proximoControlDias: 90 },
  { id: "k2", pacienteId: "p2", fecha: "2026-10-05", motivo: "Examen de Control", diagnosticoCategorias: ["Presbicia"], profesionalNombre: "Paula" },
]
const citas = [
  { id: "c1", pacienteId: "p1", paciente: "Ana Pérez", cedula: "17001", telefono: "099", fecha: "2026-09-12", hora: "09:00 AM", estado: "Atendida", origen: "paciente", motivo: "Consulta General", asignadoA: "u2" },
  { id: "c2", pacienteId: "p2", paciente: "Beto Ríos", fecha: "2026-10-05", hora: "10:00 AM", estado: "No Asistió", origen: "staff", motivo: "Examen de Control" },
  { id: "c3", pacienteId: "p2", paciente: "Beto Ríos", fecha: "2026-10-06", hora: "10:00 AM", estado: "Cancelada", canceladaPor: "paciente", origen: "staff" },
  { id: "c4", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-08-01", hora: "10:00 AM", estado: "Atendida", origen: "staff" }, // fuera del rango
]
const datos = { pacientes, consultas, historial: consultas, citas, ventas: [], facturas: [], abonos: [], pases: [], ordenes: [] }
const base = { datos, f: filtrarDatos(datos, FILTROS_VACIOS), cols: crearColumnas({ pacientes }), ocultarMontos: false, propio: false, usuario: { rol: "admin" }, equipo: [{ id: "u2", nombre: "Paula" }], historial: consultas, inventario: [], hoy: new Date(2026, 9, 12), filtrosActivosTexto: "ninguno" }
const rango = { inicio: "2026-09-01", fin: "2026-10-12" }
const ctx = { opticaNombre: "Óptica", usuarioNombre: "Diego", rango, filtrosTexto: "ninguno", ahora: new Date(2026, 9, 12, 20, 0) }
const item = (r, id, opciones) => catalogoExportaciones(r, rango, opciones).find((x) => x.id === id)

describe("Qué se puede exportar, por módulo", () => {
  it("el administrador ve los cinco módulos, cada uno con su PDF", () => {
    const c = catalogoExportaciones(base, rango)
    expect([...new Set(c.map((x) => x.modulo))]).toEqual(["resumen", "citas", "clinico", "ventas", "laboratorios"])
    expect(c.filter((x) => x.pdf).map((x) => x.modulo)).toEqual(["resumen", "citas", "clinico", "ventas", "laboratorios"])
  })
  it("quien no ve montos no ve los reportes de ventas ni de laboratorios, pero sí los de citas y clínico", () => {
    const c = catalogoExportaciones({ ...base, ocultarMontos: true, propio: true }, rango)
    expect(c.some((x) => x.modulo === "ventas")).toBe(false)
    expect(c.some((x) => x.id === "ordenes" || x.id === "labs-desempeno")).toBe(false)
    expect(c.some((x) => x.id === "citas-detalle")).toBe(true)
    expect(c.some((x) => x.id === "campana")).toBe(true)
    expect(c.some((x) => x.id === "inventario")).toBe(false)
  })
  it("los que son de hoy lo dicen y no siguen las fechas", () => {
    const c = catalogoExportaciones(base, rango)
    expect(c.filter((x) => x.aHoy).map((x) => x.id).sort()).toEqual(["campana", "inventario", "ordenes"])
  })
})

describe("Exportaciones por fechas", () => {
  it("el resumen mes a mes trae un renglón por cada mes que toca el rango", () => {
    const m = item(base, "resumen-meses").modelo()
    expect(m.filas.map((f) => f.celdas[0])).toEqual(["sept 2026", "oct 2026"])
    expect(m.filas.map((f) => f.celdas[1])).toEqual([1, 1]) // consultas
    expect(m.filas.map((f) => f.celdas[2])).toEqual([1, 1]) // pacientes nuevos
  })
  it("las citas del período respetan las fechas elegidas: otras fechas, otro resultado", () => {
    expect(item(base, "citas-detalle").modelo().filas.map((f) => f.celdas[0].toISOString().slice(0, 10))).toEqual(["2026-09-12", "2026-10-05", "2026-10-06"])
    const solo = catalogoExportaciones(base, { inicio: "2026-08-01", fin: "2026-08-31" }).find((x) => x.id === "citas-detalle").modelo()
    expect(solo.filas).toHaveLength(1)
    expect(solo.archivo).toContain("2026-08-01-a-2026-08-31")
  })
  it("cada cita lleva origen, visita, profesional, estado y quién canceló, con la fecha como fecha", () => {
    const m = item(base, "citas-detalle").modelo()
    const h = modeloAHoja(m, ctx)
    expect(m.columnas.map((c) => c.titulo)).toEqual(["Fecha", "Hora", "Paciente", "Cédula", "Teléfono", "Motivo", "Origen", "Visita", "Profesional", "Estado", "Cancelada por"])
    expect(m.filas[0].celdas.slice(6)).toEqual(["Web", "Seguimiento", "Paula", "Atendida", ""])
    expect(m.filas[2].celdas.slice(9)).toEqual(["Cancelada", "El paciente"])
    expect(h.data[ENCABEZADO_FILAS + 1][0]).toMatchObject({ type: Date, format: "dd/mm/yyyy" })
  })
  it("las inasistencias traen solo a quien no asistió, con su teléfono", () => {
    const m = item(base, "citas-inasistencias").modelo()
    expect(m.filas.map((f) => f.celdas[2])).toEqual(["Beto Ríos"])
  })
  it("la inasistencia mes a mes da la tasa de cada mes como porcentaje", () => {
    const m = item(base, "citas-tasa-mes").modelo()
    expect(m.filas.map((f) => f.celdas.at(-1))).toEqual([0, 100]) // sept: 0 de 1; oct: 1 de 1 (la cancelada no cuenta)
  })
  it("las consultas y los diagnósticos por mes salen con sus columnas", () => {
    expect(item(base, "consultas-detalle").modelo().filas).toHaveLength(2)
    const dx = item(base, "diagnosticos-mes").modelo()
    expect(dx.columnas).toHaveLength(14) // diagnóstico, 12 meses y el año
    expect(dx.archivo).toBe("diagnosticos-por-mes-2026")
  })
  it("la campaña pide la opción de los que no compraron solo a quien ve montos", () => {
    expect(item(base, "campana").opcion).toBe("noCompraron")
    expect(item({ ...base, ocultarMontos: true }, "campana").opcion).toBeNull()
  })
})
