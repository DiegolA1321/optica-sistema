import { describe, it, expect } from "vitest"
import { diagnosticosPorMes, motivosEnConsultas, filtrarPorMotivo, aniosConConsultas, categoriasDeConsulta, claveDiagnostico } from "./reportesDiagnosticos"

const c = (id, pacienteId, fecha, cats, motivo = "Consulta General") => ({ id, pacienteId, fecha, diagnosticoCategorias: cats, motivo })

describe("reportesDiagnosticos", () => {
  const consultas = [
    c(1, 1, "2026-01-10", ["Miopía", "Astigmatismo"]),
    c(2, 1, "2026-01-25", ["Miopía"]),        // mismo paciente, mismo mes: cuenta una vez
    c(3, 2, "2026-02-03", ["Miopía"], "Examen de Control"),
    c(4, 3, "2026-02-14", ["Presbicia"]),
    c(5, 1, "2025-12-30", ["Miopía"]),        // otro año
  ]

  it("cuenta pacientes distintos por diagnóstico y mes", () => {
    const r = diagnosticosPorMes(consultas, 2026)
    const miopia = r.filas.find((f) => f.diagnostico === "Miopía")
    expect(miopia.meses.slice(0, 3)).toEqual([1, 1, 0])
    expect(miopia.anio).toBe(2) // pacientes 1 y 2
    expect(r.totalPacientes).toBe(3)
    expect(r.filas[0].diagnostico).toBe("Miopía") // el más frecuente primero
    expect(r.maxMes).toBe(1)
  })

  it("no mezcla años", () => {
    expect(diagnosticosPorMes(consultas, 2025).filas.map((f) => f.diagnostico)).toEqual(["Miopía"])
    expect(diagnosticosPorMes(consultas, 2024).filas).toEqual([])
  })

  it("cae al texto libre en fichas sin categorías", () => {
    expect(categoriasDeConsulta({ diagnostico: " Glaucoma ", diagnosticoCategorias: [] })).toEqual(["Glaucoma"])
    expect(categoriasDeConsulta({})).toEqual([])
  })

  it("lista los motivos y filtra por uno", () => {
    expect(motivosEnConsultas(consultas)).toEqual([{ motivo: "Consulta General", cantidad: 4 }, { motivo: "Examen de Control", cantidad: 1 }])
    expect(filtrarPorMotivo(consultas, "Examen de Control").map((x) => x.id)).toEqual([3])
    expect(filtrarPorMotivo(consultas, "")).toBe(consultas)
  })

  it("los años incluyen el actual y los de las consultas", () => {
    expect(aniosConConsultas(consultas, 2026)).toEqual([2026, 2025])
  })
})

describe("diagnósticos que solo difieren en tildes o mayúsculas", () => {
  const c2 = (id, pacienteId, fecha, cats) => ({ id, pacienteId, fecha, diagnosticoCategorias: cats })
  it("se agrupan en una sola fila y se muestra la variante más usada", () => {
    const r = diagnosticosPorMes([
      c2(1, 1, "2026-09-02", ["Sin alteración refractiva"]),
      c2(2, 2, "2026-09-03", ["Sin alteracion refractiva"]),
      c2(3, 3, "2026-09-04", ["SIN ALTERACIÓN  REFRACTIVA"]),
      c2(4, 4, "2026-09-05", ["Sin alteración refractiva"]),
    ], 2026)
    expect(r.filas).toHaveLength(1)
    expect(r.filas[0]).toMatchObject({ diagnostico: "Sin alteración refractiva", anio: 4 })
    expect(r.filas[0].meses[8]).toBe(4)
  })
  it("si empatan, gana la variante con tildes", () => {
    const r = diagnosticosPorMes([c2(1, 1, "2026-09-02", ["sin alteracion"]), c2(2, 2, "2026-09-03", ["Sin alteración"])], 2026)
    expect(r.filas[0].diagnostico).toBe("Sin alteración")
  })
  it("la clave ignora tildes, mayúsculas y espacios", () => {
    expect(claveDiagnostico("  Hipermetropía ")).toBe(claveDiagnostico("hipermetropia"))
  })
})
