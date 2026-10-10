// Corre las pruebas unitarias en varias zonas horarias y a varias horas del día, para comprobar que ninguna depende de ellas.
// "Ahora" se fija con HORA_SIMULADA (src/test-reloj.js); la zona del equipo, con TZ. Las horas de Ecuador (UTC-5) que más fallan son las
// de la noche (19:00 a 24:00), cuando en UTC ya es el día siguiente.
//   node scripts/probar-zonas-y-horas.mjs [archivo-o-filtro-de-vitest]
import { spawnSync } from 'node:child_process'

const ZONAS = ['UTC', 'America/Guayaquil']
const HORAS = [
  [null, 'hora real'],
  ['2026-10-09T12:00:00Z', '07:00 en Ecuador'],
  ['2026-10-10T00:30:00Z', '19:30 en Ecuador'],
  ['2026-10-10T04:25:00Z', '23:25 en Ecuador (la hora en que falló el CI)'],
  ['2026-10-10T04:59:00Z', '23:59 en Ecuador'],
  ['2026-10-09T05:10:00Z', '00:10 en Ecuador'],
]
const filtro = process.argv.slice(2)
let fallos = 0
for (const tz of ZONAS) {
  for (const [hora, nombre] of HORAS) {
    const env = { ...process.env, TZ: tz }
    if (hora) env.HORA_SIMULADA = hora
    else delete env.HORA_SIMULADA
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['vitest', 'run', ...filtro], { env, encoding: 'utf8', shell: process.platform === 'win32' })
    const salida = (r.stdout || '') + (r.stderr || '')
    const resumen = (salida.match(/Tests\s+[^\n]*/) || ['(sin resumen)'])[0].replace(/\x1b\[[0-9;]*m/g, '').trim()
    const ok = r.status === 0
    if (!ok) fallos++
    console.log(`${ok ? '✔' : '✘'} TZ=${tz} · ${nombre}: ${resumen}`)
    if (!ok) console.log((salida.match(/FAIL[^\n]*/g) || []).slice(0, 8).map((l) => '    ' + l.replace(/\x1b\[[0-9;]*m/g, '')).join('\n'))
  }
}
console.log(fallos === 0 ? '\nNinguna prueba depende de la zona ni de la hora.' : `\n${fallos} combinación(es) con fallos.`)
process.exit(fallos ? 1 : 0)
