import { describe, it, expect } from "vitest"
import { rangoDelPeriodo, enPeriodo, moverPeriodo, tituloDelPeriodo, periodoDeDestino, PERIODO_INICIAL, diaDeRegistro } from "./periodoLista"

const HOY = "2026-10-08" // jueves

describe("período de una lista", () => {
  it("hoy, semana de lunes a domingo y mes", () => {
    expect(rangoDelPeriodo({ filtro: "hoy", ref: "" }, HOY)).toEqual({ desde: HOY, hasta: HOY })
    expect(rangoDelPeriodo({ filtro: "semana", ref: "" }, HOY)).toEqual({ desde: "2026-10-05", hasta: "2026-10-11" })
    expect(rangoDelPeriodo({ filtro: "mes", ref: "" }, HOY)).toEqual({ desde: "2026-10-01", hasta: "2026-10-31" })
    expect(rangoDelPeriodo(PERIODO_INICIAL, HOY)).toBeNull()
  })
  it("las flechas mueven un día, una semana o un mes; con todas las fechas no mueven nada", () => {
    expect(moverPeriodo({ filtro: "hoy", ref: "" }, -1, HOY).ref).toBe("2026-10-07")
    expect(moverPeriodo({ filtro: "semana", ref: "" }, 1, HOY).ref).toBe("2026-10-15")
    expect(moverPeriodo({ filtro: "mes", ref: "" }, 1, HOY).ref).toBe("2026-11-01")
    expect(moverPeriodo(PERIODO_INICIAL, 1, HOY)).toEqual(PERIODO_INICIAL)
    expect(moverPeriodo({ filtro: "todas", ref: "", desde: "2026-10-01", hasta: "2026-10-07" }, 1, HOY)).toMatchObject({ desde: "2026-10-08", hasta: "2026-10-14" })
  })
  it("un registro cae en el período por su día de Ecuador", () => {
    // 2026-10-09 02:00 UTC = 8 de octubre, 21:00 en Ecuador
    expect(diaDeRegistro("2026-10-09T02:00:00Z")).toBe("2026-10-08")
    expect(enPeriodo("2026-10-09T02:00:00Z", { filtro: "hoy", ref: "" }, HOY)).toBe(true)
    expect(enPeriodo("2026-10-12", { filtro: "semana", ref: "" }, HOY)).toBe(false)
    expect(enPeriodo("2026-09-30T20:00:00Z", { filtro: "mes", ref: "" }, HOY)).toBe(false)
    expect(enPeriodo("2020-01-01", PERIODO_INICIAL, HOY)).toBe(true)
  })
  it("los títulos son los de Citas", () => {
    expect(tituloDelPeriodo({ filtro: "hoy", ref: "" }, HOY)).toBe("Hoy · jue 8 oct 2026")
    expect(tituloDelPeriodo({ filtro: "hoy", ref: "2026-10-07" }, HOY)).toBe("mié 7 oct 2026")
    expect(tituloDelPeriodo({ filtro: "semana", ref: "" }, HOY)).toBe("5 – 11 oct 2026")
    expect(tituloDelPeriodo({ filtro: "mes", ref: "" }, HOY)).toBe("Octubre 2026")
    expect(tituloDelPeriodo(PERIODO_INICIAL, HOY)).toBe("Todas las fechas")
  })
  it("el período que llega de Reportes o del Inicio", () => {
    expect(periodoDeDestino({ desde: "2026-10-01", hasta: "2026-10-12" })).toMatchObject({ desde: "2026-10-01", hasta: "2026-10-12" })
    expect(periodoDeDestino({ periodo: "mes" }).filtro).toBe("mes")
    expect(periodoDeDestino({})).toEqual(PERIODO_INICIAL)
  })
})
