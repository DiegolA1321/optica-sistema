// Ensayo de la migración 0139 (contacto manual desde el perfil): la aplica DENTRO de una transacción y SIEMPRE revierte.
import pg from "pg"
import fs from "node:fs"
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const cl = { sub: admin.id, role: "authenticated", aal: "aal2" }
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0139_contacto_manual_desde_el_perfil.sql", import.meta.url), "utf8"))
  ok((await q("select count(*)::int n from pg_proc where proname = 'registrar_contacto_manual'"))[0].n === 1, "una sola versión")
  const r = await como("authenticated", cl, "select registrar_contacto_manual($1, 'whatsapp', 'Hola, mensaje a mano') r", [base.id])
  ok(r.r?.[0].r, "el administrador registra un contacto manual" + (r.e ? " — " + r.e : ""))
  ok((await q("select motivo, canal from crm_contactos where paciente_id = $1 order by creado_en desc limit 1", [base.id]))[0].motivo === "mensaje_manual", "queda con su motivo en el Seguimiento")
  ok((await como("authenticated", cl, "select registrar_contacto_manual($1, 'sms', 'x')", [base.id])).e?.includes("Canal"), "un canal inventado se rechaza")
  ok((await como("anon", null, "select registrar_contacto_manual($1, 'whatsapp', 'x')", [base.id])).e !== undefined, "un anónimo no")
  await c.query("update pacientes_base set acepta_recordatorios = false, acepta_promociones = false where id = $1", [base.id])
  ok((await como("authenticated", cl, "select registrar_contacto_manual($1, 'correo', 'x')", [base.id])).e?.includes("no desea"), "respeta a quien no quiere mensajes")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await c.query("rollback").catch(() => {}); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
