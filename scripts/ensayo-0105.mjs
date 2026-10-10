// Ensayo de la migración 0105 (la actividad del superadmin registra entrar y salir de una óptica): la aplica dentro de una transacción
// y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0105.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0105_auditoria_entrar_como_optica.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, fn) => {
  await c.query("savepoint r")
  try {
    await c.query(`set local role ${rol}`)
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)])
    const r = await fn(); await c.query("reset role"); await c.query("rollback to savepoint r"); return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
try {
  await c.query("begin")
  const [sa] = await q("select id, nombre from perfiles where rol = 'superadmin' limit 1")
  const [ad] = await q("select id, optica_id from perfiles where rol = 'admin' limit 1")
  const [op] = await q("select id, nombre from opticas where id = $1", [ad.optica_id])
  ok(!!sa && !!ad, "hay un superadmin y un administrador para probar")
  const antes = (await q("select count(*)::int n from auditoria"))[0].n
  const insertar = (accion) => c.query("insert into auditoria (actor_id, actor_nombre, accion, optica_id, optica_nombre, detalle) values ($1,$2,$3,$4,$5,$6)", [sa.id, sa.nombre, accion, op.id, op.nombre, null])

  let x = await como("authenticated", { sub: sa.id, role: "authenticated", aal: "aal2" }, () => insertar("entrar_como_optica"))
  ok(!!x.e && /check/i.test(x.e), "antes de la migración, 'entrar_como_optica' no cabe en la tabla: " + (x.e || "").slice(0, 80))

  await c.query(sql)
  ok(true, "la migración se aplica sin errores")
  const def = (await q("select pg_get_constraintdef(oid) d from pg_constraint where conname = 'auditoria_accion_check'"))[0].d
  ok(["crear_optica", "suspender_optica", "reactivar_optica", "renombrar_optica", "agregar_administrador", "eliminar_administrador", "crear_superadmin", "eliminar_superadmin", "responder_mensaje", "publicar_anuncio", "actualizar_pago", "generar_factura"].every((a) => def.includes("'" + a + "'")), "las 12 acciones de antes siguen permitidas")
  ok(def.includes("'entrar_como_optica'") && def.includes("'salir_de_optica'"), "se permiten entrar_como_optica y salir_de_optica")

  const claimsSa = { sub: sa.id, role: "authenticated", aal: "aal2" }
  x = await como("authenticated", claimsSa, async () => { await insertar("entrar_como_optica"); await insertar("salir_de_optica"); return (await q("select accion, actor_nombre, optica_nombre, created_at from auditoria order by created_at desc limit 2")).length })
  ok(!x.e && x.r === 2, "el superadmin registra la entrada y la salida (con quién, qué óptica y cuándo)" + (x.e ? " — " + x.e : ""))
  x = await como("authenticated", claimsSa, () => insertar("accion_inventada"))
  ok(!!x.e, "una acción que no está en la lista sigue rechazada")
  x = await como("authenticated", { sub: ad.id, role: "authenticated", aal: "aal2" }, async () => { await c.query("insert into auditoria (actor_id, actor_nombre, accion, optica_id, optica_nombre) values ($1,'x','entrar_como_optica',$2,'x')", [ad.id, op.id]) })
  ok(!!x.e, "un administrador de óptica no puede escribir en la actividad del superadmin: " + (x.e || "").slice(0, 70))
  x = await como("anon", null, () => insertar("entrar_como_optica"))
  ok(!!x.e, "sin sesión tampoco: " + (x.e || "").slice(0, 70))
  ok((await q("select count(*)::int n from auditoria"))[0].n === antes, "las pruebas no dejaron filas")
} catch (e) {
  console.log("✘ error inesperado:", e.message); fallos++
} finally {
  await c.query("rollback"); await c.end()
}
console.log(fallos === 0 ? "\nTodo bien (la transacción se revirtió: nada cambió en la base)." : `\n${fallos} fallo(s). Se revirtió.`)
process.exit(fallos ? 1 : 0)
