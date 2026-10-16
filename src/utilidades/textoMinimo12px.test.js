// Guarda de la regla 41 de docs/principios-diseno.md: ningún texto del sistema baja de 12 px. Los tamaños arbitrarios
// de Tailwind (text-[11px]) y los `fontSize` en línea menores a 12 se piden como text-xs (12 px) o más.
// Queda fuera a propósito la receta imprimible (AtencionPaciente.jsx): es papel.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const raiz = path.resolve(__dirname, "..")
const archivos = []
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.(js|jsx)$/.test(e.name) && !/\.test\./.test(e.name)) archivos.push(p)
  }
}
recorrer(raiz)
const EXCEPCIONES = ["AtencionPaciente.jsx"]

describe("texto mínimo de 12 px", () => {
  it("ninguna clase text-[Npx] baja de 12 px", () => {
    const culpables = []
    for (const f of archivos) {
      const t = fs.readFileSync(f, "utf8")
      for (const m of t.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) if (Number(m[1]) < 12) culpables.push(`${path.relative(raiz, f)}: ${m[0]}`)
    }
    expect(culpables).toEqual([])
  })
  it("ningún fontSize en línea de HTML baja de 12", () => {
    const culpables = []
    for (const f of archivos.filter((a) => !EXCEPCIONES.some((e) => a.endsWith(e)))) {
      const t = fs.readFileSync(f, "utf8")
      for (const m of t.matchAll(/style=\{\{[^}]*fontSize:\s*(\d+(?:\.\d+)?)/g)) if (Number(m[1]) < 12) culpables.push(`${path.relative(raiz, f)}: fontSize ${m[1]}`)
    }
    expect(culpables).toEqual([])
  })
  it("ningún texto de una gráfica SVG (atributo fontSize) baja de 12", () => {
    const culpables = []
    for (const f of archivos) {
      const t = fs.readFileSync(f, "utf8")
      for (const m of t.matchAll(/<text [^>]*fontSize="(\d+(?:\.\d+)?)"/g)) if (Number(m[1]) < 12) culpables.push(`${path.relative(raiz, f)}: fontSize ${m[1]}`)
    }
    expect(culpables).toEqual([])
  })
})
