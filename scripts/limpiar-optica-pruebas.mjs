// Deja la óptica de pruebas ("QA Test Claude") sin datos de uso, conservando su administrador y sus roles.
//
//   node --env-file=.env.local scripts/limpiar-optica-pruebas.mjs              → ENSAYO (transacción que se revierte)
//   node --env-file=.env.local scripts/limpiar-optica-pruebas.mjs --ejecutar   → lo borra de verdad
//
// Borra, solo en esa óptica: pacientes, citas, fichas, ventas (comprobantes, líneas, abonos), órdenes de laboratorio, pases,
// inventario, avisos, mensajes, encuestas, registros de actividad y de visitas, y reinicia sus contadores de numeración.
// Conserva: la óptica, sus perfiles (administrador y cuentas), sus roles y asignaciones, el registro de auditoría del superadmin
// y su configuración (horario y duración de citas se ajustan con scripts/configurar-optica-pruebas.mjs).
//
// Aborta y revierte si: el id no es "QA Test Claude", o cambia el conteo de filas de CUALQUIER otra óptica.
import pg from "pg"

const OPTICA_ID = "dc6956ab-a507-4905-a122-47680c6d3b6d"
const NOMBRE = "QA Test Claude"
const EJECUTAR = process.argv.includes("--ejecutar")
// No se vacían: identidad, permisos y auditoría de la óptica.
const CONSERVAR = new Set(["perfiles", "roles", "perfil_roles", "auditoria", "disponibilidad", "horarios_usuario"])
// Orden seguro respecto a llaves foráneas (lo que cuelga primero); lo demás se barre después.
const ORDEN = ["ordenes_laboratorio", "pases_a_venta", "facturas_venta", "ventas", "consultas_base", "citas_base", "pacientes_base"]

const c = new pg.Client()
await c.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows

async function conteos() {
  const tablas = (await q(`select c.table_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
    where c.table_schema='public' and c.column_name='optica_id' and t.table_type='BASE TABLE' order by 1`)).map((r) => r.table_name)
  const m = {}
  for (const t of tablas) for (const r of await q(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)) m[`${t}|${r.id}`] = r.n
  return { tablas, m }
}

try {
  const o = (await q("select nombre from opticas where id = $1", [OPTICA_ID]))[0]
  if (!o || o.nombre !== NOMBRE) throw new Error(`El id no corresponde a "${NOMBRE}": se aborta.`)
  const { tablas, m: antes } = await conteos()
  await c.query("begin")

  const borrados = {}
  const borrar = async (t) => { const r = await c.query(`delete from public.${t} where optica_id = $1`, [OPTICA_ID]); if (r.rowCount) borrados[t] = r.rowCount }
  for (const t of ORDEN) if (tablas.includes(t)) await borrar(t)
  for (const t of tablas) if (!ORDEN.includes(t) && !CONSERVAR.has(t) && !t.startsWith("contador_")) await borrar(t)
  const contadores = []
  for (const t of tablas.filter((x) => x.startsWith("contador_"))) {
    const r = await c.query(`delete from public.${t} where optica_id = $1`, [OPTICA_ID]); if (r.rowCount) contadores.push(`${t} reiniciado`)
  }

  const { m: despues } = await conteos()
  let ok = true
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const [t, id] = k.split("|")
    const d = (despues[k] || 0) - (antes[k] || 0)
    if (d !== 0 && id !== OPTICA_ID) { ok = false; console.log(`✘ CAMBIÓ otra óptica: ${t} (${id}) ${d}`) }
    if (d > 0) { ok = false; console.log(`✘ ${t} aumentó`) }
  }
  const quedan = Object.entries(despues).filter(([k, n]) => k.endsWith(OPTICA_ID) && n > 0).map(([k, n]) => `${k.split("|")[0]}: ${n}`)
  const adminSigue = (await q("select count(*)::int n from perfiles where optica_id = $1 and rol = 'admin' and activo", [OPTICA_ID]))[0].n
  if (adminSigue < 1) { ok = false; console.log("✘ el administrador ya no existe") }

  console.log("Borrado en QA Test Claude:", JSON.stringify(borrados))
  console.log("Contadores:", contadores.join("; ") || "ninguno")
  console.log("Quedan (se conservan a propósito):", quedan.join("; "))
  console.log("Otras ópticas:", ok ? "sin ningún cambio ✓" : "¡problema!")
  if (!ok) throw new Error("Falló una comprobación: se revierte todo.")
  if (EJECUTAR) { await c.query("commit"); console.log("\n✓ LIMPIADA (commit).") }
  else { await c.query("rollback"); console.log("\n✓ ENSAYO correcto (revertido). Para limpiar: --ejecutar") }
} catch (e) {
  await c.query("rollback").catch(() => {})
  console.error("\n✘ " + e.message + "\nRevertido: no se cambió nada.")
  process.exitCode = 1
} finally {
  await c.end()
}
