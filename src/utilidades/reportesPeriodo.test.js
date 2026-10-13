import { describe, it, expect } from "vitest"
import { rangoDePeriodo, rangoAnterior, textoRango, etiquetaComparacion, variacion, enRango, diaDe, ultimosMeses, porcentaje } from "./reportesPeriodo"

// 12 de octubre de 2026 (lunes), hora de pared de Ecuador.
const hoy = new Date(2026, 9, 12, 20, 0, 0)

describe("períodos de Reportes", () => {
  it("Este mes va del 1 a hoy; Mes pasado, el mes completo; 3 y 6 meses terminan hoy; Este año empieza el 1 de enero", () => {
    expect(rangoDePeriodo("mes", {}, hoy)).toEqual({ inicio: "2026-10-01", fin: "2026-10-12" })
    expect(rangoDePeriodo("mesPasado", {}, hoy)).toEqual({ inicio: "2026-09-01", fin: "2026-09-30" })
    expect(rangoDePeriodo("trimestre", {}, hoy)).toEqual({ inicio: "2026-08-01", fin: "2026-10-12" })
    expect(rangoDePeriodo("semestre", {}, hoy)).toEqual({ inicio: "2026-05-01", fin: "2026-10-12" })
    expect(rangoDePeriodo("anio", {}, hoy)).toEqual({ inicio: "2026-01-01", fin: "2026-10-12" })
    expect(rangoDePeriodo("personalizado", { inicio: "2026-03-05", fin: "2026-03-20" }, hoy)).toEqual({ inicio: "2026-03-05", fin: "2026-03-20" })
  })

  it("el mes en curso se compara con el mismo tramo de días del mes anterior (1 al 12 contra 1 al 12)", () => {
    const rango = rangoDePeriodo("mes", {}, hoy)
    expect(rangoAnterior("mes", rango, hoy)).toEqual({ inicio: "2026-09-01", fin: "2026-09-12" })
    expect(etiquetaComparacion(rangoAnterior("mes", rango, hoy), hoy)).toBe("vs. 1 al 12 sept")
  })

  it("el 31 de un mes se compara con un mes más corto sin pasarse de su último día", () => {
    const fin = new Date(2026, 2, 31)
    expect(rangoAnterior("mes", rangoDePeriodo("mes", {}, fin), fin)).toEqual({ inicio: "2026-02-01", fin: "2026-02-28" })
  })

  it("el año en curso se compara con el mismo tramo del año anterior; los demás con la ventana inmediata de igual largo", () => {
    expect(rangoAnterior("anio", rangoDePeriodo("anio", {}, hoy), hoy)).toEqual({ inicio: "2025-01-01", fin: "2025-10-12" })
    expect(rangoAnterior("mesPasado", rangoDePeriodo("mesPasado", {}, hoy), hoy)).toEqual({ inicio: "2026-08-01", fin: "2026-08-31" })
    expect(rangoAnterior("personalizado", { inicio: "2026-10-05", fin: "2026-10-11" }, hoy)).toEqual({ inicio: "2026-09-28", fin: "2026-10-04" })
  })

  it("el texto del tramo dice el año solo cuando hace falta", () => {
    expect(textoRango({ inicio: "2026-09-28", fin: "2026-10-04" }, hoy)).toBe("28 sept al 4 oct")
    expect(textoRango({ inicio: "2025-01-01", fin: "2025-10-12" }, hoy)).toBe("1 ene al 12 oct 2025")
  })
})

describe("variación frente al período anterior", () => {
  it("más ventas es bueno (verde) y más inasistencias es malo (rojo)", () => {
    expect(variacion(150, 100)).toMatchObject({ flecha: "↑", tono: "bueno", texto: "50%" })
    expect(variacion(150, 100, { buenoSiSube: false })).toMatchObject({ flecha: "↑", tono: "malo" })
    expect(variacion(50, 100)).toMatchObject({ flecha: "↓", tono: "malo", texto: "50%" })
  })
  it("con una base pequeña dice el valor anterior en lugar de un porcentaje que exagere", () => {
    expect(variacion(5, 1)).toMatchObject({ texto: "antes 1", tono: "bueno", flecha: "↑" })
    expect(variacion(0, 3, { buenoSiSube: false })).toMatchObject({ texto: "antes 3", tono: "bueno", flecha: "↓" })
    expect(variacion(250, 80, { baseMinima: 100, formato: (n) => `$${n}.00` })).toMatchObject({ texto: "antes $80.00" })
  })
  it("las tasas se restan (puntos), no se dividen", () => {
    expect(variacion(30, 10, { puntos: true, buenoSiSube: false })).toMatchObject({ texto: "20 pts", tono: "malo" })
  })
  it("igual, o sin período anterior", () => {
    expect(variacion(4, 4)).toMatchObject({ texto: "igual", flecha: "→", tono: "neutro" })
    expect(variacion(4, null).texto).toBe("sin dato anterior")
  })
  it("el porcentaje sin base es null (no se inventa 0 %)", () => {
    expect(porcentaje(1, 0)).toBeNull()
    expect(porcentaje(1, 3)).toBe(33)
  })
})

describe("fechas de Reportes", () => {
  it("un instante de la noche en Ecuador cuenta en el día de Ecuador, no en el siguiente de la hora universal", () => {
    expect(diaDe("2026-11-01T02:00:00Z")).toBe("2026-10-31")
    expect(enRango("2026-11-01T02:00:00Z", { inicio: "2026-10-01", fin: "2026-10-31" })).toBe(true)
    expect(diaDe("2026-10-05")).toBe("2026-10-05")
  })
  it("los últimos 12 meses terminan en el mes de hoy y se llaman como el resto del sistema", () => {
    const m = ultimosMeses(12, hoy)
    expect(m).toHaveLength(12)
    expect(m[11]).toMatchObject({ clave: "2026-10", inicio: "2026-10-01", fin: "2026-10-31", etiqueta: "oct 2026" })
    expect(m[0].clave).toBe("2025-11")
    expect(m[10].etiqueta).toBe("sept 2026")
  })
})
