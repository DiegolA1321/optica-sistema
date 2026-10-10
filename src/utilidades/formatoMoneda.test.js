import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { dinero } from "./formatoMoneda"

describe("dinero", () => {
  it("separa los miles con coma y lleva siempre dos decimales con punto", () => {
    expect(dinero(3915.5)).toBe("$3,915.50")
    expect(dinero(1234567.891)).toBe("$1,234,567.89")
    expect(dinero(999)).toBe("$999.00")
    expect(dinero(1000)).toBe("$1,000.00")
    expect(dinero(0.5)).toBe("$0.50")
  })
  it("acepta números escritos como texto y tolera lo que no es número", () => {
    expect(dinero("223")).toBe("$223.00")
    expect(dinero("720.3")).toBe("$720.30")
    for (const raro of [null, undefined, "", "abc", NaN, Infinity]) expect(dinero(raro)).toBe("$0.00")
  })
  it("los negativos llevan el signo antes del dólar y un cero negativo no lo lleva", () => {
    expect(dinero(-1234.5)).toBe("-$1,234.50")
    expect(dinero(-0.001)).toBe("$0.00")
  })
})

// Guarda: ninguna pantalla arma montos a mano con toFixed(2) ni define su propia función de dinero.
const raiz = path.resolve(__dirname, "..")
const archivos = []
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name) && e.name !== "formatoMoneda.js") archivos.push(p)
  }
}
recorrer(raiz)
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("fuente única del dinero", () => {
  it("nadie escribe un '$' seguido de un valor con toFixed(2): todo monto sale de dinero()", () => {
    const culpables = archivos.filter((f) => /\$\$?\{[^{}]*\.toFixed\(2\)\}/.test(sinComentarios(fs.readFileSync(f, "utf8"))))
    expect(culpables.map((f) => path.relative(raiz, f))).toEqual([])
  })
  it("nadie define su propia función de dinero", () => {
    const culpables = archivos.filter((f) => /const\s+dinero\s*=/.test(sinComentarios(fs.readFileSync(f, "utf8"))))
    expect(culpables.map((f) => path.relative(raiz, f))).toEqual([])
  })
})
