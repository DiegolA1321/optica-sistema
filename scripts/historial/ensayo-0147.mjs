// Ensayo de la migración 0147 (campañas del CRM sin algunos pacientes): la aplica dentro de una transacción y prueba con sesiones reales (el rol authenticated con las claims de cada persona de la óptica de pruebas).
// SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/historial/ensayo-0147.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0147_campanas_sin_algunos_pacientes.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

let n = 0
const como = async (uid, fn) => {
  const sp = `s${++n}`
  await c.query(`savepoint ${sp}`)
  try {
    await c.query("set local role authenticated")
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
    const r = await fn()
    await c.query(`rollback to savepoint ${sp}`)
    await c.query("reset role")
    return { r }
  } catch (e) {
    await c.query(`rollback to savepoint ${sp}`)
    await c.query("reset role")
    return { e: e.message }
  }
}

try {
  await c.query("begin")
  const optica = (await q("select id from opticas where slug = 'v8twzq'"))[0].id // la óptica de pruebas
  const personas = await q("select id, nombre, rol from perfiles where optica_id = $1 and activo", [optica])
  const admin = personas.find((p) => p.rol === "admin")
  const pacs = await q("select id from pacientes_base where optica_id = $1 limit 1", [optica])
  const ajeno = (await q("select id from pacientes_base where optica_id <> $1 limit 1", [optica]))[0]?.id
  if (!admin || pacs.length < 1) throw new Error("Faltan datos en la óptica de pruebas")
  const campanasAntes = (await q("select count(*)::int n from crm_campanas"))[0].n

  await c.query(sql)
  ok(true, "0147 se aplica sin errores")

  const firmas = await q("select pg_get_function_identity_arguments(p.oid) a from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'crear_campana_crm'")
  ok(firmas.length === 1 && firmas[0].a.includes("p_excluidos uuid[]"), "queda UNA sola crear_campana_crm, con el parámetro nuevo (" + firmas.map((f) => f.a).join(" | ") + ")")
  ok((await q("select count(*)::int n from crm_campanas where excluidos <> '{}'"))[0].n === 0, "ninguna campaña existente trae quitados (nacen con la lista vacía)")

  // Sin quitados (como la llamaba la pantalla anterior): igual que siempre.
  let r = await como(admin.id, async () => (await q("select crear_campana_crm('Prueba sin quitados', 'promociones', 'Hola {nombre}, una promoción.') id"))[0].id)
  ok(!r.e && r.r, "el administrador crea una campaña sin pasar quitados" + (r.e ? " — " + r.e : ""))
  // Con quitados: se guardan solo los pacientes de su óptica (el ajeno se descarta).
  const idsParam = [pacs[0].id, ...(ajeno ? [ajeno] : [])]
  r = await como(admin.id, async () => {
    const id = (await q("select crear_campana_crm('Prueba con quitados', 'promociones', 'Hola {nombre}, una promoción.', $1::uuid[]) id", [idsParam]))[0].id
    const fila = (await q("select excluidos from crm_campanas where id = $1", [id]))[0]
    const log = (await q("select detalle from logs_optica where modulo = 'crm' and accion = 'Creó una campaña' order by created_at desc limit 1"))[0]
    return { excluidos: fila.excluidos, log: log?.detalle }
  })
  ok(!r.e && r.r.excluidos.length === 1 && r.r.excluidos.includes(pacs[0].id) && !r.r.excluidos.includes(ajeno), "guarda los quitados de su óptica y descarta el de otra óptica" + (r.e ? " — " + r.e : ""))
  ok(!r.e && /sin 1 paciente/.test(r.r.log || ""), "el registro de actividad dice cuántos se quitaron (" + r.r?.log + ")")
  // Validaciones de siempre.
  r = await como(admin.id, async () => (await q("select crear_campana_crm('Ab', 'promociones', 'Hola {nombre}, una promoción.') id"))[0].id)
  ok(!!r.e, "el nombre corto se sigue rechazando: " + r.e)
  r = await como(admin.id, async () => (await q("select crear_campana_crm('Grupo malo', 'otro', 'Hola {nombre}, una promoción.') id"))[0].id)
  ok(!!r.e, "el grupo desconocido se sigue rechazando: " + r.e)
  // Anónimo no ejecuta.
  await c.query("savepoint anon"); await c.query("set local role anon")
  let anonError = null
  try { await c.query("select crear_campana_crm('Anon', 'promociones', 'Hola {nombre}, una promoción.')") } catch (e) { anonError = e.message }
  await c.query("rollback to savepoint anon"); await c.query("reset role")
  ok(!!anonError, "sin sesión no se puede crear una campaña: " + anonError)
  ok((await q("select count(*)::int n from crm_campanas"))[0].n === campanasAntes, "(dentro del ensayo) los savepoints no dejaron campañas de prueba")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback")
  const despues = await q("select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = 'crear_campana_crm'")
  const col = await q("select count(*)::int n from information_schema.columns where table_name = 'crm_campanas' and column_name = 'excluidos'")
  console.log(`Revertido: ${despues[0].n} función(es) crear_campana_crm, columna excluidos ${col[0].n === 0 ? "ausente" : "PRESENTE (¡no revirtió!)"}.`)
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nEnsayo limpio: todo bien y revertido.")
process.exit(fallos ? 1 : 0)
