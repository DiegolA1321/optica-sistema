// Guarda de la regla 32: las fechas se eligen con el calendario del sistema (CampoFecha), no con el campo de fecha del navegador, que se ve y
// se comporta distinto en cada navegador y no sigue el formato del sistema.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const raiz = path.resolve(__dirname, "..")
const archivos = []
const recorrer = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) recorrer(p)
    else if (/\.jsx$/.test(e.name) && !/\.test\./.test(e.name)) archivos.push(p)
  }
}
recorrer(raiz)

describe("fechas del sistema", () => {
  it("ninguna pantalla usa un campo de fecha del navegador (type=\"date\")", () => {
    const culpables = archivos.filter((f) => /type=["']date["']/.test(fs.readFileSync(f, "utf8"))).map((f) => path.relative(raiz, f).split(path.sep).join("/"))
    expect(culpables).toEqual([])
  })
})
