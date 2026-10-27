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
// Aborta y revierte si: el id no es "QA Test Claude", o si LA LIMPIEZA cambia el conteo de filas de CUALQUIER otra óptica (se mide dentro de una
// transacción REPEATABLE READ: solo ve lo que borra esta misma limpieza, no lo que otras pruebas escriban a la vez, por ejemplo las visitas de la Demo);
// o si, mientras corre, cambia cualquier tabla (salvo `visitas`, el contador de la página pública) de una óptica REAL: todas menos la de pruebas, la Demo,
// la Vacía y la Ficticia, que las pruebas escriben a propósito (Solna Vision, Karla V y cualquier óptica nueva quedan protegidas).
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
const v = new pg.Client() // segunda conexión, sin transacción: ve en vivo lo que otros escriben mientras la limpieza corre
await v.connect()
const q = async (sql, p) => (await c.query(sql, p)).rows
// Ópticas que son de pruebas o que las pruebas escriben a propósito; cualquier otra se considera REAL y está protegida.
const NO_REALES = new Set([OPTICA_ID, "852d07ea-fafc-44a2-9566-5d28688da663" /* Demo */, "d4c574b1-378b-4dd9-929b-8ffcc65c2f22" /* Vacía */, "e712b468-654b-4306-942f-a71615bae4ed" /* Ficticia */])

// Conteos en vivo (sin transacción) de las ópticas reales, sin `visitas`.
async function conteosReales() {
  const tablas = (await v.query(`select c.table_name from information_schema.columns c join information_schema.tables t using (table_schema, table_name)
    where c.table_schema='public' and c.column_name='optica_id' and t.table_type='BASE TABLE' and c.table_name <> 'visitas' order by 1`)).rows.map((r) => r.table_name)
  const m = {}
  for (const t of tablas) for (const r of (await v.query(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)).rows) if (!NO_REALES.has(r.id)) m[`${t}|${r.id}`] = r.n
  return m
}

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
  const realesAntes = await conteosReales()
  await c.query("begin isolation level repeatable read")
  const { tablas, m: antes } = await conteos() // la foto de la transacción: después solo se compara lo que cambie esta limpieza
  // El kárdex (migración 0111) no se puede borrar ni editar: para limpiar la óptica de PRUEBAS se desactiva su protección solo dentro de esta transacción.
  const hayKardex = tablas.includes("movimientos_inventario")
  const hayActas = tablas.includes("conteos_inventario")
  if (hayKardex) await c.query("alter table public.movimientos_inventario disable trigger movimientos_inventario_inmutables")
  if (hayActas) await c.query("alter table public.conteos_inventario disable trigger conteos_inventario_inmutables")

  const borrados = {}
  // Paciente fijo del portal (16 oct. 2026): "E Dos E Portal Auditoria", con su cuenta de acceso, su compra con abono y su factura electrónica, que Diego pidió
  // dejar en la óptica de pruebas para las pruebas del portal. No se borra a él ni lo suyo (citas, fichas, comprobantes, abonos y facturas electrónicas).
  const fijo = (await q("select id from public.pacientes_base where optica_id = $1 and nombre = $2", [OPTICA_ID, "E Dos E Portal Auditoria"]))[0]?.id || null
  const colsDe = async (t) => (await q("select column_name from information_schema.columns where table_schema = 'public' and table_name = $1", [t])).map((r) => r.column_name)
  const borrar = async (t) => {
    let cond = "optica_id = $1"
    const params = [OPTICA_ID]
    if (fijo) {
      const cols = await colsDe(t)
      if (t === "pacientes_base") { cond += " and id <> $2"; params.push(fijo) }
      else if (cols.includes("paciente_id")) { cond += " and paciente_id is distinct from $2"; params.push(fijo) }
      else if (cols.includes("factura_id")) { cond += " and factura_id not in (select id from public.facturas_venta where paciente_id = $2)"; params.push(fijo) }
    }
    const r = await c.query(`delete from public.${t} where ${cond}`, params)
    if (r.rowCount) borrados[t] = r.rowCount
  }
  for (const t of ORDEN) if (tablas.includes(t)) await borrar(t)
  // Del paciente fijo se conserva SU comprobante (el de menor número: el CV-0006 con su abono y su factura electrónica). Lo demás que una prueba le haya dejado (por ejemplo una venta de $30 de
  // «pago por transferencia» cuya prueba se cortó antes de limpiar) se quita aquí, con todo lo que cuelga de esas facturas, para que las pruebas del portal siempre partan del mismo saldo.
  // Los avisos y solicitudes que el portal le deja (cambio de contacto, medidas pedidas) se acumulaban entre corridas y hacían fallar las pruebas que los cuentan.
  if (fijo) for (const t of ["avisos_contacto_paciente", "solicitudes_medidas"]) if (tablas.includes(t)) { const r = await c.query(`delete from public.${t} where paciente_id = $1`, [fijo]); if (r.rowCount) borrados[t] = r.rowCount }
  if (fijo) {
    const sobrantes = (await q("select id from public.facturas_venta where paciente_id = $1 and numero <> (select min(numero) from public.facturas_venta where paciente_id = $1)", [fijo])).map((r) => r.id)
    if (sobrantes.length) {
      const hijas = await q("select conrelid::regclass::text t, a.attname col from pg_constraint k join pg_attribute a on a.attrelid = k.conrelid and a.attnum = k.conkey[1] where k.contype = 'f' and k.confrelid = 'public.facturas_venta'::regclass")
      for (const { t, col } of hijas) await c.query(`delete from ${t} where ${col} = any($1)`, [sobrantes])
      const r = await c.query("delete from public.facturas_venta where id = any($1)", [sobrantes])
      borrados.facturas_venta_del_paciente_fijo = r.rowCount
    }
  }
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
  // Con el paciente fijo, los contadores de comprobantes y órdenes NO se reinician: la numeración sigue donde iba (su CV-0006 no se repite).
  for (const t of fijo ? [] : tablas.filter((x) => x.startsWith("contador_"))) {
    const r = await c.query(`delete from public.${t} where optica_id = $1`, [OPTICA_ID]); if (r.rowCount) contadores.push(`${t} reiniciado`)
  }

  if (hayKardex) await c.query("alter table public.movimientos_inventario enable trigger movimientos_inventario_inmutables")
  if (hayActas) await c.query("alter table public.conteos_inventario enable trigger conteos_inventario_inmutables")
  const { m: despues } = await conteos()
  let ok = true
  for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
    const [t, id] = k.split("|")
    const d = (despues[k] || 0) - (antes[k] || 0)
    if (d !== 0 && id !== OPTICA_ID) { ok = false; console.log(`✘ CAMBIÓ otra óptica: ${t} (${id}) ${d}`) }
    if (d > 0) { ok = false; console.log(`✘ ${t} aumentó`) }
  }
  const realesDespues = await conteosReales()
  for (const k of new Set([...Object.keys(realesAntes), ...Object.keys(realesDespues)])) {
    const d = (realesDespues[k] || 0) - (realesAntes[k] || 0)
    if (d !== 0) { ok = false; const [t, id] = k.split("|"); console.log(`✘ CAMBIÓ una óptica real mientras corría la limpieza: ${t} (${id}) ${d}`) }
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
  await v.end()
}
