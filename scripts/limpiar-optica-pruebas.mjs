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
// Días que las pruebas de e2e/abrir-dia-cerrado.spec.js abren o cierran (domingo 20 y lunes 21 de diciembre de 2026).
const DIAS_DE_PRUEBA = ["2026-12-20", "2026-12-21"]
// Orden seguro respecto a llaves foráneas (lo que cuelga primero); lo demás se barre después.
const ORDEN = ["movimientos_inventario", "ordenes_laboratorio", "pases_a_venta", "facturas_venta", "ventas", "consultas_base", "citas_base", "pacientes_base"]

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
  // El kárdex (migración 0111) no se puede borrar ni editar: para limpiar la óptica de PRUEBAS se desactiva su protección solo dentro de esta transacción.
  const hayKardex = tablas.includes("movimientos_inventario")
  if (hayKardex) await c.query("alter table public.movimientos_inventario disable trigger movimientos_inventario_inmutables")

  const borrados = {}
  const borrar = async (t) => { const r = await c.query(`delete from public.${t} where optica_id = $1`, [OPTICA_ID]); if (r.rowCount) borrados[t] = r.rowCount }
  for (const t of ORDEN) if (tablas.includes(t)) await borrar(t)
  for (const t of tablas) if (!ORDEN.includes(t) && !CONSERVAR.has(t) && !t.startsWith("contador_")) await borrar(t)
  // Los catálogos (motivos, diagnósticos, categorías) viven en la fila de la óptica: lo que una prueba agregó con el prefijo "E2E " y no alcanzó a quitar,
  // se quita aquí. Solo en la óptica de pruebas (el id está fijo arriba).
  for (const col of ["motivos_consulta", "diagnosticos_rapidos", "categorias_inventario"]) {
    const r = await c.query(`update public.opticas set ${col} = array(select x from unnest(${col}) as x where x not like 'E2E %') where id = $1 and exists (select 1 from unnest(${col}) as y where y like 'E2E %')`, [OPTICA_ID])
    if (r.rowCount) borrados[`catálogo ${col}`] = r.rowCount
  }
  // Excepciones de horario que dejan las pruebas si se interrumpen (un corte, un fallo): los días que usa abrir-dia-cerrado.spec.js y las
  // ausencias con motivo "E2E ". La tabla `disponibilidad` se conserva (es el horario de la óptica); solo se quitan esas claves.
  const quitadas = []
  const fila = (await q("select excepciones from public.disponibilidad where optica_id = $1", [OPTICA_ID]))[0]
  if (fila?.excepciones) {
    const exc = { ...fila.excepciones }
    for (const dia of DIAS_DE_PRUEBA) if (dia in exc) { delete exc[dia]; quitadas.push(`día ${dia}`) }
    for (const [dia, e] of Object.entries(exc)) {
      const sobran = (e?.ausencias || []).filter((a) => String(a?.motivo || "").startsWith("E2E "))
      if (!sobran.length) continue
      exc[dia] = { ...e, ausencias: e.ausencias.filter((a) => !sobran.includes(a)) }
      quitadas.push(`${sobran.length} ausencia(s) de ${dia}`)
    }
    if (quitadas.length) await c.query("update public.disponibilidad set excepciones = $2 where optica_id = $1", [OPTICA_ID, JSON.stringify(exc)])
  }
  if (quitadas.length) borrados["excepciones de horario"] = quitadas.join(", ")
  const contadores = []
  for (const t of tablas.filter((x) => x.startsWith("contador_"))) {
    const r = await c.query(`delete from public.${t} where optica_id = $1`, [OPTICA_ID]); if (r.rowCount) contadores.push(`${t} reiniciado`)
  }

  if (hayKardex) await c.query("alter table public.movimientos_inventario enable trigger movimientos_inventario_inmutables")
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
