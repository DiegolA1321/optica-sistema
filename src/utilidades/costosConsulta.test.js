import { describe, it, expect } from "vitest"
import { costoBaseMotivo, renombrarCostoMotivo } from "./costosConsulta"

describe("costoBaseMotivo", () => {
  const param = { costosMotivo: { "Consulta General": 15, "Garantía / Ajuste": 0, Roto: "x", Neg: -3 } }
  it("devuelve el costo configurado", () => expect(costoBaseMotivo(param, "Consulta General")).toBe(15))
  it("permite 0", () => expect(costoBaseMotivo(param, "Garantía / Ajuste")).toBe(0))
  it("sin configurar, inválido o negativo es 0", () => {
    expect(costoBaseMotivo(param, "Otro motivo")).toBe(0)
    expect(costoBaseMotivo(param, "Roto")).toBe(0)
    expect(costoBaseMotivo(param, "Neg")).toBe(0)
    expect(costoBaseMotivo(undefined, "x")).toBe(0)
  })
})

describe("renombrarCostoMotivo", () => {
  it("mueve el costo al nuevo nombre", () => {
    expect(renombrarCostoMotivo({ A: 10, B: 5 }, "A", "C")).toEqual({ B: 5, C: 10 })
  })
  it("no hace nada si el motivo no tenía costo", () => {
    const c = { B: 5 }
    expect(renombrarCostoMotivo(c, "A", "C")).toBe(c)
  })
})

import { lineasCobroConsulta } from "./costosConsulta"

describe("lineasCobroConsulta", () => {
  const param = { costosMotivo: { "Consulta General": 15 } }
  it("consulta con el costo base del motivo y el lente vinculado", () => {
    const l = lineasCobroConsulta({ motivo: "Consulta General", lenteProductoId: "p1" }, param)
    expect(l).toEqual([
      { tipo: "servicio", descripcion: "Consulta — Consulta General", cantidad: 1, precioUnitario: 15 },
      { tipo: "producto", productoId: "p1", cantidad: 1 },
    ])
  })
  it("sin lente vinculado, solo la consulta (a $0 si no hay costo configurado)", () => {
    const l = lineasCobroConsulta({ motivo: "Otro", lenteProductoId: null }, param)
    expect(l).toHaveLength(1)
    expect(l[0].precioUnitario).toBe(0)
  })
})
