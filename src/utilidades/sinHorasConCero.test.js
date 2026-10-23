import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { horaSinCero } from "./formatoFecha"
import { resumenHorarioSemanal, estadoAtencionHoy } from "./disponibilidad"

// Ninguna hora se MUESTRA con el cero de adelante ("9:00 AM", nunca "09:00 AM"). El valor guardado de una cita sigue siendo "09:00 AM" (así se comparan y se ofrecen
// los horarios), pero todo lo que se escribe en pantalla, en un documento o en un reporte pasa por horaSinCero().
const archivos = []
const recorrer = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.(jsx|js)$/.test(e.name) && !/\.test\./.test(e.name)) archivos.push(p)
  }
}
recorrer(path.resolve(__dirname, ".."))

describe("horas sin cero de adelante", () => {
  it("horaSinCero quita el cero y devuelve tal cual lo que no es una hora", () => {
    expect(horaSinCero("09:00 AM")).toBe("9:00 AM")
    expect(horaSinCero("13:05")).toBe("1:05 PM")
    expect(horaSinCero("12:00 PM")).toBe("12:00 PM")
    expect(horaSinCero("10:20 AM")).toBe("10:20 AM")
    expect(horaSinCero("")).toBe("")
    expect(horaSinCero(undefined)).toBe("")
    expect(horaSinCero("Por confirmar")).toBe("Por confirmar")
  })

  it("el horario de la óptica se lee «9:00 AM – 1:00 PM y 2:00 PM – 6:00 PM»", () => {
    const dia = { manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: true, inicio: "14:00", fin: "18:00" } }
    const semana = { lunes: dia, martes: dia, miercoles: dia, jueves: dia, viernes: dia, sabado: { manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: false } }, domingo: { manana: { activo: false }, tarde: { activo: false } } }
    const resumen = resumenHorarioSemanal(semana)
    expect(resumen[0].horario).toBe("9:00 AM – 1:00 PM y 2:00 PM – 6:00 PM")
    expect(resumen[1].horario).toBe("9:00 AM – 1:00 PM")
    for (const r of resumen) expect(r.horario).not.toMatch(/(^|[^\d])0\d:\d\d/)
  })

  it("«Abierto hoy hasta las…» tampoco lleva cero", () => {
    const hoy = new Date()
    const clave = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"][hoy.getDay()]
    const horario = { [clave]: { manana: { activo: true, inicio: "00:00", fin: "23:58" }, tarde: { activo: false } } }
    const { texto } = estadoAtencionHoy({ horarioSemanal: horario, excepciones: {} })
    expect(texto).not.toMatch(/(^|[^\d])0\d:\d\d/)
  })

  it("ninguna pantalla escribe la hora guardada de una cita sin pasar por horaSinCero()", () => {
    const sospechosos = []
    const jsx = new RegExp("(?<![=\\w])\\{[\\w$]+(?:\\??\\.[\\w$]+|\\[[^\\]]+\\])*\\.hora\\}", "g") // {cita.hora}
    const plantilla = new RegExp("\\$\\{[\\w$]+(?:\\??\\.[\\w$]+|\\[[^\\]]+\\])*\\.hora\\}", "g") // ${cita.hora}
    const concatenada = /["'`]\s*\+\s*[\w$]+(?:\??\.[\w$]+)*\.hora\b(?!\w)/g // " · " + cita.hora
    for (const archivo of archivos) {
      const lineas = fs.readFileSync(archivo, "utf8").split(/\r?\n/)
      lineas.forEach((l, i) => {
        if (jsx.test(l) || plantilla.test(l) || concatenada.test(l)) sospechosos.push(`${path.relative(path.resolve(__dirname, ".."), archivo)}:${i + 1}`)
        jsx.lastIndex = plantilla.lastIndex = concatenada.lastIndex = 0
      })
    }
    expect(sospechosos, "Estas líneas muestran la hora guardada con su cero: envuélvela en horaSinCero()").toEqual([])
  })
})
