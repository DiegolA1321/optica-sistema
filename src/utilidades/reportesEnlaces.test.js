import { describe, it, expect } from "vitest"
import { citaPasaFiltros, coincideEstado } from "./filtrosCitas"
import { filtrarComprobantes } from "./saldosVentas"

// "Abrir en …" de Reportes lleva a Citas y a Ventas con los mismos filtros: estas son las piezas que lo hacen posible.
describe("Citas acepta lo que Reportes le manda", () => {
  const f = (extra) => ({ estado: "todas", alta: "todas", origen: "todos", seguimiento: "todos", responsable: "todos", texto: "", periodo: { filtro: "todas", desde: "2026-10-01", hasta: "2026-10-12" }, ...extra })
  const base = { id: "c", fecha: "2026-10-05", pacienteId: "p1", origen: "paciente", motivo: "Consulta General", estado: "Pendiente" }
  it("'abiertas' son las citas por atender: pendientes, en espera y en atención", () => {
    for (const estado of ["Pendiente", "En Espera", "En Atención"]) expect(coincideEstado({ estado }, "abiertas")).toBe(true)
    for (const estado of ["Atendida", "No Asistió", "Cancelada"]) expect(coincideEstado({ estado }, "abiertas")).toBe(false)
    expect(citaPasaFiltros(base, f({ estado: "abiertas" }), [])).toBe(true)
    expect(citaPasaFiltros({ ...base, estado: "Atendida" }, f({ estado: "abiertas" }), [])).toBe(false)
  })
  it("el motivo de consulta filtra la lista y sin motivo no filtra", () => {
    expect(citaPasaFiltros(base, f({ motivo: "Consulta General" }), [])).toBe(true)
    expect(citaPasaFiltros(base, f({ motivo: "Examen de Control" }), [])).toBe(false)
    expect(citaPasaFiltros(base, f({ motivo: "" }), [])).toBe(true)
    expect(citaPasaFiltros(base, f({}), [])).toBe(true)
  })
  it("el rango de fechas deja fuera lo de antes y lo de después", () => {
    expect(citaPasaFiltros({ ...base, fecha: "2026-09-30" }, f({}), [])).toBe(false)
    expect(citaPasaFiltros({ ...base, fecha: "2026-10-13" }, f({}), [])).toBe(false)
  })
})

describe("Ventas acepta el período con fechas de Reportes", () => {
  const facturas = [
    { id: "a", numero: 1, estado: "pagada", creadoEn: "2026-10-12T19:30:00-05:00" }, // 00:30 UTC del 13: es del 12 en Ecuador
    { id: "b", numero: 2, estado: "pagada", creadoEn: "2026-10-13T08:00:00-05:00" },
    { id: "c", numero: 3, estado: "pagada", creadoEn: "2026-09-30T23:00:00-05:00" },
  ]
  it("cuenta el día de Ecuador y respeta desde y hasta", () => {
    const ids = (extra) => filtrarComprobantes(facturas, { periodo: "rango", desde: "2026-10-01", hasta: "2026-10-12", ...extra }).map((x) => x.id)
    expect(ids()).toEqual(["a"])
    expect(ids({ hasta: "2026-10-13" }).sort()).toEqual(["a", "b"])
    expect(ids({ desde: "", hasta: "" }).sort()).toEqual(["a", "b", "c"])
  })
  it("los demás períodos siguen igual", () => {
    expect(filtrarComprobantes(facturas, { periodo: "todo" })).toHaveLength(3)
  })
})
