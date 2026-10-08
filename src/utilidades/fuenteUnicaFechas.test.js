// Guarda de la regla "una sola fuente de fechas y horas": ninguna pantalla arma meses o fechas a mano, así septiembre es
// "sept" (4 letras) en todos lados y los formatos no se desparraman. Todo sale de utilidades/formatoFecha.js.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const raiz = path.resolve(__dirname, "..")
const archivos = []
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name) && e.name !== "formatoFecha.js") archivos.push(p)
  }
}
recorrer(raiz)
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("fuente única de fechas y horas", () => {
  it("ninguna pantalla define arreglos de meses abreviados ni de meses completos", () => {
    const culpables = archivos.filter((f) => /["']ene["']\s*,\s*["']feb["']/.test(sinComentarios(fs.readFileSync(f, "utf8"))) || /["']enero["']\s*,\s*["']febrero["']/.test(sinComentarios(fs.readFileSync(f, "utf8"))))
    expect(culpables.map((f) => path.relative(raiz, f))).toEqual([])
  })
  it("nadie usa toLocaleDateString ni toLocaleTimeString para mostrar fechas u horas", () => {
    const culpables = archivos.filter((f) => /toLocale(Date|Time)String/.test(sinComentarios(fs.readFileSync(f, "utf8"))))
    expect(culpables.map((f) => path.relative(raiz, f))).toEqual([])
  })
  it("septiembre se abrevia con cuatro letras, igual en todos los formatos", async () => {
    const { formatoFecha, nombreMes, MESES_CORTOS } = await import("./formatoFecha")
    expect(MESES_CORTOS[8]).toBe("sept")
    expect(nombreMes(8, "corto")).toBe("sept")
    for (const nombre of ["medio", "medioSinAnio", "corto", "mesAnioCorto", "mes"]) expect(formatoFecha("2026-09-15", nombre)).toMatch(/\bsept\b/)
  })
})
