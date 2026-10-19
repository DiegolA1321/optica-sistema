import { describe, it, expect } from "vitest"
import { serieDeGraduacion, porcentajeAbonado, enCuantoTiempo, agruparPorAnio, avisosDelPaciente, archivoIcs, estadoDeLaOpticaHoy, valorD, filtrarVisitas } from "./portalVistas"
import { resumenCambioGraduacion } from "./portalPaciente"

const c = (fecha, odEsf, oiEsf) => ({ fecha, od: { esfera: odEsf, cilindro: "" }, oi: { esfera: oiEsf, cilindro: "" } })

describe("la frase de cambio por ojo", () => {
  it("usa el mes del examen anterior", () => {
    const r = resumenCambioGraduacion([c("2026-10-01", "-2.00", "-1.25"), c("2026-03-15", "-1.50", "-1.25")])
    expect(r.frases).toEqual(["Tu ojo derecho necesita un poco más de corrección que en marzo.", "Tu ojo izquierdo se mantiene igual que en marzo."])
    expect(resumenCambioGraduacion([c("2026-10-01", "-1.00", "-1.25"), c("2026-03-15", "-1.50", "-1.25")]).frases[0]).toBe("Tu ojo derecho necesita un poco menos de corrección que en marzo.")
  })
})

describe("piezas de las pantallas", () => {
  it("la serie de la gráfica va de la receta más antigua a la más reciente, con los puntos de la tendencia del personal", () => {
    const s = serieDeGraduacion([c("2026-10-01", "-2.00", "-1.25"), c("2026-03-15", "-1.50", "-1.25"), c("2025-09-01", "-1.00", "-1.00")])
    expect(s.map((p) => p.fecha)).toEqual(["2025-09-01", "2026-03-15", "2026-10-01"])
    expect(s[2].od).toBe(-2)
  })
  it("el saldo: porcentaje abonado acotado de 0 a 100", () => {
    expect(porcentajeAbonado(265, 120)).toBe(45)
    expect(porcentajeAbonado(0, 0)).toBe(0)
    expect(porcentajeAbonado(100, 150)).toBe(100)
  })
  it("el control en palabras", () => {
    expect(enCuantoTiempo(60)).toBe("en 2 meses")
    expect(enCuantoTiempo(40)).toBe("en 40 días")
    expect(enCuantoTiempo(1)).toBe("es mañana")
    expect(enCuantoTiempo(-3)).toBe("ya venció")
    expect(enCuantoTiempo(30 * 14)).toBe("en 14 meses")
  })
  it("agrupa el historial por año", () => {
    const g = agruparPorAnio([{ fecha: "2026-05-01" }, { fecha: "2026-01-01" }, { fecha: "2025-11-01" }])
    expect(g.map((x) => [x.anio, x.citas.length])).toEqual([["2026", 2], ["2025", 1]])
  })
})

describe("avisos del paciente", () => {
  const hoy = new Date(2026, 9, 17, 12)
  it("salen de los mismos hechos que ve el personal", () => {
    expect(avisosDelPaciente({ ordenes: [{ id: "o", estado: "lista" }, { id: "p", estado: "enviada" }], hoy }).map((a) => a.texto)).toEqual(["Tus lentes están listos para retirar"])
    expect(avisosDelPaciente({ proximaCita: { id: "c", fecha: "2026-10-18", hora: "10:40 AM" }, hoy })[0].texto).toBe("Mañana tienes cita a las 10:40 AM")
    expect(avisosDelPaciente({ proximaCita: { id: "c", fecha: "2026-10-17", hora: "10:40 AM" }, hoy })[0].texto).toBe("Hoy tienes cita a las 10:40 AM")
    expect(avisosDelPaciente({ proximaCita: { id: "c", fecha: "2026-10-30", hora: "10:40 AM" }, hoy })).toEqual([])
    expect(avisosDelPaciente({ control: { vencido: false, pronto: true, iso: "2026-11-01", dias: 15 }, hoy })[0].texto).toBe("Tu control está próximo: 1 nov 2026")
    expect(avisosDelPaciente({ control: { vencido: true, pronto: false, iso: "2026-01-01", dias: -290 }, hoy })[0].va).toBe("resumen")
  })
  it("con una cita ya agendada, el control no se avisa", () => {
    expect(avisosDelPaciente({ control: { vencido: true }, proximaCita: { id: "c", fecha: "2026-10-30", hora: "10:40 AM" }, hoy })).toEqual([])
  })
  it("sin nada que avisar no hay avisos", () => {
    expect(avisosDelPaciente({ hoy })).toEqual([])
  })
})

describe("agregar a mi calendario", () => {
  it("el .ics lleva la fecha y la hora de Ecuador, el motivo, el lugar y un recordatorio", () => {
    const ics = archivoIcs({ cita: { id: "x1", fecha: "2026-10-21", hora: "10:40 AM", motivo: "Examen de Control" }, optica: "Óptica Solna", direccion: "Av. 9 de Octubre 123, Guayaquil", ahora: new Date("2026-10-17T15:00:00Z") })
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("DTSTART;TZID=America/Guayaquil:20261021T104000")
    expect(ics).toContain("DTEND;TZID=America/Guayaquil:20261021T112000")
    expect(ics).toContain("SUMMARY:Cita en Óptica Solna")
    expect(ics).toContain("LOCATION:Av. 9 de Octubre 123\\, Guayaquil")
    expect(ics).toContain("TRIGGER:-P1D")
    expect(ics).toContain("DTSTAMP:20261017T150000Z")
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
  })
  it("una cita de la tarde queda a la hora correcta", () => {
    expect(archivoIcs({ cita: { id: "x", fecha: "2026-10-21", hora: "04:40 PM" } })).toContain("DTSTART;TZID=America/Guayaquil:20261021T164000")
  })
})

describe("la óptica, hoy", () => {
  const dia = (manana) => ({ manana })
  const abre = { activo: true, inicio: "09:00", fin: "18:00" }
  // sábado 17 de octubre de 2026
  const sab = (h, m = 0) => new Date(2026, 9, 17, h, m)
  const horarioSemanal = { lunes: dia(abre), martes: dia(abre), miercoles: dia(abre), jueves: dia(abre), viernes: dia(abre), sabado: { manana: { activo: false } }, domingo: { manana: { activo: false } } }
  it("sin horario cargado no dice nada", () => { expect(estadoDeLaOpticaHoy(null)).toBeNull() })
  it("cerrado el sábado: dice cuándo vuelve a abrir (el lunes)", () => {
    expect(estadoDeLaOpticaHoy({ horarioSemanal }, sab(11))).toEqual({ abierto: false, texto: "Cerrado hoy · abre el lunes a las 09:00 AM" })
  })
  it("abierto: hasta qué hora", () => {
    const lunes = new Date(2026, 9, 19, 11)
    expect(estadoDeLaOpticaHoy({ horarioSemanal }, lunes)).toEqual({ abierto: true, texto: "Abierto hoy hasta las 06:00 PM" })
  })
  it("antes de abrir, dice a qué hora abre hoy; el domingo cerrado también apunta al lunes", () => {
    expect(estadoDeLaOpticaHoy({ horarioSemanal }, new Date(2026, 9, 19, 7)).texto).toBe("Cerrado ahora · abre hoy a las 09:00 AM")
    expect(estadoDeLaOpticaHoy({ horarioSemanal }, new Date(2026, 9, 18, 10)).texto).toBe("Cerrado hoy · abre mañana a las 09:00 AM")
  })
})

describe("los valores de la receta como los lee el paciente", () => {
  it("lleva el signo menos de verdad, dos decimales y «+» en los positivos", () => {
    expect(valorD("-2.25")).toBe("−2.25")
    expect(valorD("-0,50")).toBe("−0.50")
    expect(valorD("+1.75")).toBe("+1.75")
    expect(valorD("1.5")).toBe("+1.50")
    expect(valorD("0")).toBe("0.00")
    expect(valorD("")).toBe("")
    expect(valorD(null)).toBe("")
  })
})

describe("filtrarVisitas", () => {
  const hoy = new Date(2026, 9, 18)
  const h = [
    { id: 1, fecha: "2026-07-09", motivo: "Examen de control", estado: "No Asistió" },
    { id: 2, fecha: "2026-04-20", motivo: "Examen de control", estado: "Atendida" },
    { id: 3, fecha: "2025-11-21", motivo: "Examen de control", estado: "Atendida" },
    { id: 4, fecha: "2025-04-25", motivo: "Consulta general", estado: "Atendida" },
    { id: 5, fecha: "2024-02-01", motivo: "Garantía", estado: "Cancelada" },
  ]
  const prof = (c) => (c.id === 2 ? "Dra. Paula Andrade" : "")
  const ids = (f) => filtrarVisitas(h, { profesional: prof, hoy, ...f }).map((c) => c.id)
  it("el último año llega hasta el mismo día del año pasado", () => {
    expect(ids({})).toEqual([1, 2, 3])
    expect(ids({ periodo: "todas" })).toEqual([1, 2, 3, 4, 5])
  })
  it("elegir fechas, estado y texto (sin tildes)", () => {
    expect(ids({ periodo: "fechas", desde: "2025-04-01", hasta: "2025-12-31" })).toEqual([3, 4])
    expect(ids({ periodo: "todas", estado: "Atendida" })).toEqual([2, 3, 4])
    expect(ids({ periodo: "todas", texto: "garantia" })).toEqual([5])
    expect(ids({ periodo: "todas", texto: "paula" })).toEqual([2])
  })
})
