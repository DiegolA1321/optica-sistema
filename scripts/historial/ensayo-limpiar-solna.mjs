// Ensayo (o aplicación) de limpiar-solna-propuesta.sql.
//   node --env-file=.env.local scripts/historial/ensayo-limpiar-solna.mjs              → ENSAYO: dentro de una transacción que SIEMPRE se revierte
//   node --env-file=.env.local scripts/historial/ensayo-limpiar-solna.mjs --aplicar    → el mismo SQL y las mismas comprobaciones, pero CONFIRMA (commit) si todo pasa
// Comprueba que (1) ninguna otra óptica cambió, (2) lo que debe conservarse sigue igual, (3) Solna quedó sin datos ni usuarios de prueba, y (4) el superadmin puede crear el administrador de una óptica
// que se quedó sin usuarios: se simula en la misma transacción (cuenta + perfil de administrador, como hace el panel) y se comprueba con sesión de ese usuario que recibe su rol y puede ingresar.
import pg from "pg"
import fs from "node:fs"

const OPTICA = "b6eb867a-6b08-42c6-b493-27d139bed64e"
const APLICAR = process.argv.includes("--aplicar")
const sql = fs.readFileSync(new URL("./limpiar-solna-propuesta.sql", import.meta.url), "utf8").replace(/^begin;$/m, "").replace(/^rollback;$/m, "")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const tablas = (await q(`select c.table_name t from information_schema.columns c join information_schema.tables x using (table_schema, table_name)
  where c.table_schema = 'public' and c.column_name = 'optica_id' and x.table_type = 'BASE TABLE' order by 1`)).map((r) => r.t)
const conteos = async () => {
  const m = {}
  for (const t of tablas) for (const r of await q(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)) m[`${t}|${r.id}`] = r.n
  return m
}
const opticaFila = async () => JSON.stringify(await q("select nombre, slug, logo_url, settings, marca, motivos_consulta, diagnosticos_rapidos, categorias_inventario, datos_bancarios, activa, estado_pago from opticas where id = $1", [OPTICA]))
const otrasAuth = async () => (await q("select count(*)::int n from auth.users u where u.email <> 'secretaria.qa.prueba@opticasolna.test' and not exists (select 1 from perfiles p where p.id = u.id and p.optica_id = $1)", [OPTICA]))[0].n
const rolesFila = async () => JSON.stringify(await q("select clave, nombre, permisos, alcance, atiende_pacientes, inicio from roles where optica_id = $1 and es_predefinido order by clave", [OPTICA]))
const dispFila = async () => JSON.stringify(await q("select horario_semanal, excepciones, duracion_cita from disponibilidad where optica_id = $1", [OPTICA]))

const antes = await conteos()
const fila0 = await opticaFila(), roles0 = await rolesFila(), disp0 = await dispFila(), auth0 = await otrasAuth()
const usuarios0 = (await q("select count(*)::int n from auth.users u join perfiles p on p.id = u.id where p.optica_id = $1", [OPTICA]))[0].n
let confirmar = false
try {
  await c.query("begin")
  await c.query(sql)
  const despues = await conteos()
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)])
  const otras = [...claves].filter((k) => !k.endsWith(OPTICA) && (antes[k] || 0) !== (despues[k] || 0))
  ok(otras.length === 0, "ninguna otra óptica cambió" + (otras.length ? ": " + otras.join(", ") : ""))
  ok((await otrasAuth()) === auth0, `las cuentas de ingreso de las demás ópticas siguen todas (${auth0})`)
  const borrado = {}, quedan = {}
  for (const t of tablas) {
    const a = antes[`${t}|${OPTICA}`] || 0, d = despues[`${t}|${OPTICA}`] || 0
    if (a !== d) borrado[t] = `${a} → ${d}`
    if (d > 0) quedan[t] = d
  }
  console.log("\nBorrado en Solna:", JSON.stringify(borrado, null, 1))
  console.log("Queda en Solna (tablas con filas):", JSON.stringify(quedan))
  ok(JSON.stringify(quedan) === JSON.stringify({ auditoria: 7, disponibilidad: 1, roles: 3 }), "Solna solo conserva: auditoría (7), horario de la óptica (1) y los 3 roles predefinidos")
  ok((despues[`auditoria|${OPTICA}`] || 0) === 7, "la auditoría del superadmin se conserva (7)")
  ok(usuarios0 === 2 && (await q("select count(*)::int n from auth.users u where u.email = 'secretaria.qa.prueba@opticasolna.test'"))[0].n === 0, `sin usuarios de prueba: las ${usuarios0} cuentas con perfil y la huérfana se borraron`)
  ok((despues[`perfiles|${OPTICA}`] || 0) === 0, "perfiles de Solna: 0")
  for (const t of ["pacientes_base", "citas_base", "consultas_base", "facturas_venta", "abonos_factura", "ordenes_laboratorio", "pases_a_venta", "citas_eventos", "logs_optica", "visitas", "inventario", "movimientos_inventario", "horarios_usuario", "contador_comprobantes_venta", "contador_ordenes_laboratorio"]) ok((despues[`${t}|${OPTICA}`] || 0) === 0, `${t}: queda vacía`)
  ok((await q("select count(*)::int n from facturas_venta_lineas l where l.factura_id in (select id from facturas_venta where optica_id = $1)", [OPTICA]))[0].n === 0, "sin líneas de factura huérfanas")
  ok((await q("select count(*)::int n from inventario_costos where producto_id in (select id from inventario where optica_id = $1)", [OPTICA]))[0].n === 0, "sin costos de producto huérfanos")
  ok((await opticaFila()) === fila0, "la fila de la óptica (datos, página pública, color, ajustes, catálogos) no cambió")
  ok((await rolesFila()) === roles0, "los roles predefinidos conservan sus permisos y alcances")
  ok((await dispFila()) === disp0, "el horario de la óptica no cambió")
  const trg = await q("select tgname, tgenabled from pg_trigger where tgname in ('movimientos_inventario_inmutables', 'conteos_inventario_inmutables') order by 1")
  ok(trg.length === 2 && trg.every((t) => t.tgenabled === "O"), "las protecciones de inmutabilidad del kárdex y de las actas quedaron activas otra vez")

  // ── El superadmin puede crear el administrador de una óptica sin usuarios ──
  // Como hace el panel: una cuenta de ingreso y un perfil de administrador en esa óptica (el panel inserta el perfil con la sesión del superadmin).
  const nuevoId = "00000000-0000-4000-8000-0000000a0001"
  await c.query("insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at) values ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin.nuevo.ensayo@example.invalid', 'x', now(), now(), now())", [nuevoId])
  await c.query("insert into perfiles (id, optica_id, rol, nombre, cedula, email) values ($1, $2, 'admin', 'Administrador Nuevo Ensayo', '0914760947', 'admin.nuevo.ensayo@example.invalid')", [nuevoId, OPTICA])
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: nuevoId, role: "authenticated" })])
  const permisos = (await q("select public.mis_permisos() as p"))[0].p
  ok(permisos && JSON.stringify(permisos).length > 20, "el administrador nuevo recibe sus permisos al ingresar (mis_permisos): " + JSON.stringify(permisos).slice(0, 110))
  ok((await q("select public.soy_administrador_principal() as v"))[0].v === true, "queda como administrador principal de la óptica")
  ok((await q("select count(*)::int n from public.equipo_optica()"))[0].n === 1, "ve a su equipo (él solo)")
  ok((await q("select count(*)::int n from public.roles"))[0].n === 3, "ve los 3 roles predefinidos de su óptica")
  ok((await q("select count(*)::int n from public.opticas where id = $1", [OPTICA]))[0].n === 1, "ve los datos de su óptica")
  ok((await q("select count(*)::int n from public.inventario"))[0].n === 0, "su inventario empieza en cero")
  await c.query("reset role")
  await c.query("delete from auth.users where id = $1", [nuevoId]) // (se revierte de todos modos)
  if (APLICAR && fallos === 0) { confirmar = true }
} catch (e) {
  console.log("✘ ERROR:", e.message); fallos++
} finally {
  if (confirmar) {
    await c.query("commit")
    console.log("\n✔ APLICADO (commit)")
  } else {
    await c.query("rollback").catch(() => {})
    const fin = await conteos()
    ok(JSON.stringify(fin) === JSON.stringify(antes) && (await otrasAuth()) === auth0 && (await opticaFila()) === fila0, "revertido: todo quedó exactamente como estaba")
  }
  await c.end()
}
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : confirmar ? "\nTodo ✔ y aplicado" : "\nTodo ✔ (nada aplicado)")
process.exit(fallos ? 1 : 0)
