import { describe, it, expect } from "vitest"
import { proximosCumpleanos, resumenCrm, enDias } from "./crmResumen"

const pac = (id, nombre, extra = {}) => ({ id, nombre, ...extra })
const HOY = "2026-10-22"

describe("proximosCumpleanos", () => {
  it("ordena del más cercano al más lejano, con la fecha y los días que faltan", () => {
    const r = proximosCumpleanos([pac("a", "Ana", { fechaNacimiento: "1990-10-24" }), pac("b", "Beto", { fechaNacimiento: "1985-10-22" }), pac("c", "Cris", { fechaNacimiento: "2000-01-05" }), pac("d", "Sin fecha")], HOY)
    expect(r.map((x) => [x.paciente.nombre, x.dias, x.fecha])).toEqual([["Beto", 0, "2026-10-22"], ["Ana", 2, "2026-10-24"], ["Cris", 75, "2027-01-05"]])
  })
  it("el límite recorta y los anonimizados no cuentan", () => {
    const r = proximosCumpleanos([pac("a", "Ana", { fechaNacimiento: "1990-10-24" }), pac("x", "Borrado", { fechaNacimiento: "1990-10-23", anonimizado: true })], HOY, 1)
    expect(r.map((x) => x.paciente.nombre)).toEqual(["Ana"])
  })
  it("los días se leen en palabras", () => {
    expect([enDias(0), enDias(1), enDias(2)]).toEqual(["hoy", "mañana", "en 2 días"])
  })
})

describe("resumenCrm", () => {
  const pacientes = [
    pac("a", "Ana", { fechaNacimiento: "1990-10-24" }),
    pac("l", "Luis Mora", { fechaNacimiento: "1980-03-01" }),
    pac("r", "Rosa Vera", { fechaNacimiento: "1975-05-05" }),
    pac("n1", "Nuevo Uno", { referidoPor: "r" }), pac("n2", "Nuevo Dos", { referidoPor: "r" }),
  ]
  const puntosDe = (p) => ({ puntos: { total: p.id === "l" ? 140 : p.id === "r" ? 60 : 0 }, nivel: { nombre: p.id === "l" ? "Preferente" : "Nuevo" } })
  const contactos = [
    { id: "c1", pacienteId: "a", motivo: "cumpleanos", resultado: "agendo", creadoEn: "2026-10-05T10:00:00Z" },
    { id: "c2", pacienteId: "l", motivo: "control_vencido", resultado: "no_respondio", creadoEn: "2026-10-06T10:00:00Z" },
    { id: "c3", pacienteId: "r", motivo: "control_vencido", resultado: null, creadoEn: "2026-09-02T10:00:00Z" },
  ]
  it("junta los cinco datos de arriba con las mismas cuentas de las listas", () => {
    const filas = [{ id: "a", motivos: [{ id: "control_vencido" }] }, { id: "l", motivos: [{ id: "cumpleanos" }] }, { id: "r", motivos: [{ id: "control_vencido" }, { id: "sin_visitar" }] }]
    const r = resumenCrm({ pacientes, contactos, citas: [], filas, puntosDe, hoy: HOY })
    expect(r.cumple.paciente.nombre).toBe("Ana")
    expect(r.cumple.dias).toBe(2)
    expect(r.fiel).toMatchObject({ puntos: 140, nivel: "Preferente" })
    expect(r.fiel.paciente.nombre).toBe("Luis Mora")
    expect(r.controles).toBe(2)
    expect(r.contactados).toEqual({ n: 2, volvieron: 1 }) // solo los de este mes; «volvieron» = los que agendaron
  })
  it("sin datos no inventa nada", () => {
    const r = resumenCrm({ pacientes: [], contactos: [], citas: [], filas: [], puntosDe, hoy: HOY })
    expect(r).toEqual({ cumple: null, fiel: null, referidor: null, controles: 0, contactados: { n: 0, volvieron: 0 } })
  })
})
