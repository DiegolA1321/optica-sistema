import { describe, it, expect } from "vitest"
import { proximosCumpleanos, cumpleanosDelMes, saludadoEnElAnio, conPuestos, edadAlCumplir, resumenCrm, enDias } from "./crmResumen"

const pac = (id, nombre, extra = {}) => ({ id, nombre, ...extra })
const HOY = "2026-10-22" // jueves

describe("proximosCumpleanos", () => {
  it("ordena del más cercano al más lejano, con la fecha, los días que faltan y la edad que cumple", () => {
    const r = proximosCumpleanos([pac("a", "Ana", { fechaNacimiento: "1990-10-24" }), pac("b", "Beto", { fechaNacimiento: "1985-10-22" }), pac("c", "Cris", { fechaNacimiento: "2000-01-05" }), pac("d", "Sin fecha")], HOY)
    expect(r.map((x) => [x.paciente.nombre, x.dias, x.fecha, x.edad])).toEqual([["Beto", 0, "2026-10-22", 41], ["Ana", 2, "2026-10-24", 36], ["Cris", 75, "2027-01-05", 27]])
  })
  it("el límite recorta y los anonimizados no cuentan", () => {
    const r = proximosCumpleanos([pac("a", "Ana", { fechaNacimiento: "1990-10-24" }), pac("x", "Borrado", { fechaNacimiento: "1990-10-23", anonimizado: true })], HOY, 1)
    expect(r.map((x) => x.paciente.nombre)).toEqual(["Ana"])
  })
  it("los días se leen en palabras", () => {
    expect([enDias(0), enDias(1), enDias(2)]).toEqual(["hoy", "mañana", "en 2 días"])
  })
  it("la edad es el año del cumpleaños menos el de nacimiento", () => {
    expect(edadAlCumplir("1985-10-22", 2026)).toBe(41)
    expect(edadAlCumplir("", 2026)).toBeNull()
  })
})

describe("cumpleanosDelMes", () => {
  const ps = [
    pac("p1", "Pasado", { fechaNacimiento: "1990-10-10" }),
    pac("h", "Hoy", { fechaNacimiento: "1985-10-22" }),
    pac("d", "Domingo", { fechaNacimiento: "1970-10-25" }), // el domingo de esta semana
    pac("l", "Lunes", { fechaNacimiento: "1999-10-26" }),
    pac("n", "Noviembre", { fechaNacimiento: "1980-11-03" }),
    pac("x", "Borrado", { fechaNacimiento: "1990-10-23", anonimizado: true }),
  ]
  it("este mes: ya pasaron, esta semana (de hoy al domingo) y más adelante", () => {
    const r = cumpleanosDelMes(ps, HOY, 0)
    expect(r.map((x) => [x.paciente.nombre, x.grupo, x.edad])).toEqual([["Pasado", "pasaron", 36], ["Hoy", "semana", 41], ["Domingo", "semana", 56], ["Lunes", "adelante", 27]])
  })
  it("el próximo mes va en un solo grupo", () => {
    const r = cumpleanosDelMes(ps, HOY, 1)
    expect(r.map((x) => [x.paciente.nombre, x.grupo, x.fecha])).toEqual([["Noviembre", "mes", "2026-11-03"]])
  })
  it("diciembre pasa a enero del año siguiente y el 29 de febrero se celebra el 28 en años no bisiestos", () => {
    const r = cumpleanosDelMes([pac("e", "Enero", { fechaNacimiento: "1990-01-15" }), pac("b", "Bisiesto", { fechaNacimiento: "2000-02-29" })], "2026-12-10", 1)
    expect(r.map((x) => [x.fecha, x.edad])).toEqual([["2027-01-15", 37]])
    expect(cumpleanosDelMes([pac("b", "Bisiesto", { fechaNacimiento: "2000-02-29" })], "2027-02-01", 0)[0].fecha).toBe("2027-02-28")
  })
  it("«saludado»: un contacto de cumpleaños en el mismo año", () => {
    const contactos = [{ pacienteId: "h", motivo: "cumpleanos", creadoEn: "2026-10-22T15:00:00Z" }, { pacienteId: "d", motivo: "cumpleanos", creadoEn: "2025-10-25T15:00:00Z" }]
    expect(saludadoEnElAnio(ps[1], "2026-10-22", contactos)).toBe(true)
    expect(saludadoEnElAnio(ps[2], "2026-10-25", contactos)).toBe(false)
  })
})

describe("conPuestos", () => {
  it("con empates comparten el mismo puesto y el siguiente salta", () => {
    const r = conPuestos([{ valor: 5 }, { valor: 5 }, { valor: 3 }, { valor: 2 }, { valor: 2 }])
    expect(r.map((x) => x.lugar)).toEqual([1, 1, 3, 4, 4])
  })
})

describe("resumenCrm", () => {
  const pacientes = [
    pac("a", "Ana", { fechaNacimiento: "1990-10-24" }),
    pac("l", "Luis Mora", { fechaNacimiento: "1980-03-01" }),
    pac("r", "Rosa Vera", { fechaNacimiento: "1975-05-05" }),
    pac("n1", "Nuevo Uno", { referidoPorId: "r" }), pac("n2", "Nuevo Dos", { referidoPorId: "r" }),
  ]
  const puntosDe = (p) => ({ puntos: { total: p.id === "l" ? 140 : p.id === "r" ? 60 : 0 }, nivel: { nombre: p.id === "l" ? "Preferente" : "Nuevo" } })
  const contactos = [
    { id: "c1", pacienteId: "a", motivo: "cumpleanos", resultado: "agendo", creadoEn: "2026-10-05T10:00:00Z", campanaId: "k1" },
    { id: "c2", pacienteId: "l", motivo: "control_vencido", resultado: "no_respondio", creadoEn: "2026-10-06T10:00:00Z", campanaId: "k1" },
    { id: "c3", pacienteId: "r", motivo: "control_vencido", resultado: null, creadoEn: "2026-09-02T10:00:00Z", campanaId: "k0" },
  ]
  it("junta las cuatro listas con las mismas cuentas de sus pestañas", () => {
    const r = resumenCrm({ pacientes, contactos, citas: [], puntosDe, hoy: HOY })
    expect(r.cumples.lista.map((x) => x.paciente.nombre)).toEqual(["Ana", "Luis Mora", "Rosa Vera"])
    expect(r.cumples.total).toBe(3)
    expect(r.cumples.delMes).toBe(1)
    expect(r.fieles.lista.map((x) => [x.paciente.nombre, x.valor, x.nivel, x.lugar])).toEqual([["Luis Mora", 140, "Preferente", 1], ["Rosa Vera", 60, "Nuevo", 2]])
    expect(r.referidores.lista.map((x) => [x.paciente.nombre, x.valor])).toEqual([["Rosa Vera", 2]])
    expect(r.mes).toEqual({ contactados: 2, volvieron: 1, campanas: 1 }) // solo los de este mes; «volvieron» = los que agendaron
  })
  it("cada lista llega a tres y el resto queda para «ver todos»", () => {
    const muchos = ["a", "b", "c", "d", "e"].map((i) => pac(i, `P ${i}`, { fechaNacimiento: "1990-11-01" }))
    const r = resumenCrm({ pacientes: muchos, contactos: [], citas: [], puntosDe: () => ({ puntos: { total: 10 } }), hoy: HOY })
    expect(r.cumples.lista).toHaveLength(3)
    expect(r.cumples.total).toBe(5)
    expect(r.fieles.lista.map((x) => x.lugar)).toEqual([1, 1, 1]) // todos empatados: mismo puesto
    expect(r.fieles.total).toBe(5)
  })
  it("sin datos no inventa nada", () => {
    const r = resumenCrm({ pacientes: [], contactos: [], citas: [], puntosDe, hoy: HOY })
    expect(r).toEqual({ cumples: { lista: [], total: 0, delMes: 0 }, fieles: { lista: [], total: 0 }, referidores: { lista: [], total: 0, todos: [] }, mes: { contactados: 0, volvieron: 0, campanas: 0 } })
  })
})
