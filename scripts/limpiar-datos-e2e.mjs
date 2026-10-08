// Borra de la Óptica Demo los datos que crearon las pruebas de Playwright, y solo esos.
//
//   node --env-file=.env.local scripts/limpiar-datos-e2e.mjs              → ENSAYO: hace todo en una transacción y la revierte.
//   node --env-file=.env.local scripts/limpiar-datos-e2e.mjs --ejecutar   → lo borra de verdad (commit).
//
// Qué es "dato de prueba": los pacientes de la Óptica Demo cuyo nombre empieza por "E Dos E " o "EE Prueba" (las pruebas
// no pueden escribir dígitos en el nombre, así que "E2E" va en letras), más todo lo que cuelga de ellos:
//   citas, consultas (fichas), pases a venta, ventas (comprobantes con sus líneas y abonos), órdenes de laboratorio (con su
//   historial), encuestas de esas citas y solicitudes de eliminación. Además, las citas de prueba sueltas (sin paciente
//   vinculado pero con ese nombre en la cita).
// Qué NO toca: ningún dato de demostración, ninguna otra óptica, usuarios, roles, configuración, mensajes ni registros
// de actividad (los cuenta y los muestra aparte, para decidir).
//
// Garantías (el script aborta y revierte si alguna falla):
//   * Solo opera sobre la Óptica Demo (id fijo, comprobado por nombre).
//   * Cada tabla con optica_id cambia únicamente por lo que se borró a propósito; en CUALQUIER otra óptica el conteo de filas
//     es idéntico antes y después.
//   * Los datos de demostración (todo lo que no cuelga de un paciente de prueba) conservan el mismo conteo.
//   * Los contadores de numeración (órdenes OL-, comprobantes CV-) vuelven al mayor número que sigue existiendo.
import pg from "pg"

const DEMO_ID = "852d07ea-fafc-44a2-9566-5d28688da663"
const EJECUTAR = process.argv.includes("--ejecutar")
const FILTRO_PACIENTE = `optica_id = $1 AND (nombre LIKE 'E Dos E %' OR nombre LIKE 'EE Prueba%')`

const c = new pg.Client()
await c.connect()

const q = async (sql, params) => (await c.query(sql, params)).rows
const un = async (sql, params) => Object.values((await q(sql, params))[0] || {})[0]

// Conteo por tabla con optica_id y por óptica (para comprobar que nada más cambió).
async function conteos() {
  const tablas = (await q(`select c.table_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
    where c.table_schema='public' and c.column_name='optica_id' and t.table_type='BASE TABLE' order by 1`)).map((r) => r.table_name)
  const mapa = {}
  for (const t of tablas) {
    for (const r of await q(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)) mapa[`${t}|${r.id}`] = r.n
  }
  return mapa
}

let ok = true
const falla = (m) => { ok = false; console.log("✘", m) }

try {
  const demo = (await q("select nombre from opticas where id = $1", [DEMO_ID]))[0]
  if (!demo || demo.nombre !== "Óptica Demo") throw new Error("El id fijo no corresponde a la Óptica Demo: se aborta.")

  const antes = await conteos()
  await c.query("begin")

  const idsPac = (await q(`select id from pacientes_base where ${FILTRO_PACIENTE}`, [DEMO_ID])).map((r) => r.id)
  const nombresPac = (await q(`select nombre from pacientes_base where ${FILTRO_PACIENTE}`, [DEMO_ID])).map((r) => r.nombre)
  console.log(`Pacientes de prueba en la Óptica Demo: ${idsPac.length}`)
  if (idsPac.length === 0) { console.log("Nada que borrar."); await c.query("rollback"); await c.end(); process.exit(0) }

  // Registros de actividad que mencionan a estos pacientes (solo se cuentan).
  const logsMencionan = await un(`select count(*)::int from logs_optica where optica_id = $1 and (${nombresPac.map((_, i) => `detalle ilike '%' || $${i + 2} || '%'`).join(" or ")})`, [DEMO_ID, ...nombresPac]).catch(() => "n/d")
  const mensajesE2E = await un(`select count(*)::int from mensajes where optica_id = $1 and (asunto like 'E2E %' or cuerpo like 'E2E %')`, [DEMO_ID])

  const borrados = {}
  const borrar = async (nombre, sql, params) => { const r = await c.query(sql, params); borrados[nombre] = r.rowCount }

  // Orden: lo que cuelga primero; los ON DELETE CASCADE se llevan hijos (líneas, abonos, historial, encuestas).
  await borrar("ordenes_laboratorio", `delete from ordenes_laboratorio where optica_id = $1 and paciente_id = any($2)`, [DEMO_ID, idsPac])
  await borrar("pases_a_venta", `delete from pases_a_venta where optica_id = $1 and (paciente_id = any($2) or consulta_id in (select id from consultas_base where paciente_id = any($2)))`, [DEMO_ID, idsPac])
  await borrar("facturas_venta (con líneas y abonos)", `delete from facturas_venta where optica_id = $1 and paciente_id = any($2)`, [DEMO_ID, idsPac])
  await borrar("ventas (camino antiguo)", `delete from ventas where optica_id = $1 and paciente_id = any($2)`, [DEMO_ID, idsPac]).catch(() => {})
  await borrar("consultas (fichas)", `delete from consultas_base where optica_id = $1 and paciente_id = any($2)`, [DEMO_ID, idsPac])
  await borrar("citas", `delete from citas_base where optica_id = $1 and (paciente_id = any($2) or paciente = any($3))`, [DEMO_ID, idsPac, nombresPac])
  await borrar("pacientes", `delete from pacientes_base where optica_id = $1 and id = any($2)`, [DEMO_ID, idsPac])

  // Numeración: que el siguiente número sea el siguiente al mayor que sigue existiendo.
  const contadores = []
  for (const [contador, tabla] of [["contador_ordenes_laboratorio", "ordenes_laboratorio"], ["contador_comprobantes_venta", "facturas_venta"]]) {
    const actual = await un(`select ultimo_numero from ${contador} where optica_id = $1`, [DEMO_ID])
    const mayor = (await un(`select coalesce(max(numero), 0) from ${tabla} where optica_id = $1`, [DEMO_ID])) ?? 0
    if (actual != null && actual > mayor) { await c.query(`update ${contador} set ultimo_numero = $2 where optica_id = $1`, [DEMO_ID, mayor]); contadores.push(`${contador}: ${actual} → ${mayor}`) }
  }

  const despues = await conteos()

  // ── Comprobaciones ──
  const tocadas = []
  for (const clave of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const [tabla, optica] = clave.split("|")
    const d = (despues[clave] || 0) - (antes[clave] || 0)
    if (d === 0) continue
    if (optica !== DEMO_ID) { falla(`CAMBIÓ otra óptica: ${tabla} (${optica}) ${d}`); continue }
    if (d > 0) falla(`${tabla} aumentó en la Demo (${d})`)
    tocadas.push(`${tabla}: ${-d}`)
  }
  const esperadas = ["pacientes_base", "citas_base", "consultas_base", "facturas_venta", "facturas_venta_lineas", "abonos_factura", "ordenes_laboratorio", "ordenes_laboratorio_historial", "pases_a_venta", "respuestas_satisfaccion", "ventas", "solicitudes_eliminacion_paciente"]
  for (const t of tocadas) if (!esperadas.includes(t.split(":")[0])) falla(`tabla inesperada modificada: ${t}`)
  const quedan = await un(`select count(*)::int from pacientes_base where ${FILTRO_PACIENTE}`, [DEMO_ID])
  if (quedan !== 0) falla(`quedan ${quedan} pacientes de prueba`)

  console.log("\nBorrado (por sentencia):")
  for (const [k, v] of Object.entries(borrados)) console.log(`  ${k.padEnd(40)} ${v}`)
  console.log("\nCambio de filas en la Demo, por tabla (comparado antes/después, incluye lo borrado en cascada):")
  for (const t of tocadas) console.log("  ", t)
  console.log("\nOtras ópticas: " + (Object.keys(antes).every((k) => k.endsWith(DEMO_ID) || antes[k] === despues[k]) ? "sin ningún cambio ✓" : "¡CAMBIARON!"))
  console.log("Contadores:", contadores.length ? contadores.join("; ") : "sin cambios")
  console.log(`\nNo se tocan (solo se cuentan): registros de actividad que mencionan a esos pacientes: ${logsMencionan}; mensajes de prueba («E2E …»): ${mensajesE2E}`)

  if (!ok) throw new Error("Falló una comprobación: se revierte todo.")
  if (EJECUTAR) { await c.query("commit"); console.log("\n✓ BORRADO (commit).") }
  else { await c.query("rollback"); console.log("\n✓ ENSAYO correcto (transacción revertida: no se borró nada). Para borrar: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("\n✘ " + e.message + "\nTransacción revertida: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
