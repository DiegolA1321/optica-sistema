// Ensayo de la migración 0101 (código en toda cita): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0101.mjs
import pg from "pg"
import fs from "node:fs"
const sql = fs.readFileSync(new URL("../supabase/migrations/0101_codigo_en_toda_cita.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
try {
  await c.query("begin")
  const antes = (await c.query("select count(*)::int n from citas_base where codigo is null")).rows[0].n
  const total = (await c.query("select count(*)::int n from citas_base")).rows[0].n
  const codigosAntes = (await c.query("select id, codigo from citas_base where codigo is not null")).rows
  await c.query(sql)
  ok(true, `se aplica sin errores (había ${antes} citas sin código de ${total})`)
  ok((await c.query("select count(*)::int n from citas_base where codigo is null")).rows[0].n === 0, "ya no queda ninguna cita sin código")
  const iguales = (await c.query("select id, codigo from citas_base where id = any($1)", [codigosAntes.map((r) => r.id)])).rows
  ok(iguales.every((r) => codigosAntes.find((a) => a.id === r.id).codigo === r.codigo), "los códigos que ya existían no cambian")
  ok((await c.query("select count(*)::int n from citas_base where codigo !~ '^CIT-[0-9]{4}-[0-9A-Za-z]{4,6}$'")).rows[0].n === 0, "todos tienen el formato CIT-AAAA-XXXXXX")
  const optica = (await c.query("select id from opticas where slug='v8twzq'")).rows[0].id
  const n = (await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado) values ($1,'ENSAYO 0101','2099-03-03','10:00 AM','Examen','Pendiente') returning codigo, id", [optica])).rows[0]
  ok(n.codigo === "CIT-2099-" + n.id.replace(/-/g, "").slice(0, 6).toUpperCase(), "insert por la vista sin código: la base lo genera (" + n.codigo + ")")
  const e = (await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado, codigo) values ($1,'ENSAYO 0101 b','2099-03-03','11:00 AM','Examen','Pendiente','CIT-2099-PROPIO') returning codigo", [optica])).rows[0]
  ok(e.codigo === "CIT-2099-PROPIO", "un código explícito no se pisa")
} catch (e) { fallos++; console.error("✘ Error:", e.message) }
finally {
  await c.query("rollback"); await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó.` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
