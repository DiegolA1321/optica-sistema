import { describe, it, expect } from "vitest"
import { listaPorVender, pacientesParaSeguimiento, esperaDemasiado, siguienteAccionOrden, ordenesDelFiltro, lineaDiagnosticoYLente, textoEstadoOrden, filtroDeOrdenesValido } from "./ventasModulo"

const item = (id, pasadaEn, extra = {}) => ({ pase: { id, pasadaEn, estado: "listo", ...extra }, paciente: { id: "p" + id }, consulta: {} })
const hoy = new Date(2026, 9, 12, 10, 0) // 12 oct 2026

describe("Por vender", () => {
  const listos = [item("a", "2026-10-11T15:00:00Z"), item("b", "2026-09-10T15:00:00Z", { proformaEntregadaEn: "2026-09-11T10:00:00Z" }), item("c", "2026-09-12T15:00:00Z"), item("d", "2026-03-01T15:00:00Z")]
  const descartados = [item("x", "2026-08-01T15:00:00Z", { estado: "descartado" })]
  it("los filtros: todos, con proforma, sin proforma y los que no compraron", () => {
    const ids = (f) => listaPorVender(f, { listos, descartados }).map((i) => i.pase.id)
    expect(ids("todos")).toEqual(["a", "b", "c", "d"])
    expect(ids("con")).toEqual(["b"])
    expect(ids("sin")).toEqual(["a", "c", "d"])
    expect(ids("nocompraron")).toEqual(["x"])
  })
  it("más de 30 días esperando pasa a 'Requieren atención', el que más lleva primero", () => {
    expect(esperaDemasiado(listos[2], hoy)).toBe(false) // 30 días exactos
    expect(pacientesParaSeguimiento(listos, hoy).map((i) => i.pase.id)).toEqual(["d", "b"])
  })
  it("diagnóstico y lente recomendado en una línea", () => {
    expect(lineaDiagnosticoYLente({ diagnosticoCategorias: ["Miopía"], diagnostico: "Miopía", lenteRecomendado: "Monofocal antirreflejo" })).toBe("Miopía · Lente: Monofocal antirreflejo")
    expect(lineaDiagnosticoYLente({ lenteRecomendado: "Progresivo" })).toBe("Lente: Progresivo")
    expect(lineaDiagnosticoYLente({})).toBe("")
  })
})

describe("órdenes de laboratorio", () => {
  const o = (id, estado, extra = {}) => ({ id, estado, fechaPrometida: "2099-01-01", ...extra })
  it("la siguiente acción es una sola: marcar lista, avisar o entregar", () => {
    expect(siguienteAccionOrden(o("1", "enviada")).id).toBe("lista")
    expect(siguienteAccionOrden(o("1", "lista")).id).toBe("avisar")
    expect(siguienteAccionOrden(o("1", "lista", { pacienteAvisadoEn: "x" })).id).toBe("entregar")
    expect(siguienteAccionOrden(o("1", "lista"), { tieneTelefono: false }).id).toBe("entregar")
    expect(siguienteAccionOrden(o("1", "entregada"))).toBeNull()
    expect(siguienteAccionOrden(o("1", "enviada"), { puedeEditar: false })).toBeNull()
  })
  it("los filtros por estado; 'todas' no incluye las canceladas", () => {
    const lista = [o("1", "enviada", { fechaPrometida: "2020-01-01" }), o("2", "enviada"), o("3", "lista"), o("4", "entregada"), o("5", "cancelada")]
    const ids = (f) => ordenesDelFiltro(lista, f).map((x) => x.id)
    expect(ids("abiertas")).toEqual(["1", "2", "3"])
    expect(ids("atrasadas")).toEqual(["1"])
    expect(ids("listas")).toEqual(["3"])
    expect(ids("entregadas")).toEqual(["4"])
    expect(ids("todas")).toEqual(["1", "2", "3", "4"])
    expect(ids("canceladas")).toEqual(["5"])
  })
  it("el texto del estado dice los días de atraso", () => {
    expect(textoEstadoOrden(o("1", "enviada", { fechaPrometida: "2020-01-01" }), 3)).toBe("Atrasada 3 días")
    expect(textoEstadoOrden(o("1", "enviada"), 0)).toBe("Enviada")
    expect(textoEstadoOrden(o("1", "lista"), 0)).toBe("Lista")
  })
  it("un filtro que no existe vuelve a 'abiertas'", () => {
    expect(filtroDeOrdenesValido("listas")).toBe("listas")
    expect(filtroDeOrdenesValido("xyz")).toBe("abiertas")
  })
})

import { textoDiasEspera, mensajeSeguimientoVenta } from "./ventasModulo"
describe("seguimiento de quien no ha comprado", () => {
  it("los días de espera como se leen en la fila", () => {
    expect([0, 1, 45].map(textoDiasEspera)).toEqual(["Hoy", "1 día", "45 días"])
  })
  it("el mensaje trata a la persona por su nombre tal como está guardado y cambia si ya tiene proforma", () => {
    const m = mensajeSeguimientoVenta({ paciente: { nombre: "Rosa Bravo Cedeño" }, opticaNombre: "Óptica Demo", conProforma: true })
    expect(m).toMatch(/^Hola, Rosa Bravo Cedeño, te escribimos de Óptica Demo\./)
    expect(m).toMatch(/proforma/)
    expect(mensajeSeguimientoVenta({ paciente: { nombre: "Rosa" }, conProforma: false })).toMatch(/preparemos una proforma/)
  })
})

import { diagnosticoCorto } from "./ventasModulo"
describe("diagnóstico sin la frase de plantilla", () => {
  it("quita \"Corrección óptica indicada según refracción\" y deja lo que decide", () => {
    expect(diagnosticoCorto({ diagnostico: "Miopía — Corrección óptica indicada según refracción" })).toBe("Miopía")
    expect(diagnosticoCorto({ diagnostico: "Corrección óptica indicada según refracción" })).toBe("")
    expect(diagnosticoCorto({ diagnosticoCategorias: ["Astigmatismo"], diagnostico: "Astigmatismo leve" })).toBe("Astigmatismo leve")
  })
})
