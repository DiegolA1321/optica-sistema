import { describe, it, expect } from "vitest"
import { siguienteAccionOrden, ordenesDelFiltro, lineaDiagnosticoYLente, textoEstadoOrden, estadoDePedido, filtroDeOrdenesValido, textoDiasEspera, diagnosticoCorto, llevaProforma, FILTROS_ORDENES, diasDePedido, entregaDe, etiquetaEntrega, ENTREGAS, entregaDeVenta } from "./ventasModulo"

describe("diagnóstico y lente de un paciente", () => {
  it("diagnóstico y lente recomendado en una línea", () => {
    expect(lineaDiagnosticoYLente({ diagnosticoCategorias: ["Miopía"], diagnostico: "Miopía", lenteRecomendado: "Monofocal antirreflejo" })).toBe("Miopía · Lente: Monofocal antirreflejo")
    expect(lineaDiagnosticoYLente({ lenteRecomendado: "Progresivo" })).toBe("Lente: Progresivo")
    expect(lineaDiagnosticoYLente({})).toBe("")
  })
  it("el diagnóstico va sin la frase de plantilla y deja lo que decide", () => {
    expect(diagnosticoCorto({ diagnostico: "Miopía — Corrección óptica indicada según refracción" })).toBe("Miopía")
    expect(diagnosticoCorto({ diagnostico: "Corrección óptica indicada según refracción" })).toBe("")
    expect(diagnosticoCorto({ diagnosticoCategorias: ["Astigmatismo"], diagnostico: "Astigmatismo leve" })).toBe("Astigmatismo leve")
  })
  it("una proforma entregada se reconoce por su fecha", () => {
    expect(llevaProforma({ proformaEntregadaEn: "2026-10-01T10:00:00Z" })).toBe(true)
    expect(llevaProforma({})).toBe(false)
    expect(llevaProforma(null)).toBe(false)
  })
  it("los días de espera como se leen en la fila", () => {
    expect([0, 1, 45].map(textoDiasEspera)).toEqual(["Hoy", "1 día", "45 días"])
  })
})

describe("la entrega y los días de un pedido", () => {
  it("hay dos entregas y un pedido sin entrega guardada (los de antes) retira en la óptica", () => {
    expect(ENTREGAS.map((e) => e.etiqueta)).toEqual(["Retira en la óptica", "Envío a domicilio"])
    expect(entregaDe({})).toBe("retira")
    expect(entregaDe({ entrega: "envio" })).toBe("envio")
    expect(etiquetaEntrega({ entrega: "envio" })).toBe("Envío a domicilio")
    expect(etiquetaEntrega({})).toBe("Retira en la óptica")
  })
  it("los días por defecto son los de Configuración → Ventas, o 7 si no hay o no valen", () => {
    expect(diasDePedido({ diasPedido: 10 })).toBe(10)
    expect(diasDePedido({})).toBe(7)
    expect(diasDePedido(null)).toBe(7)
    expect(diasDePedido({ diasPedido: 0 })).toBe(7)
    expect(diasDePedido({ diasPedido: 500 })).toBe(7)
  })
})

describe("pedidos", () => {
  const o = (id, estado, extra = {}) => ({ id, estado, fechaPrometida: "2099-01-01", ...extra })

  it("la siguiente acción es una sola: Marcar listo, Avisar al paciente o Entregar", () => {
    expect(siguienteAccionOrden(o("1", "enviada"))).toEqual({ id: "lista", etiqueta: "Marcar listo" })
    expect(siguienteAccionOrden(o("1", "lista"))).toEqual({ id: "avisar", etiqueta: "Avisar al paciente" })
    expect(siguienteAccionOrden(o("1", "lista", { pacienteAvisadoEn: "x" }))).toEqual({ id: "entregar", etiqueta: "Entregar" })
    expect(siguienteAccionOrden(o("1", "lista"), { tieneTelefono: false }).id).toBe("entregar")
    expect(siguienteAccionOrden(o("1", "entregada"))).toBeNull()
    expect(siguienteAccionOrden(o("1", "enviada"), { puedeEditar: false })).toBeNull()
  })

  it("los filtros son En proceso, Atrasados, Listos para entregar, Entregados y Todos", () => {
    expect(FILTROS_ORDENES.map((f) => f.etiqueta)).toEqual(["En proceso", "Atrasados", "Listos para entregar", "Entregados", "Todos"])
  })

  it("cada filtro lista lo suyo; «Todos» no incluye los cancelados y un pedido atrasado es el que pasó su fecha sin estar listo", () => {
    const lista = [o("1", "enviada", { fechaPrometida: "2020-01-01" }), o("2", "enviada"), o("3", "lista"), o("4", "entregada"), o("5", "cancelada"), o("6", "lista", { pacienteAvisadoEn: "x", fechaPrometida: "2020-01-01" })]
    const ids = (f) => ordenesDelFiltro(lista, f).map((x) => x.id)
    expect(ids("enproceso")).toEqual(["1", "2"]) // incluye al atrasado: sigue sin estar listo
    expect(ids("atrasadas")).toEqual(["1"]) // el 6 ya está listo: no está atrasado aunque su fecha pasó
    expect(ids("listos")).toEqual(["3", "6"])
    expect(ids("sinavisar")).toEqual(["3"])
    expect(ids("entregadas")).toEqual(["4"])
    expect(ids("todas")).toEqual(["1", "2", "3", "4", "6"])
  })

  it("los nombres de filtro de antes llegan al de ahora y uno que no existe vuelve a «En proceso»", () => {
    expect(filtroDeOrdenesValido("abiertas")).toBe("enproceso")
    expect(filtroDeOrdenesValido("encurso")).toBe("enproceso")
    expect(filtroDeOrdenesValido("enlab")).toBe("enproceso")
    expect(filtroDeOrdenesValido("listas")).toBe("listos")
    expect(filtroDeOrdenesValido("canceladas")).toBe("todas")
    expect(filtroDeOrdenesValido("sinavisar")).toBe("sinavisar")
    expect(filtroDeOrdenesValido("xyz")).toBe("enproceso")
  })

  it("el estado se lee En proceso, Atrasado N días, Listo · sin avisar, Listo · avisado y Entregado, cada uno con su color", () => {
    expect(estadoDePedido(o("1", "enviada"))).toEqual({ id: "enviada", etiqueta: "En proceso", tono: "gris" })
    expect(estadoDePedido(o("1", "enviada", { fechaPrometida: "2020-01-01" }), 3)).toEqual({ id: "atrasada", etiqueta: "Atrasado 3 días", tono: "rojo" })
    expect(estadoDePedido(o("1", "enviada", { fechaPrometida: "2020-01-01" }), 1).etiqueta).toBe("Atrasado 1 día")
    expect(estadoDePedido(o("1", "lista"))).toEqual({ id: "sinavisar", etiqueta: "Listo · sin avisar", tono: "ambar" })
    expect(estadoDePedido(o("1", "lista", { pacienteAvisadoEn: "x" }))).toEqual({ id: "avisado", etiqueta: "Listo · avisado", tono: "azul" })
    expect(estadoDePedido(o("1", "entregada"))).toEqual({ id: "entregada", etiqueta: "Entregado", tono: "verde" })
    expect(estadoDePedido(o("1", "cancelada")).etiqueta).toBe("Cancelado")
  })

  it("el texto del estado es el mismo en el detalle y en las listas", () => {
    expect(textoEstadoOrden(o("1", "enviada", { fechaPrometida: "2020-01-01" }), 3)).toBe("Atrasado 3 días")
    expect(textoEstadoOrden(o("1", "enviada"), 0)).toBe("En proceso")
    expect(textoEstadoOrden(o("1", "lista"), 0)).toBe("Listo · sin avisar")
  })
})

describe("la entrega de una venta (columna «Entrega» de la lista)", () => {
  const ped = (id, facturaId, estado, extra = {}) => ({ id, facturaId, estado, ...extra })
  it("sin pedido queda vacía, y los cancelados no cuentan", () => {
    expect(entregaDeVenta("f1", [])).toBeNull()
    expect(entregaDeVenta("f1", [ped("1", "f2", "enviada")])).toBeNull()
    expect(entregaDeVenta("f1", [ped("1", "f1", "cancelada")])).toBeNull()
  })
  it("usa los mismos nombres y colores que Pedidos", () => {
    expect(entregaDeVenta("f1", [ped("1", "f1", "enviada")])).toMatchObject({ etiqueta: "En proceso", tono: "gris" })
    expect(entregaDeVenta("f1", [ped("1", "f1", "enviada", { fechaPrometida: "2020-01-01" })])).toMatchObject({ id: "atrasada", tono: "rojo" })
    expect(entregaDeVenta("f1", [ped("1", "f1", "lista")]).etiqueta).toBe("Listo · sin avisar")
    expect(entregaDeVenta("f1", [ped("1", "f1", "entregada")])).toMatchObject({ etiqueta: "Entregado", tono: "verde" })
  })
  it("con varios pedidos manda el que más urge", () => {
    const e = entregaDeVenta("f1", [ped("1", "f1", "entregada"), ped("2", "f1", "enviada")])
    expect(e).toMatchObject({ id: "enviada", etiqueta: "En proceso (2 pedidos)" })
  })
})
