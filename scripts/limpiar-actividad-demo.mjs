// Borra de la Óptica Demo, y solo de ella, los registros de actividad (logs_optica) que no son de una persona real:
//   * los que escribieron mis scripts de mantenimiento (usuario "Sistema": "limpieza de la Demo" y similares);
//   * los restos de las pruebas automáticas (productos "E2E Montura…", "E2E ausencia de prueba", la usuaria "…Demo Prueba").
// Regla 40: el registro de actividad es para personas; los scripts y las pruebas no escriben ahí.
//
//   node --env-file=.env.local scripts/limpiar-actividad-demo.mjs              → ENSAYO (transacción que se revierte)
//   node --env-file=.env.local scripts/limpiar-actividad-demo.mjs --ejecutar   → lo borra
//
// Aborta y revierte si el id no es la Óptica Demo, si no son exactamente las 18 filas aprobadas, o si cambia el conteo de filas de
// cualquier otra óptica (o de cualquier otra tabla de la Demo).
import pg from "pg"

const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const ESPERADAS = 18 // 3 de "Sistema" + 15 restos de pruebas (revisadas una por una el 10 oct. 2026)
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

const CONDICION = `optica_id = $1 and (
  usuario_nombre = 'Sistema'
  or detalle like 'E2E %' or detalle like '%· E2E %'
  or detalle like '%Rosa Recepción Demo Prueba%'
)`

try {
  const o = (await q("select nombre from opticas where id = $1", [DEMO_ID]))[0]
  if (!o || o.nombre !== "Óptica Demo") throw new Error("El id no corresponde a la Óptica Demo: se aborta.")
  const antes = await conteos()
  await c.query("begin")

  const filas = (await c.query(`delete from logs_optica where ${CONDICION} returning usuario_nombre, modulo, accion, left(coalesce(detalle, ''), 90) detalle`, [DEMO_ID])).rows
  console.table(filas)
  const despues = await conteos()

  let ok = filas.length === ESPERADAS
  if (!ok) console.log(`✘ se esperaban ${ESPERADAS} filas y la condición toca ${filas.length}`)
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const [t, id] = k.split("|")
    const d = (despues[k] || 0) - (antes[k] || 0)
    if (d === 0) continue
    if (id === DEMO_ID && t === "logs_optica" && d === -ESPERADAS) continue
    ok = false
    console.log(`✘ cambió ${t} (${id}) ${d}`)
  }
  const [{ n: quedan }] = await q(`select count(*)::int n from logs_optica where ${CONDICION}`, [DEMO_ID])
  const [{ n: total }] = await q("select count(*)::int n from logs_optica where optica_id = $1", [DEMO_ID])
  console.log(`Registros borrados: ${filas.length}; quedan con ese criterio: ${quedan}; quedan en la Demo: ${total}`)
  console.log("Otras ópticas y otras tablas:", ok ? "sin ningún cambio ✓" : "¡problema!")
  if (!ok || quedan !== 0) throw new Error("Falló una comprobación: se revierte todo.")
  if (EJECUTAR) { await c.query("commit"); console.log("\n✓ BORRADO (commit).") }
  else { await c.query("rollback"); console.log("\n✓ ENSAYO correcto (revertido). Para borrar: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("\n✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
