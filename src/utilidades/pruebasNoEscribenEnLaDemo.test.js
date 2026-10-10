// Guarda de la regla 28: las pruebas que crean o cambian datos corren en la óptica de pruebas ('E2E'), nunca en la Demo.
// La guardia en tiempo de ejecución (e2e/guardia-demo.js) cancela cualquier escritura de una sesión de la Demo; esta comprobación estática
// la acompaña y avisa ANTES de correr nada: una prueba que escribe (usa conEscritura, el prefijo de datos de prueba o crea citas y pacientes
// de prueba) no puede abrir sesión sin decir 'E2E'. (El 7 oct 2026 una prueba nueva escribió en la Demo antes de que existiera la guardia
// y dejó "E2E Motivo f9jv2" en el catálogo.) Un mismo archivo puede mezclar pruebas de lectura sobre la Demo y de escritura sobre 'E2E':
// se mira prueba por prueba.
import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"

const carpeta = path.resolve(__dirname, "../../e2e")
const specs = fs.readdirSync(carpeta).filter((f) => f.endsWith(".spec.js"))
const ESCRIBE = /conEscritura\(|\bPREFIJO\b|nombrePrueba\(|crearCitaDeHoyParaPaula\(|crearPacienteConHistorial\(|agendarCitaParaPaula\(|prepararAvisosInicio\(/

describe("las pruebas que escriben no corren en la Demo", () => {
  it("toda prueba que escribe abre sesión con 'E2E'", () => {
    const culpables = []
    for (const archivo of specs) {
      const texto = fs.readFileSync(path.join(carpeta, archivo), "utf8")
      // Cada bloque empieza en un test( al comienzo de línea; lo anterior (ayudas y definiciones) no se mira.
      const bloques = texto.split(/\n(?=test\()/).slice(1)
      for (const bloque of bloques) {
        if (!ESCRIBE.test(bloque)) continue
        const titulo = (bloque.match(/^test\((['"`])(.*?)\1/) || [])[2] || "(sin título)"
        for (const linea of bloque.split("\n")) {
          if (/iniciarSesion\(/.test(linea) && !/'E2E'|"E2E"|entorno/.test(linea)) culpables.push(`${archivo}: ${titulo}`)
        }
      }
    }
    expect([...new Set(culpables)]).toEqual([])
  })
})
