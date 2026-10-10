// Quita "E2E Motivo f9jv2", el residuo de una prueba del 7 oct 2026, del catálogo de motivos de consulta de la Óptica Demo.
// Protocolo: respaldo hecho antes (pre-motivo-demo-2026-10-10.dump). Primero ENSAYO (rollback) y, si sale bien, se aplica.
//   node --env-file=.env.local scripts/quitar-motivo-de-prueba-demo.mjs            → solo ensayo
//   node --env-file=.env.local scripts/quitar-motivo-de-prueba-demo.mjs --aplicar  → ensayo y luego lo aplica
// Se niega a hacer nada si el motivo lo usa alguna cita (no se pierde ningún dato real).
import pg from "pg"
const DEMO = "852d07ea-fafc-44a2-9566-5d28688da663"
const MOTIVO = "E2E Motivo f9jv2"
const aplicar = process.argv.includes("--aplicar")
const c = new pg.Client()
await c.connect()
try {
  await c.query("begin")
  const antes = (await c.query("select motivos_consulta from opticas where id=$1", [DEMO])).rows[0].motivos_consulta
  console.log("ANTES:", JSON.stringify(antes))
  if (!antes.includes(MOTIVO)) { console.log("El motivo ya no está: no hay nada que hacer."); await c.query("rollback"); process.exit(0) }
  const usadas = (await c.query("select count(*)::int n from citas where optica_id=$1 and motivo=$2", [DEMO, MOTIVO])).rows[0].n
  const enConsultas = (await c.query("select count(*)::int n from consultas where optica_id=$1 and motivo=$2", [DEMO, MOTIVO])).rows[0].n
  console.log(`citas que lo usan: ${usadas} · consultas que lo usan: ${enConsultas}`)
  if (usadas > 0 || enConsultas > 0) throw new Error("El motivo está en uso: no se borra.")
  const r = await c.query("update opticas set motivos_consulta = array_remove(motivos_consulta, $2) where id=$1 returning motivos_consulta", [DEMO, MOTIVO])
  console.log("DESPUÉS (dentro de la transacción):", JSON.stringify(r.rows[0].motivos_consulta), "· filas:", r.rowCount)
  const otros = (await c.query("select count(*)::int n from opticas where id <> $1 and motivos_consulta @> array[$2]::text[]", [DEMO, MOTIVO])).rows[0].n
  console.log("otras ópticas con ese motivo:", otros)
  if (aplicar) { await c.query("commit"); console.log("APLICADO.") } else { await c.query("rollback"); console.log("ENSAYO terminado con rollback: nada cambió.") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("Error:", e.message)
  process.exitCode = 1
} finally {
  const ahora = (await c.query("select motivos_consulta from opticas where id=$1", [DEMO])).rows[0].motivos_consulta
  console.log("Estado actual de la Demo:", JSON.stringify(ahora))
  await c.end()
}
