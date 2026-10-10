// Guarda de la regla 2 (un mismo concepto se llama igual en todo el sistema): el inventario se llama "Inventario" y cada ítem, "Producto".
// Ninguna pantalla dice "bodega" ni titula el módulo con otro nombre.
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
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
const culpables = (patron) => archivos.filter((f) => patron.test(sinComentarios(fs.readFileSync(f, "utf8")))).map((f) => path.relative(raiz, f).split(path.sep).join("/"))

describe("nombres del inventario", () => {
  it("ningún texto de pantalla llama 'bodega' al inventario", () => {
    expect(culpables(/\bbodega\b/i)).toEqual([])
  })
  it("el módulo se titula 'Inventario' y no 'Monturas y accesorios'; el botón es 'Agregar producto' (no 'Añadir' ni 'Ingresar montura')", () => {
    expect(culpables(/>Monturas y accesorios</)).toEqual([])
    expect(culpables(/Añadir producto|Ingresar montura/)).toEqual([])
  })
})
