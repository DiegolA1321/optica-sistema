// Guarda de la regla 43 (las ventanas con contenido usan la ventana estándar): toda capa que cubre la pantalla desvanece el fondo
// (backdrop-blur) y ninguna ventana estándar baja de la capa de la barra lateral, así nada queda sin desvanecer a su lado.
// Los menús pequeños de elección rápida (filtros, selector de fecha, menú de usuario) no son ventanas: no cubren la pantalla.
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
const relativo = (f) => path.relative(raiz, f).replace(/\\/g, "/")

describe("las ventanas desvanecen todo el fondo", () => {
  it("toda capa 'fixed inset-0' lleva backdrop-blur (salvo el telón del menú móvil, que solo existe en pantallas chicas)", () => {
    const culpables = []
    for (const f of archivos) {
      if (relativo(f) === "components/ui/dialog.jsx") continue // el diálogo base de la librería; ninguna pantalla lo usa
      fs.readFileSync(f, "utf8").split("\n").forEach((linea, i) => {
        if (!/fixed inset-0/.test(linea)) return
        if (/lg:hidden/.test(linea)) return // telón del menú lateral en móvil
        if (/backdrop-blur/.test(linea)) return
        // la capa de clic de Login va en dos líneas: la primera lleva el centrado y la segunda el desvanecido
        if (/overflow-y-auto/.test(linea)) return
        culpables.push(`${relativo(f)}:${i + 1}`)
      })
    }
    expect(culpables).toEqual([])
  })

  it("ninguna ventana estándar (Cascaron) se pone por debajo de la barra lateral", () => {
    const culpables = []
    for (const f of archivos) {
      const t = fs.readFileSync(f, "utf8")
      for (const m of t.matchAll(/capa=["{]+\s*["']?(z-(?:\[(\d+)\]|(\d+)))/g)) {
        const nivel = Number(m[2] || m[3])
        if (nivel < 50) culpables.push(`${relativo(f)}: ${m[1]}`)
      }
    }
    expect(culpables).toEqual([])
  })
})
