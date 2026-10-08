// Borra de la Óptica Demo, y solo de ella, los restos de las pruebas que no colgaban de un paciente:
//   * mensajes cuyo asunto o cuerpo empieza por "E2E " (consultas de prueba enviadas al superadmin);
//   * registros de actividad (logs_optica) cuyo detalle nombra a un paciente de prueba ya borrado ("E Dos E …" o "EE Prueba…").
//
//   node --env-file=.env.local scripts/limpiar-actividad-e2e.mjs              → ENSAYO (transacción que se revierte)
//   node --env-file=.env.local scripts/limpiar-actividad-e2e.mjs --ejecutar   → lo borra
//
// Aborta y revierte si el id no es la Óptica Demo, si se borra algo que no cumpla el patrón, o si cambia el conteo de filas de
// cualquier otra óptica (o de cualquier otra tabla de la Demo).
import pg from "pg"

const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const EJECUTAR = process.argv.includes("--ejecutar")
const c = new pg.Client()
await c.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows
const un = async (sql, p) => Object.values((await q(sql, p))[0] || {})[0]

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
  await c.query("begin")

  const msg = await c.query(`delete from mensajes where optica_id = $1 and (asunto like 'E2E %' or cuerpo like 'E2E %') returning asunto`, [DEMO_ID])
  const logs = await c.query(`delete from logs_optica where optica_id = $1 and (detalle like '%E Dos E %' or detalle like '%EE Prueba%') returning detalle`, [DEMO_ID])
  const raros = logs.rows.filter((r) => !/E Dos E |EE Prueba/.test(r.detalle || "")).length + msg.rows.filter((r) => !/^E2E /.test(r.asunto || "")).length
  const despues = await conteos()

  let ok = raros === 0
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const [t, id] = k.split("|")
    const d = (despues[k] || 0) - (antes[k] || 0)
    if (d === 0) continue
    if (id === DEMO_ID && (t === "mensajes" || t === "logs_optica") && d < 0) continue
    ok = false
    console.log(`✘ cambió ${t} (${id}) ${d}`)
  }
  const restantes = await un(`select count(*)::int from logs_optica where optica_id = $1 and (detalle like '%E Dos E %' or detalle like '%EE Prueba%')`, [DEMO_ID])
  console.log(`Mensajes de prueba borrados: ${msg.rowCount}; registros de actividad borrados: ${logs.rowCount}; quedan con ese patrón: ${restantes}`)
  console.log("Otras ópticas y otras tablas:", ok ? "sin ningún cambio ✓" : "¡problema!")
  if (!ok || restantes !== 0) throw new Error("Falló una comprobación: se revierte todo.")
  if (EJECUTAR) { await c.query("commit"); console.log("\n✓ BORRADO (commit).") }
  else { await c.query("rollback"); console.log("\n✓ ENSAYO correcto (revertido). Para borrar: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("\n✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
