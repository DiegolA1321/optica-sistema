// Ensayo de la migración 0121 (estado del sistema y uso de un módulo): la aplica DENTRO de una transacción y prueba con sesiones reales de
// la base (superadmin, administrador de la óptica real y sin sesión) que:
//   - verificar_sistema() guarda las cinco verificaciones (sesion, datos, archivos, tareas, correo) con estados válidos;
//   - el correo dice "no_configurado" mientras falte la clave del servicio de correo o el remitente propio;
//   - estado_sistema() entrega lo último de cada componente, el historial, los fallos y las tareas, solo al superadmin;
//   - el administrador de una óptica y quien no tiene sesión NO pueden verificar ni ver el estado, ni leer la tabla;
//   - nadie inserta ni borra filas de la tabla desde la aplicación;
//   - uso_de_modulo() devuelve días y roles (sin conteos), rechaza módulos desconocidos y solo lo ve el superadmin;
//   - la tarea programada cada 15 minutos queda creada.
// SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0121.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0121_estado_del_sistema.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]
const sesion = async (uid) => {
  await c.query("set local role " + (uid ? "authenticated" : "anon"))
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
}
const finSesion = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
const como = async (uid, fn) => { await sesion(uid); try { return await fn() } finally { await finSesion() } }
const falla = async (uid, q, p = []) => {
  await c.query("savepoint s")
  try {
    await sesion(uid)
    await c.query(q, p)
    await finSesion(); await c.query("release savepoint s")
    return null
  } catch (e) { await c.query("rollback to savepoint s"); return e.message }
}

try {
  await c.query("begin")
  const sup = (await uno("select id from perfiles where rol = 'superadmin' limit 1")).id
  const solna = (await uno("select id from opticas where slug = 'optica-solna'")).id
  const adminSolna = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [solna])).id

  await c.query(sql)
  ok(true, "la migración se aplica sin errores")

  // verificar_sistema (la primera verificación ya la hizo la propia migración)
  const filas = (await c.query("select componente, estado, latencia_ms, detalle from verificaciones_sistema order by id")).rows
  const comps = filas.map((f) => f.componente).sort().join(",")
  ok(comps === "archivos,correo,datos,sesion,tareas", `guarda las cinco verificaciones (${comps})`)
  ok(filas.every((f) => ["operativo", "lento", "con_fallas", "no_configurado"].includes(f.estado)), "todos los estados son válidos")
  for (const f of filas) console.log(`   · ${f.componente}: ${f.estado}${f.latencia_ms != null ? ` (${f.latencia_ms} ms)` : ""}${f.detalle ? " — " + f.detalle : ""}`)
  const hayClave = (await uno("select count(*)::int n from vault.decrypted_secrets where name in ('resend_api_key', 'correo_remitente') and btrim(coalesce(decrypted_secret, '')) <> ''")).n === 2
  const correo = filas.find((f) => f.componente === "correo")
  ok(hayClave ? correo.estado !== "no_configurado" : correo.estado === "no_configurado", hayClave ? "con clave y remitente propio no dice «no configurado»" : "sin clave o sin remitente propio dice «no configurado»")

  // Quién puede verificar y ver
  const nuevo = await como(sup, async () => (await uno("select verificar_sistema() as r")).r)
  ok(Array.isArray(nuevo) && nuevo.length === 5, "el superadmin puede verificar ahora y recibe las cinco")
  ok(!!(await falla(adminSolna, "select verificar_sistema()")), "el administrador de una óptica NO puede verificar")
  ok(!!(await falla(null, "select verificar_sistema()")), "sin sesión NO se puede verificar")
  ok(!!(await falla(adminSolna, "select estado_sistema()")), "el administrador de una óptica NO ve el estado del sistema")
  ok(!!(await falla(null, "select estado_sistema()")), "sin sesión NO se ve el estado del sistema")
  ok((await como(adminSolna, async () => (await uno("select count(*)::int n from verificaciones_sistema")).n)) === 0, "el administrador de una óptica no lee la tabla")
  ok((await como(sup, async () => (await uno("select count(*)::int n from verificaciones_sistema")).n)) >= 10, "el superadmin sí lee la tabla")
  ok(!!(await falla(sup, "insert into verificaciones_sistema (componente, estado) values ('datos', 'operativo')")), "nadie inserta filas desde la aplicación (ni el superadmin)")
  ok(!!(await falla(sup, "delete from verificaciones_sistema")) || (await como(sup, async () => (await uno("select count(*)::int n from verificaciones_sistema")).n)) >= 10, "nadie borra filas desde la aplicación")
  ok(!!(await falla(sup, "select _registrar_verificacion('datos', 'operativo', 1, null)")), "la función interna no se llama desde fuera")

  // estado_sistema
  const e = await como(sup, async () => (await uno("select estado_sistema() as r")).r)
  ok(e.ultimos.length === 5, "estado_sistema entrega lo último de los cinco componentes")
  ok(Array.isArray(e.historial) && e.historial.length >= 5, "entrega el historial por día")
  ok(Array.isArray(e.fallos) && Array.isArray(e.tareas), "entrega los fallos recientes y las tareas programadas")
  ok(e.tareas.some((t) => t.nombre === "verificar_sistema"), "la verificación cada 15 minutos aparece entre las tareas programadas")

  // La tarea programada
  const job = await uno("select schedule, active from cron.job where jobname = 'verificar_sistema'")
  ok(job?.schedule === "*/15 * * * *" && job.active, "la tarea programada corre cada 15 minutos")

  // uso_de_modulo
  const u = await como(sup, async () => (await uno("select uso_de_modulo($1, 'citas') as r", [solna])).r)
  ok(Array.isArray(u.dias) && Array.isArray(u.roles) && "ultimo" in u, "uso_de_modulo devuelve días, roles y último uso")
  ok(u.dias.every((d) => Object.keys(d).sort().join() === "dia,roles"), "cada día trae solo la fecha y los roles (sin conteos)")
  ok(!!(await falla(sup, "select uso_de_modulo($1, 'inventado')", [solna])), "rechaza un módulo desconocido")
  ok(!!(await falla(adminSolna, "select uso_de_modulo($1, 'citas')", [solna])), "el administrador de una óptica NO ve el uso de módulos")
  ok(!!(await falla(null, "select uso_de_modulo($1, 'citas')", [solna])), "sin sesión NO se ve el uso de módulos")

  // personal_de_la_optica
  const per = await como(sup, async () => (await uno("select personal_de_la_optica($1) as r", [solna])).r)
  ok(Array.isArray(per) && per.length >= 1 && per.every((x) => ["nombre", "rol", "activo", "ultimo_ingreso", "activa_30d"].every((k) => k in x)), `personal_de_la_optica devuelve ${per.length} persona(s) con rol, último ingreso y actividad`)
  ok(per.every((x) => typeof x.rol === "string" && x.rol.length > 0), "todas traen un rol")
  ok(!!(await falla(adminSolna, "select personal_de_la_optica($1)", [solna])), "el administrador de una óptica NO ve esta lista")
  ok(!!(await falla(null, "select personal_de_la_optica($1)", [solna])), "sin sesión NO se ve esta lista")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTodo pasó (se revirtió: no quedó ningún cambio)." : `\n${fallos} comprobación(es) fallaron (se revirtió).`)
process.exit(fallos === 0 ? 0 : 1)
