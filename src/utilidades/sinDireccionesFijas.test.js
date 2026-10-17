import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

// Ningún aviso ni mensaje del sistema escribe una dirección con localhost o con un dominio fijo: lo que hay que abrir se guarda como dato (un módulo, una
// pantalla) y se abre en el sistema donde esté; los enlaces de los correos salen de la configuración (el secreto `app_base_url`), no del código.
const RAIZ = path.resolve(__dirname, "../..")
const PROHIBIDO = /localhost|127\.0\.0\.1|vercel\.app|optica-sistema-zeta/i

function archivos(dir, extensiones, saltar = []) {
  const salida = []
  if (!fs.existsSync(dir)) return salida
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const ruta = path.join(dir, e.name)
    if (e.isDirectory()) { if (!saltar.includes(e.name)) salida.push(...archivos(ruta, extensiones, saltar)) }
    else if (extensiones.some((x) => e.name.endsWith(x)) && !/\.test\./.test(e.name)) salida.push(ruta)
  }
  return salida
}

describe("sin direcciones fijas en el código", () => {
  it("ni el código de la aplicación ni las funciones de la base escriben localhost ni un dominio fijo", () => {
    const candidatos = [
      ...archivos(path.join(RAIZ, "src"), [".js", ".jsx"]),
      ...archivos(path.join(RAIZ, "supabase", "functions"), [".ts", ".js"], ["node_modules"]),
      ...archivos(path.join(RAIZ, "supabase", "migrations"), [".sql"]),
    ]
    const hallazgos = candidatos
      .filter((f) => !f.endsWith("sinDireccionesFijas.test.js"))
      .flatMap((f) => fs.readFileSync(f, "utf8").split("\n").map((l, i) => ({ f: path.relative(RAIZ, f), n: i + 1, l })).filter(({ l }) => PROHIBIDO.test(l) && !/^\s*(--|\/\/)/.test(l)))
    expect(hallazgos.map((h) => `${h.f}:${h.n} ${h.l.trim().slice(0, 100)}`)).toEqual([])
  })
})
