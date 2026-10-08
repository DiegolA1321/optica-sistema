// Deja lista la configuración mínima de la óptica de pruebas ("QA Test Claude") para que corran las pruebas de Playwright:
// el horario de atención (sin él el calendario no ofrece ningún turno) y la duración de la cita, copiados de la Óptica Demo
// (solo se LEEN de ella). Si la óptica de pruebas ya tiene horario, no lo toca.
//
//   node --env-file=.env.local scripts/configurar-optica-pruebas.mjs              → ENSAYO (transacción que se revierte)
//   node --env-file=.env.local scripts/configurar-optica-pruebas.mjs --ejecutar   → lo escribe
//
// Aborta y revierte si el id no es "QA Test Claude" o si cambia el conteo de filas de cualquier otra óptica.
import pg from "pg"

const PRUEBAS = { id: "dc6956ab-a507-4905-a122-47680c6d3b6d", nombre: "QA Test Claude" }
const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const EJECUTAR = process.argv.includes("--ejecutar")

const c = new pg.Client()
await c.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows
const total = async () => (await q(`select optica_id::text id, count(*)::int n from public.disponibilidad group by 1 order by 1`)).map((r) => `${r.id}:${r.n}`).join(",")

try {
  const o = (await q("select nombre from opticas where id = $1", [PRUEBAS.id]))[0]
  if (!o || o.nombre !== PRUEBAS.nombre) throw new Error(`El id no corresponde a "${PRUEBAS.nombre}": se aborta.`)
  const demo = (await q("select horario_semanal, duracion_cita from disponibilidad where optica_id = $1", [DEMO_ID]))[0]
  if (!demo) throw new Error("La Óptica Demo no tiene horario para copiar.")
  const antes = await total()
  await c.query("begin")
  const ya = (await q("select 1 from disponibilidad where optica_id = $1", [PRUEBAS.id])).length > 0
  if (ya) console.log("Ya tiene horario: no se cambia.")
  else {
    await c.query("insert into disponibilidad (optica_id, horario_semanal, excepciones, duracion_cita) values ($1, $2, '{}'::jsonb, $3)", [PRUEBAS.id, demo.horario_semanal, demo.duracion_cita])
    console.log(`Horario copiado de la Demo (${demo.duracion_cita} min por cita), sin excepciones.`)
  }
  const despues = await total()
  const otras = (s) => s.split(",").filter((x) => x && !x.startsWith(PRUEBAS.id)).join(",")
  if (otras(antes) !== otras(despues)) throw new Error("Cambió el horario de otra óptica: se revierte.")
  if (EJECUTAR) { await c.query("commit"); console.log("✓ Configurada (commit).") }
  else { await c.query("rollback"); console.log("✓ ENSAYO correcto (revertido). Para aplicar: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
