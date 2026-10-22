import { describe, it, expect } from "vitest"
import { PROGRAMA_POR_DEFECTO, programaDe, errorDePrograma, dolaresPagados, puntosDe, nivelDe, beneficioDe } from "./programaFidelidad"

const paciente = { id: "p1", nombre: "Rosa Bravo" }
const consultas = (n) => Array.from({ length: n }, (_, i) => ({ id: `k${i}`, pacienteId: "p1", paciente: "Rosa Bravo", fecha: `2026-0${i + 1}-10` }))
const referido = (i) => ({ id: `r${i}`, nombre: `Ref ${i}`, referidoPorId: "p1" })
const factura = (id, monto, estado = "pagada") => ({ id, pacienteId: "p1", montoTotal: monto, estado })

describe("programa de fidelización", () => {
  it("sin configurar vale la regla aprobada: 10 por consulta, 15 por referido, 1 por cada $10; Nuevo, Frecuente 5 %, Preferente 10 %", () => {
    const p = programaDe({})
    expect(p).toMatchObject({ activo: true, porConsulta: 10, porReferido: 15, dolaresPorPunto: 10 })
    expect(p.niveles.map((n) => [n.nombre, n.desde, n.descuento])).toEqual([["Nuevo", 0, 0], ["Frecuente", 30, 5], ["Preferente", 90, 10]])
  })
  it("lo configurado manda; lo que no sirve vuelve a la regla; el primer nivel empieza en 0 y se ordenan", () => {
    const p = programaDe({ fidelizacion: { porConsulta: 20, dolaresPorPunto: "x", niveles: [{ nombre: "Oro", desde: 200, descuento: 15 }, { nombre: "Base", desde: 50, descuento: 0 }] } })
    expect(p.porConsulta).toBe(20)
    expect(p.dolaresPorPunto).toBe(10)
    expect(p.niveles.map((n) => n.nombre)).toEqual(["Base", "Oro"])
    expect(p.niveles[0].desde).toBe(0) // el primero ordenado (Base) queda en... el que tenga desde menor
  })
  it("valida lo que se guarda", () => {
    expect(errorDePrograma(PROGRAMA_POR_DEFECTO)).toBe("")
    expect(errorDePrograma({ ...PROGRAMA_POR_DEFECTO, porConsulta: -1 })).toMatch(/consulta/)
    expect(errorDePrograma({ ...PROGRAMA_POR_DEFECTO, dolaresPorPunto: 0 })).toMatch(/dólares/)
    expect(errorDePrograma({ ...PROGRAMA_POR_DEFECTO, niveles: [{ nombre: "A", desde: 0, descuento: 0 }, { nombre: "B", desde: 0, descuento: 5 }] })).toMatch(/más que los del nivel anterior/)
    expect(errorDePrograma({ ...PROGRAMA_POR_DEFECTO, niveles: [{ nombre: "A", desde: 0, descuento: 120 }] })).toMatch(/entre 0 y 100/)
  })
  it("los puntos suman consultas, referidos y dólares pagados (sin anuladas ni lo que se debe)", () => {
    const facturas = [factura("f1", 100), factura("f2", 50, "anulada"), { ...factura("f3", 80, "pendiente_pago") }]
    const abonos = [{ facturaId: "f3", monto: 30, fecha: "2026-10-01", creadoEn: "2026-10-01T10:00:00Z" }]
    expect(dolaresPagados("p1", facturas, abonos)).toBe(130) // 100 pagados + 30 abonados de los 80
    const r = puntosDe({ paciente, consultas: consultas(2), pacientes: [paciente, referido(1)], facturas, abonos })
    expect(r.consultas).toEqual({ n: 2, puntos: 20 })
    expect(r.referidos).toEqual({ n: 1, puntos: 15 })
    expect(r.compras).toEqual({ dolares: 130, puntos: 13 })
    expect(r.total).toBe(48)
  })
  it("el nivel sale de los puntos, con el siguiente y lo que falta", () => {
    expect(nivelDe(0).nivel.nombre).toBe("Nuevo")
    expect(nivelDe(29)).toMatchObject({ faltan: 1, siguiente: { nombre: "Frecuente" } })
    expect(nivelDe(30).nivel.nombre).toBe("Frecuente")
    expect(nivelDe(500)).toMatchObject({ nivel: { nombre: "Preferente" }, siguiente: null, faltan: 0 })
  })
  it("el descuento sugerido sale de su nivel y se apaga con el programa", () => {
    const datos = { paciente, consultas: consultas(3), pacientes: [paciente] } // 30 puntos
    expect(beneficioDe(datos)).toMatchObject({ descuento: 5, nivel: { nombre: "Frecuente" } })
    expect(beneficioDe({ paciente, consultas: [], pacientes: [paciente] })).toBeNull()
    expect(beneficioDe(datos, { ...PROGRAMA_POR_DEFECTO, activo: false })).toBeNull()
  })
})
