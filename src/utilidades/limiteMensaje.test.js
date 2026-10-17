import { describe, it, expect } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { LIMITE_MENSAJE, UMBRAL_CONTADOR, contadorVisible, textoContador } from "./limiteMensaje"

const RAIZ = path.resolve(__dirname, "../..")
const leer = (ruta) => fs.readFileSync(path.join(RAIZ, ruta), "utf8")

describe("el límite de un mensaje", () => {
  it("es 2000 y el contador aparece solo desde 1800", () => {
    expect(LIMITE_MENSAJE).toBe(2000)
    expect(UMBRAL_CONTADOR).toBe(1800)
    expect(contadorVisible(1799)).toBe(false)
    expect(contadorVisible(1800)).toBe(true)
    expect(textoContador(1850)).toBe("1850 de 2000")
  })

  // Todos los lugares donde se escribe un mensaje usan el mismo límite y su contador: el soporte (ofrecer ayuda, responder, respuestas guardadas), el administrador
  // (escribir al soporte, responder, publicar un aviso) y el personal (escribir a su administrador, que es la misma consulta).
  const LUGARES = [
    ["src/componentes/superadmin/VentanaOfrecerAyuda.jsx", ['id="mensaje-ayuda"']],
    ["src/componentes/soporte/VentanaConsultaSoporte.jsx", ['id="soporte-sa-respuesta"']],
    ["src/componentes/soporte/SoporteSuperadmin.jsx", ['id="rg-texto"']],
    ["src/componentes/soporte/VentanaNuevaConsulta.jsx", ['id="soporte-descripcion"']],
    ["src/componentes/soporte/VentanaConsulta.jsx", ['id="soporte-respuesta"', 'id="soporte-reabrir"']],
    ["src/componentes/soporte/VentanaNuevoAviso.jsx", ['id="aviso-cuerpo"']],
  ]
  for (const [archivo, ids] of LUGARES) {
    it(`${path.basename(archivo)}: el cuadro del mensaje usa el límite común y su contador`, () => {
      const fuente = leer(archivo)
      for (const id of ids) {
        const linea = fuente.split("\n").find((l) => l.includes("<textarea") && l.includes(id))
        expect(linea, `no se encontró el cuadro ${id}`).toBeTruthy()
        expect(linea).toContain("maxLength={LIMITE_MENSAJE}")
      }
      expect(fuente).toContain("<ContadorMensaje")
    })
  }
  it("los avisos del superadmin (Soporte › Nuevo aviso) también", () => {
    const fuente = leer("src/paginas/SuperadminPanel.jsx")
    expect(fuente).toMatch(/maxLength=\{LIMITE_MENSAJE\} value=\{avisoCuerpo\}/)
    expect(fuente).toContain("<ContadorMensaje valor={avisoCuerpo} />")
  })
  it("ningún cuadro de mensaje conserva el límite viejo de 4000", () => {
    const viejos = []
    const ver = (dir) => { for (const e of fs.readdirSync(path.join(RAIZ, dir), { withFileTypes: true })) { const r = path.join(dir, e.name); if (e.isDirectory()) ver(r); else if (/\.jsx$/.test(e.name) && !/\.test\./.test(e.name) && /maxLength=\{4000\}/.test(leer(r))) viejos.push(r) } }
    ver("src")
    expect(viejos).toEqual([])
  })
})
