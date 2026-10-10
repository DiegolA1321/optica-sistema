// Al terminar cada corrida de Playwright: falla si alguna prueba intentó escribir en la Óptica Demo (ver guardia-demo.js).
import fs from 'node:fs'
import { ARCHIVO_ESCRITURAS_DEMO } from './guardia-demo.js'

export default async function verificarQueNadieEscribioEnLaDemo() {
  if (!fs.existsSync(ARCHIVO_ESCRITURAS_DEMO)) return
  const intentos = fs.readFileSync(ARCHIVO_ESCRITURAS_DEMO, 'utf8').trim()
  if (!intentos) return
  throw new Error(`Una prueba intentó escribir en la Óptica Demo (es de solo lectura; usa la óptica de pruebas). Se canceló cada escritura:\n${intentos}`)
}
