// Verificación con sesión REAL de la migración 0140 (Óptica Demo, solo lectura): lo que ven el administrador y el optómetra por la API.
// El administrador ve todo; el optómetra solo las citas propias (alcance propio): ve las nuevas que son suyas y ninguna de otra persona.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0140.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const ingreso = async (p) => { const cl = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } }); const { error } = await cl.auth.signInWithPassword({ email: process.env[`DEMO_${p}_EMAIL`], password: process.env[`DEMO_${p}_PASSWORD`] }); if (error) throw new Error("ingreso " + p); return cl }
const c = new pg.Client(); await c.connect()
const demo = (await c.query("select id from opticas where nombre = 'Óptica Demo'")).rows[0].id
const nuevas = (await c.query("select id, asignado_a from citas_base where optica_id = $1 and origen = 'presencial' and estado = 'Atendida' and created_at > now() - interval '1 day'", [demo])).rows
ok(nuevas.length === 13, `en la Demo se crearon 13 citas presenciales atendidas (${nuevas.length})`)
const admin = await ingreso("ADMIN")
const k = await admin.from("consultas").select("id, cita_id")
const ci = await admin.from("citas").select("id, paciente, fecha, estado")
const visibles = new Set(ci.data.map((x) => x.id))
ok(!k.error && k.data.every((x) => x.cita_id), `ADMIN: toda consulta tiene su cita (0 sin cita de ${k.data.length})`)
ok(k.data.every((x) => visibles.has(x.cita_id)), "ADMIN: ve la cita de cada consulta")
ok(nuevas.every((x) => visibles.has(x.id)), "ADMIN: ve las 13 citas nuevas")
ok(ci.data.filter((x) => /^Diego alarcon dd$/i.test(x.paciente) && x.fecha === "2026-10-07" && x.estado === "Atendida").length === 2, "ADMIN: «Diego alarcon dd» tiene 2 citas atendidas el 7 oct")
const opto = await ingreso("OPTOMETRA")
const uid = (await opto.auth.getUser()).data.user.id
const vo = new Set((await opto.from("citas").select("id")).data.map((x) => x.id))
ok(nuevas.filter((x) => x.asignado_a === uid).every((x) => vo.has(x.id)), "OPTOMETRA: ve las citas nuevas que son suyas")
ok(nuevas.filter((x) => x.asignado_a && x.asignado_a !== uid).every((x) => !vo.has(x.id)), "OPTOMETRA: no ve las de otra persona (alcance propio, como antes)")
const ko = await opto.from("consultas").select("id, cita_id")
ok(ko.data.every((x) => x.cita_id), `OPTOMETRA: toda consulta que ve tiene su cita (${ko.data.length})`)
await c.end()
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien.")
process.exit(fallos ? 1 : 0)
