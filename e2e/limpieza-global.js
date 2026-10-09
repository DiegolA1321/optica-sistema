// Antes de cada corrida de Playwright: deja la óptica de pruebas ("QA Test Claude") sin los datos de corridas anteriores.
// Así las pruebas que crean datos (citas, pacientes, ventas...) parten de una óptica conocida y pueden comprobar nombres exactos.
//
// Ejecuta scripts/limpiar-optica-pruebas.mjs --ejecutar. Ese script tiene el id de la óptica de pruebas fijo y aborta, sin
// cambiar nada, si el id no corresponde a "QA Test Claude" o si cambia el conteo de filas de CUALQUIER otra óptica: nunca toca
// la Demo ni Solna Vision. Este archivo no recibe ni pasa ningún id: no hay forma de apuntarlo a otra óptica.
//
// E2E_SIN_LIMPIEZA=1 la omite (por ejemplo, para inspeccionar los datos que dejó una corrida).
import { spawnSync } from 'node:child_process'

export default async function limpiarOpticaDePruebas() {
  if (process.env.E2E_SIN_LIMPIEZA) {
    console.log('[limpieza] omitida (E2E_SIN_LIMPIEZA)')
    return
  }
  const r = spawnSync(process.execPath, ['--env-file=.env.local', 'scripts/limpiar-optica-pruebas.mjs', '--ejecutar'], { encoding: 'utf8' })
  const salida = `${r.stdout || ''}${r.stderr || ''}`
  if (r.status !== 0 || !salida.includes('LIMPIADA (commit)')) {
    throw new Error(`No se pudo limpiar la óptica de pruebas antes de la corrida (se cancela para no probar sobre datos viejos):\n${salida.split('\n').slice(-8).join('\n')}`)
  }
  const resumen = salida.split('\n').find((l) => l.startsWith('Borrado en QA Test Claude')) || ''
  console.log(`[limpieza] óptica de pruebas limpiada. ${resumen.slice(0, 160)}`)
}
