// Corrige en la Óptica Demo, y solo en ella, una cita que quedó "En atención" con fecha futura (Marco Vera Alcívar, 14 oct. 2026): una cita de
// un día que todavía no llega no puede estar en atención; vuelve a "Pendiente". (El hueco por el que pudo quedar así ya está cerrado en la aplicación.)
//
//   node --env-file=.env.local scripts/corregir-cita-futura-demo.mjs              → ENSAYO (transacción que se revierte)
//   node --env-file=.env.local scripts/corregir-cita-futura-demo.mjs --ejecutar   → lo corrige
//
// Aborta y revierte si el id no es la Óptica Demo, si no es exactamente esa cita, o si cambia cualquier otra cosa.
import pg from "pg"

const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const CITA_ID = "b194edf1-ca90-4c92-a2ec-74a0544c3a7d"
const EJECUTAR = process.argv.includes("--ejecutar")
const c = new pg.Client()
await c.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows

async function conteos() {
  const tablas = (await q(`select c.table_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
    where c.table_schema='public' and c.column_name='optica_id' and t.table_type='BASE TABLE' order by 1`)).map((r) => r.table_name)
  const m = {}
  for (const t of tablas) for (const r of await q(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)) m[`${t}|${r.id}`] = r.n
  return m
}

try {
  const o = (await q("select nombre from opticas where id = $1", [DEMO_ID]))[0]
  if (!o || o.nombre !== "Óptica Demo") throw new Error("El id no corresponde a la Óptica Demo: se aborta.")
  const antes = await conteos()
  const futuras = await q(`select id::text, paciente, fecha::text, hora, estado from citas_base where optica_id = $1 and estado = 'En Atención' and fecha > (now() at time zone 'America/Guayaquil')::date`, [DEMO_ID])
  console.table(futuras)
  if (futuras.length !== 1 || futuras[0].id !== CITA_ID) throw new Error("Se esperaba exactamente la cita de Marco Vera Alcívar como única 'En atención' con fecha futura: se aborta.")
  await c.query("begin")
  const r = await c.query(`update citas_base set estado = 'Pendiente' where id = $1 and optica_id = $2 and estado = 'En Atención' returning paciente, fecha::text, hora, estado`, [CITA_ID, DEMO_ID])
  console.table(r.rows)
  const despues = await conteos()
  let ok = r.rowCount === 1
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) if ((despues[k] || 0) !== (antes[k] || 0)) { ok = false; console.log("✘ cambió el conteo de", k) }
  const [{ n: quedan }] = await q(`select count(*)::int n from citas_base where estado = 'En Atención' and fecha > (now() at time zone 'America/Guayaquil')::date`)
  console.log(`Citas corregidas: ${r.rowCount}; quedan "En atención" con fecha futura (en todas las ópticas): ${quedan}`)
  if (!ok || quedan !== 0) throw new Error("Falló una comprobación: se revierte todo.")
  if (EJECUTAR) { await c.query("commit"); console.log("\n✓ CORREGIDA (commit).") }
  else { await c.query("rollback"); console.log("\n✓ ENSAYO correcto (revertido). Para corregirla: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("\n✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
