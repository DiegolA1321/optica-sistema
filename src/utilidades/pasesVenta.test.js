import { describe, it, expect } from "vitest"
import { MOTIVOS_NO_COMPRO, etiquetaMotivo, pasesListos, pasesDescartados, diasEnEspera, textoEspera, textoDiagnostico } from "./pasesVenta"

describe("pasesVenta", () => {
  it("los motivos son los cuatro que acepta la base", () => {
    expect(MOTIVOS_NO_COMPRO.map((m) => m.id)).toEqual(["precio", "lo_pensara", "otro_lugar", "otro"])
  })
  it("la etiqueta del motivo; 'otro' lleva su texto", () => {
    expect(etiquetaMotivo("precio")).toBe("Por el precio")
    expect(etiquetaMotivo("otro", "Espera a su seguro")).toBe("Otro: Espera a su seguro")
    expect(etiquetaMotivo("nada")).toBe("")
  })
  it("separa listos y descartados", () => {
    const pases = [{ estado: "listo" }, { estado: "vendido" }, { estado: "descartado" }, { estado: "listo" }]
    expect(pasesListos(pases)).toHaveLength(2)
    expect(pasesDescartados(pases)).toHaveLength(1)
  })
  it("cuenta los días de espera por fecha local", () => {
    const hoy = new Date(2026, 9, 10, 9, 0)
    expect(diasEnEspera({ pasadaEn: new Date(2026, 9, 10, 8, 0).toISOString() }, hoy)).toBe(0)
    expect(diasEnEspera({ pasadaEn: new Date(2026, 9, 7, 17, 0).toISOString() }, hoy)).toBe(3)
    expect(diasEnEspera({}, hoy)).toBe(0)
  })
  it("el texto de espera", () => {
    expect(textoEspera(0)).toBe("Pasó hoy")
    expect(textoEspera(1)).toBe("Espera desde hace 1 día")
    expect(textoEspera(4)).toBe("Espera desde hace 4 días")
  })
})

describe("textoDiagnostico", () => {
  it("une categorías y detalle", () => {
    expect(textoDiagnostico({ diagnosticoCategorias: ["Miopía"], diagnostico: "Leve, ambos ojos" })).toBe("Miopía · Leve, ambos ojos")
  })
  it("no repite lo que ya dice la categoría", () => {
    expect(textoDiagnostico({ diagnosticoCategorias: ["Miopía"], diagnostico: "miopía" })).toBe("Miopía")
  })
  it("ignora tildes y también cuando el detalle ya incluye la categoría", () => {
    expect(textoDiagnostico({ diagnosticoCategorias: ["Miopía"], diagnostico: "MIOPIA" })).toBe("Miopía")
    expect(textoDiagnostico({ diagnosticoCategorias: ["Miopía"], diagnostico: "Miopía leve en ambos ojos" })).toBe("Miopía leve en ambos ojos")
  })
  it("sin datos queda vacío", () => {
    expect(textoDiagnostico({})).toBe("")
    expect(textoDiagnostico(null)).toBe("")
  })
})

import { pacientesQueNoCompraron } from "./pasesVenta"

describe("pacientesQueNoCompraron", () => {
  const pase = (pacienteId, estado, extra = {}) => ({ id: pacienteId + estado, pacienteId, estado, pasadaEn: "2026-09-01T10:00:00Z", ...extra })
  it("incluye a quien tiene su último pase descartado, con el motivo", () => {
    const m = pacientesQueNoCompraron([pase("a", "descartado", { motivoDescarte: "precio" }), pase("b", "listo"), pase("c", "vendido")])
    expect([...m.keys()]).toEqual(["a"])
    expect(m.get("a").motivo).toBe("Por el precio")
  })
  it("el motivo 'otro' lleva su detalle y sin motivo no queda en blanco", () => {
    const m = pacientesQueNoCompraron([pase("a", "descartado", { motivoDescarte: "otro", detalleDescarte: "viaja" }), pase("b", "descartado")])
    expect(m.get("a").motivo).toBe("Otro: viaja")
    expect(m.get("b").motivo).toBe("Sin motivo indicado")
  })
  it("si después compró (comprobante vigente) ya no cuenta; uno anulado no lo cambia", () => {
    const pases = [pase("a", "descartado", { motivoDescarte: "precio" }), pase("b", "descartado", { motivoDescarte: "precio" })]
    const facturas = [{ pacienteId: "a", estado: "pagada", creadoEn: "2026-09-10T10:00:00Z" }, { pacienteId: "b", estado: "anulada", creadoEn: "2026-09-10T10:00:00Z" }]
    expect([...pacientesQueNoCompraron(pases, facturas).keys()]).toEqual(["b"])
  })
  it("manda el pase más reciente: descartó y luego volvió y quedó listo", () => {
    const pases = [pase("a", "descartado", { motivoDescarte: "precio" }), pase("a", "listo", { pasadaEn: "2026-09-20T10:00:00Z" })]
    expect(pacientesQueNoCompraron(pases).size).toBe(0)
  })
})
