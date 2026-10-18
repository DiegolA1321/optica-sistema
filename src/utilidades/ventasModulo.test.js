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

import { contarAvisosVentas } from "./ventasModulo"
describe("el número de avisos de Ventas", () => {
  it("suma lo mismo que el Inicio: sin avisar, atrasadas, ventas con saldo y quienes esperan más de 30 días", () => {
    const hoy = new Date(2026, 9, 12, 10, 0)
    const ordenes = [
      { id: "1", estado: "lista", pacienteAvisadoEn: null },
      { id: "2", estado: "lista", pacienteAvisadoEn: "x" },
      { id: "3", estado: "enviada", fechaPrometida: "2020-01-01" },
    ]
    const facturas = [{ id: "f", pacienteId: "p1", estado: "pendiente_pago", montoTotal: 100, creadoEn: "2026-10-01T10:00:00Z" }]
    const pases = [{ id: "a", estado: "listo", pasadaEn: "2026-03-01T10:00:00Z" }, { id: "b", estado: "listo", pasadaEn: "2026-10-10T10:00:00Z" }, { id: "c", estado: "descartado", pasadaEn: "2026-01-01T10:00:00Z" }]
    expect(contarAvisosVentas({ pases, ordenes, facturas, pacientes: [{ id: "p1" }], hoy })).toBe(1 + 1 + 1 + 1)
    expect(contarAvisosVentas({})).toBe(0)
  })
})

import { solicitudesNuevasDelPortal } from "./ventasModulo"
import { esSolicitudNueva, esDelPortal, etiquetaInteres } from "./pasesVenta"
describe("solicitudes de lentes del portal en Ventas y en «Requiere tu atención»", () => {
  const hoy = new Date(2026, 9, 18, 10, 0)
  const portal = (extra = {}) => ({ id: "s", origen: "portal", interes: "montura_nueva", estado: "listo", pasadaEn: "2026-10-17T10:00:00Z", enAtencionEn: null, proformaEntregadaEn: null, ...extra })
  it("una solicitud recibida cuenta; una ya tomada o con proforma no", () => {
    expect(esSolicitudNueva(portal())).toBe(true)
    expect(esSolicitudNueva(portal({ enAtencionEn: "2026-10-17T12:00:00Z" }))).toBe(false)
    expect(esSolicitudNueva(portal({ proformaEntregadaEn: "2026-10-17T12:00:00Z" }))).toBe(false)
    expect(esSolicitudNueva(portal({ estado: "vendido" }))).toBe(false)
    expect(esSolicitudNueva({ origen: "consulta", estado: "listo" })).toBe(false)
  })
  it("cuenta mientras está «Recibida» y, a los 30 días sin cerrarse, la cuenta el seguimiento (una sola vez)", () => {
    const nueva = portal()
    const vieja = portal({ id: "v", pasadaEn: "2026-08-01T10:00:00Z" })
    expect(contarAvisosVentas({ pases: [nueva], hoy })).toBe(1)
    expect(solicitudesNuevasDelPortal([{ pase: vieja }], hoy)).toHaveLength(0)
    expect(contarAvisosVentas({ pases: [vieja], hoy })).toBe(1) // por el seguimiento, no dos veces
    expect(contarAvisosVentas({ pases: [nueva, vieja], hoy })).toBe(2)
    expect(contarAvisosVentas({ pases: [portal({ enAtencionEn: "2026-10-17T12:00:00Z" })], hoy })).toBe(0) // ya la tomaron y no pasó el plazo
  })
  it("el filtro «Desde el portal» muestra solo esas y las etiquetas salen en palabras del personal", () => {
    const listos = [{ pase: portal() }, { pase: { id: "c", origen: "consulta", estado: "listo", pasadaEn: "2026-10-10T10:00:00Z" } }]
    expect(listaPorVender("portal", { listos, descartados: [], hoy })).toHaveLength(1)
    expect(esDelPortal(listos[0].pase)).toBe(true)
    expect(etiquetaInteres("lentes_de_contacto")).toBe("Lentes de contacto")
  })
})
