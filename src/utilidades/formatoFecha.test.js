import { describe, it, expect } from "vitest"
import { fechaLegible, fechaCorta, horaLegible, fechaHoraLegible } from "./formatoFecha"

describe("formatoFecha", () => {
  it("escribe la fecha como 15 sept 2026", () => {
    expect(fechaLegible("2026-09-15")).toBe("15 sept 2026")
    expect(fechaLegible("2027-03-14")).toBe("14 mar 2027")
  })
  it("no corre un día por la zona horaria en fechas sin hora", () => {
    expect(fechaLegible("2026-01-01")).toBe("1 ene 2026")
    expect(fechaLegible("2026-12-31")).toBe("31 dic 2026")
  })
  it("acepta un Date y un texto con hora", () => {
    expect(fechaLegible(new Date(2026, 9, 6))).toBe("6 oct 2026")
    expect(fechaLegible(new Date(2026, 9, 6, 15, 30).toISOString())).toBe("6 oct 2026")
  })
  it("la versión corta no lleva año", () => {
    expect(fechaCorta("2026-09-15")).toBe("15 sept")
  })
  it("sin fecha o inválida devuelve texto vacío", () => {
    expect(fechaLegible("")).toBe("")
    expect(fechaLegible(null)).toBe("")
    expect(fechaLegible("no es fecha")).toBe("")
  })
})

describe("hora y fecha con hora", () => {
  it("hora en 12 h con cero a la izquierda", () => {
    expect(horaLegible(new Date(2026, 9, 7, 8, 19))).toBe("08:19 AM")
    expect(horaLegible(new Date(2026, 9, 7, 16, 20))).toBe("04:20 PM")
    expect(horaLegible(new Date(2026, 9, 7, 0, 5))).toBe("12:05 AM")
    expect(horaLegible(new Date(2026, 9, 7, 12, 0))).toBe("12:00 PM")
  })
  it("fecha corta con hora, con o sin año", () => {
    expect(fechaHoraLegible(new Date(2026, 9, 7, 8, 19))).toBe("7 oct, 08:19 AM")
    expect(fechaHoraLegible(new Date(2026, 9, 3, 15, 20), { anio: true })).toBe("3 oct 2026, 03:20 PM")
    expect(fechaHoraLegible("nada")).toBe("")
  })
})

import { formatoFecha, NOMBRES_FORMATO, tituloSemana, rangoLargo, hora } from "./formatoFecha"

describe("formatoFecha: formatos con nombre (jueves 8 de octubre de 2026)", () => {
  const f = "2026-10-08"
  it("cada formato tiene su forma", () => {
    expect(formatoFecha(f, "largo")).toBe("Jueves, 8 de octubre de 2026")
    expect(formatoFecha(f, "largoSinDia")).toBe("8 de octubre de 2026")
    expect(formatoFecha(f, "medio")).toBe("8 oct 2026")
    expect(formatoFecha(f, "medioSinAnio")).toBe("8 oct")
    expect(formatoFecha(f, "corto")).toBe("jue 8 oct 2026")
    expect(formatoFecha("2026-10-09", "corto")).toBe("vie 9 oct 2026")
    expect(formatoFecha(f, "calendario")).toBe("Jueves, 8 de octubre")
    expect(formatoFecha(f, "diaNumero")).toBe("Jue 8")
    expect(formatoFecha(f, "diaMes")).toBe("8 de octubre")
    expect(formatoFecha(f, "mesAnio")).toBe("Octubre 2026")
    expect(formatoFecha(f, "mesAnioCorto")).toBe("oct 2026")
    expect(formatoFecha("2026-09-15", "mesAnioCorto")).toBe("sept 2026")
    expect(formatoFecha(f, "mes")).toBe("oct")
    expect(formatoFecha(f, "dia")).toBe("08")
    expect(formatoFecha(f, "numerico")).toBe("08/10/2026")
    expect(formatoFecha(f, "numericoCorto")).toBe("08/10")
  })
  it("solo la primera letra va en mayúscula (nunca 'De')", () => {
    expect(formatoFecha("2026-10-06", "calendario")).toBe("Martes, 6 de octubre")
    expect(formatoFecha("2026-10-06", "largo")).not.toMatch(/ De /)
  })
  it("en una frase la primera letra queda en minúscula", () => {
    expect(formatoFecha("2026-10-06", "calendario", { enFrase: true })).toBe("martes, 6 de octubre")
  })
  it("septiembre se abrevia 'sept' y los días no se corren por la zona horaria", () => {
    expect(formatoFecha("2026-09-01", "medio")).toBe("1 sept 2026")
    expect(formatoFecha("2026-01-01", "largo")).toBe("Jueves, 1 de enero de 2026")
    expect(formatoFecha("2026-12-31", "corto")).toBe("jue 31 dic 2026")
  })
  it("vacío o inválido da texto vacío y un formato desconocido avisa", () => {
    expect(formatoFecha("", "largo")).toBe("")
    expect(formatoFecha("no es fecha", "medio")).toBe("")
    expect(() => formatoFecha(f, "inventado")).toThrow()
    expect(NOMBRES_FORMATO).toContain("calendario")
  })
})

describe("rangos de fechas", () => {
  it("título de semana: mismo mes, dos meses y dos años", () => {
    expect(tituloSemana("2026-10-05", "2026-10-11")).toBe("5 – 11 oct 2026")
    expect(tituloSemana("2026-09-28", "2026-10-04")).toBe("28 sept – 4 oct 2026")
    expect(tituloSemana("2026-12-28", "2027-01-03")).toBe("28 dic 2026 – 3 ene 2027")
  })
  it("rango en palabras", () => {
    expect(rangoLargo("2026-10-05", "2026-10-11")).toBe("5 al 11 de octubre de 2026")
    expect(rangoLargo("2026-09-28", "2026-10-04")).toBe("28 de septiembre al 4 de octubre de 2026")
  })
})

describe("hora(): un solo formato, 09:00 AM", () => {
  it("convierte HH:MM de 24 h", () => {
    expect(hora("09:00")).toBe("09:00 AM")
    expect(hora("14:30")).toBe("02:30 PM")
    expect(hora("00:05")).toBe("12:05 AM")
    expect(hora("12:00")).toBe("12:00 PM")
  })
  it("normaliza una hora que ya viene en 12 h", () => {
    expect(hora("9:00 am")).toBe("09:00 AM")
    expect(hora("04:20 PM")).toBe("04:20 PM")
  })
  it("acepta un Date o un texto con fecha y hora", () => {
    expect(hora(new Date(2026, 9, 7, 8, 19))).toBe("08:19 AM")
    expect(hora(new Date(2026, 9, 7, 16, 20).toISOString())).toBe("04:20 PM")
  })
  it("sin valor o inválida, texto vacío", () => {
    expect(hora("")).toBe("")
    expect(hora(null)).toBe("")
    expect(hora("nada")).toBe("")
  })
})
