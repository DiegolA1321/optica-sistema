import { describe, it, expect } from "vitest"
import { MOTIVOS_NO_COMPRO, etiquetaMotivo, pasesListos, pasesDescartados, diasEnEspera, textoEspera } from "./pasesVenta"

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
