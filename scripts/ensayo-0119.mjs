// Ensayo de la migración 0119 (panel del superadmin v2): la aplica DENTRO de una transacción y prueba con sesiones reales
// (superadmin, administrador de una óptica, personal y sin sesión) que:
//   - las tres ópticas de prueba quedan marcadas y las demás no;
//   - solo el superadmin cambia `es_de_prueba` (el administrador de la óptica no puede);
//   - `datos_negocio_superadmin()` solo responde al superadmin y entrega personas y ópticas;
//   - la auditoría acepta las acciones nuevas, no se puede borrar ni editar, y la llave foránea sí puede ponerla en nulo.
// SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0119.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0119_superadmin_v2.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]
const como = async (uid, fn) => {
  await c.query("set local role " + (uid ? "authenticated" : "anon"))
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
  try { return await fn() } finally { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
}
const cruda = async (q, p = []) => {
  await c.query("savepoint r")
  try { await c.query(q, p); await c.query("release savepoint r"); return null } catch (e) { await c.query("rollback to savepoint r"); return e.message }
}
const falla = async (uid, q, p = []) => {
  await c.query("savepoint s")
  try {
    await c.query("set local role " + (uid ? "authenticated" : "anon"))
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
    await c.query(q, p)
    await c.query("reset role"); await c.query("release savepoint s")
    return null
  } catch (e) { await c.query("rollback to savepoint s"); return e.message }
}

try {
  await c.query("begin")
  const sup = (await uno("select id from perfiles where rol = 'superadmin' limit 1")).id
  const optica = (await uno("select id from opticas where slug = 'v8twzq'")).id
  const admin = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [optica])).id
  const asistente = (await uno("select id from perfiles where optica_id = $1 and rol = 'asistente' and activo limit 1", [optica])).id
  const antes = await uno("select count(*)::int n from auditoria")

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")

  // 1. Óptica de prueba
  const pruebas = (await c.query("select slug from opticas where es_de_prueba order by slug")).rows.map((r) => r.slug)
  ok(pruebas.join() === "3pldf1,qu7u2j,v8twzq", `solo las tres ópticas de prueba quedan marcadas (${pruebas.join(", ")})`)
  ok((await uno("select count(*)::int n from opticas where not es_de_prueba")).n === (await uno("select count(*)::int n from opticas")).n - 3, "las demás ópticas siguen sin marca")
  ok(/solo el superadministrador/i.test(await falla(admin, "update opticas set es_de_prueba = false where id = $1", [optica]) || ""), "el administrador de la óptica NO puede cambiar la marca de prueba")
  ok(!(await falla(sup, "update opticas set es_de_prueba = true where id = $1", [optica])), "el superadmin sí puede cambiarla")
  ok((await como(admin, async () => (await uno("select marca is not null o from opticas where id = $1", [optica])).o)) !== undefined, "el administrador sigue leyendo su óptica")

  // 2. Datos del negocio
  const d = await como(sup, async () => (await uno("select datos_negocio_superadmin() d")).d)
  ok(Array.isArray(d.personas) && d.personas.length > 0, `el superadmin recibe las personas (${d.personas.length})`)
  ok(d.personas.every((p) => "ultimo_ingreso" in p && "optica_id" in p), "cada persona trae su último ingreso y su óptica")
  ok(Array.isArray(d.opticas) && d.opticas.length === (await uno("select count(*)::int n from opticas")).n, "una fila de uso por cada óptica")
  ok(d.opticas.every((o) => "citas" in o && "consultas" in o && "ventas" in o && typeof o.modulos === "object" && "personas_activas" in o && o.previo && "ventas" in o.previo), "cada óptica trae citas, consultas, ventas, personas activas, módulos y los 30 días anteriores")
  ok(/solo el superadministrador/i.test(await falla(admin, "select datos_negocio_superadmin()") || ""), "el administrador NO puede llamarla")
  ok(/solo el superadministrador/i.test(await falla(asistente, "select datos_negocio_superadmin()") || ""), "el personal NO puede llamarla")
  ok(!!(await falla(null, "select datos_negocio_superadmin()")), "sin sesión NO puede llamarla")
  ok(!/clave|password|token/i.test(JSON.stringify(d)), "no entrega claves ni tokens")

  ok(d.opticas.every((o) => "pacientes" in o && "asistentes" in o), "cada óptica trae su número de pacientes y de asistentes")

  // 2b. Restaurar roles
  await c.query("update roles set permisos = '{}'::jsonb, nombre = 'Otro nombre' where optica_id = $1 and clave = 'recepcion'", [optica])
  const n = await como(sup, async () => (await uno("select restaurar_roles_predefinidos($1) n", [optica])).n)
  const rec = await uno("select nombre, permisos from roles where optica_id = $1 and clave = 'recepcion'", [optica])
  ok(n === 3 && rec.nombre === "Recepción" && Object.keys(rec.permisos).length > 3, "restaurar devuelve Recepción a como la crea el sistema")
  ok((await uno("select count(*)::int n from roles where optica_id = $1 and es_predefinido", [optica])).n === 3, "siguen siendo tres roles predefinidos (sin duplicados)")
  ok(/solo el superadministrador/i.test(await falla(admin, "select restaurar_roles_predefinidos($1)", [optica]) || ""), "el administrador NO puede restaurar los roles")
  ok(!!(await falla(null, "select restaurar_roles_predefinidos($1)", [optica])), "sin sesión NO puede")
  await c.query("update roles set clave = null, es_predefinido = false, nombre = 'Recepción' where optica_id = $1 and clave = 'recepcion'", [optica])
  ok(/rol propio/i.test(await falla(sup, "select restaurar_roles_predefinidos($1)", [optica]) || ""), "si hay un rol propio con el mismo nombre, lo dice y no lo pisa")

  // 3. Auditoría
  for (const a of ["marcar_optica_prueba", "cambiar_estado_lead", "cambiar_estado_soporte", "pagar_factura", "cambiar_suscripcion"]) {
    ok(!(await falla(sup, "insert into auditoria (actor_id, actor_nombre, accion, optica_id, optica_nombre, detalle, antes, despues) values ($1, 'Ensayo', $2, $3, 'QA', 'x', 'a', 'b')", [sup, a, optica])), `acepta la acción ${a}`)
  }
  ok(!!(await falla(sup, "insert into auditoria (actor_id, actor_nombre, accion, optica_nombre) values ($1, 'Ensayo', 'accion_inventada', 'QA')", [sup])), "rechaza una acción que no existe")
  const fila = (await uno("select id from auditoria where actor_nombre = 'Ensayo' limit 1")).id
  ok(/no se borra/i.test(await cruda("delete from auditoria where id = $1", [fila]) || ""), "no se puede borrar un registro (ni con acceso directo a la base)")
  ok(/no se edita/i.test(await cruda("update auditoria set detalle = 'otro' where id = $1", [fila]) || ""), "no se puede editar un registro")
  ok(/no se edita/i.test(await cruda("update auditoria set actor_nombre = 'Otro' where id = $1", [fila]) || ""), "tampoco el nombre de quien lo hizo")
ok(/permission denied/i.test(await falla(sup, "delete from auditoria where id = $1", [fila]) || ""), "y el superadmin por la API ya no tenía permiso de borrar")
  await c.query("update auditoria set optica_id = null where id = $1", [fila])
  ok((await uno("select optica_id from auditoria where id = $1", [fila])).optica_id === null, "la llave foránea SÍ puede poner la óptica en nulo")
  await c.query("update auditoria set actor_id = null where id = $1", [fila])
  ok((await uno("select actor_id from auditoria where id = $1", [fila])).actor_id === null, "y la cuenta en nulo")
  ok(!!(await cruda("update auditoria set optica_id = $2 where id = $1", [fila, optica])), "pero no se puede reasignar a otra óptica")
  ok((await como(admin, async () => (await uno("select count(*)::int n from auditoria")).n)) === 0, "el administrador de una óptica NO lee la auditoría del superadmin")
  console.log(`(auditoria antes: ${antes.n})`)
} catch (e) {
  console.error("ERROR del ensayo:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTODO PASÓ (la transacción se revirtió: no quedó ningún cambio)" : `\n${fallos} FALLO(S)`)
process.exit(fallos === 0 ? 0 : 1)
