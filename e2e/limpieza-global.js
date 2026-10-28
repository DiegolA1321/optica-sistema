// Antes de cada corrida de Playwright: deja la óptica de pruebas ("QA Test Claude") sin los datos de corridas anteriores.
// Así las pruebas que crean datos (citas, pacientes, ventas...) parten de una óptica conocida y pueden comprobar nombres exactos.
//
// Ejecuta scripts/limpiar-optica-pruebas.mjs --ejecutar. Ese script tiene el id de la óptica de pruebas fijo y aborta, sin
// cambiar nada, si el id no corresponde a "QA Test Claude" o si cambia el conteo de filas de CUALQUIER otra óptica: nunca toca
// la Demo ni Solna Vision. Este archivo no recibe ni pasa ningún id: no hay forma de apuntarlo a otra óptica.
//
// E2E_SIN_LIMPIEZA=1 la omite (por ejemplo, para inspeccionar los datos que dejó una corrida).
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import { ARCHIVO_ESCRITURAS_DEMO } from './guardia-demo.js'

export default async function limpiarOpticaDePruebas() {
  fs.rmSync(ARCHIVO_ESCRITURAS_DEMO, { force: true }) // la guardia de la Demo empieza cada corrida sin anotaciones
  if (process.env.E2E_SIN_LIMPIEZA) {
    console.log('[limpieza] omitida (E2E_SIN_LIMPIEZA)')
    return
  }
  // La limpieza corre en una transacción que ve una foto fija; si otra escritura (el cron de citas, otra prueba) toca a la vez una fila de la óptica de pruebas, la base responde
  // «could not serialize access» (o espera de más, o un bloqueo cruzado) y no cambia nada: se repite. Cualquier otro motivo de cancelación (por ejemplo cambios en una óptica real) NO se reintenta.
  let r, salida
  for (let intento = 1; intento <= 5; intento++) {
    r = spawnSync(process.execPath, ['--env-file=.env.local', 'scripts/limpiar-optica-pruebas.mjs', '--ejecutar'], { encoding: 'utf8' })
    salida = `${r.stdout || ''}${r.stderr || ''}`
    if (r.status === 0 || !/could not serialize access|deadlock detected|canceling statement due to (statement|lock) timeout/.test(salida)) break
    console.log(`[limpieza] la base pidió repetir (escritura simultánea); intento ${intento + 1}`)
    await new Promise((res) => setTimeout(res, 3000))
  }
  if (r.status !== 0 || !salida.includes('LIMPIADA (commit)')) {
    throw new Error(`No se pudo limpiar la óptica de pruebas antes de la corrida (se cancela para no probar sobre datos viejos):\n${salida.split('\n').slice(-8).join('\n')}`)
  }
  const resumen = salida.split('\n').find((l) => l.startsWith('Borrado en QA Test Claude')) || ''
  console.log(`[limpieza] óptica de pruebas limpiada. ${resumen.slice(0, 160)}`)
}
