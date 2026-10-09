// Ensayo de la migración 0101 (código único en toda cita): la aplica dentro de una transacción y SIEMPRE revierte.
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
  // Antes de nada: ¿hay códigos repetidos hoy? (también sin distinguir mayúsculas)
  const dup = (await c.query("select upper(codigo) c, count(*)::int n from citas_base where codigo is not null group by 1 having count(*) > 1")).rows
  ok(dup.length === 0, "hoy no hay ningún código repetido entre las citas existentes" + (dup.length ? ": " + JSON.stringify(dup) : ""))
  const antes = (await c.query("select count(*)::int n from citas_base where codigo is null")).rows[0].n
  const total = (await c.query("select count(*)::int n from citas_base")).rows[0].n
  const previos = (await c.query("select id, codigo from citas_base where codigo is not null")).rows
  await c.query(sql)
  ok(true, `se aplica sin errores (había ${antes} citas sin código de ${total})`)
  ok((await c.query("select count(*)::int n from citas_base where codigo is null")).rows[0].n === 0, "ya no queda ninguna cita sin código")
  const ahora = new Map((await c.query("select id, codigo from citas_base")).rows.map((r) => [r.id, r.codigo]))
  ok(previos.every((r) => ahora.get(r.id) === r.codigo), "los códigos que ya existían no cambian")
  ok((await c.query("select count(*)::int n from citas_base where codigo !~ '^CIT-[0-9]{4}-[0-9A-Z]{6,32}$'")).rows[0].n === 0, "todos tienen el formato CIT-AAAA-XXXXXX")
  ok((await c.query("select count(*)::int n from (select codigo from citas_base group by 1 having count(*) > 1) x")).rows[0].n === 0, "después de aplicarla, ningún código repetido")
  const idx = (await c.query("select indexdef from pg_indexes where indexname='citas_codigo_idx'")).rows[0]
  ok(idx && /UNIQUE/i.test(idx.indexdef) && /codigo IS NOT NULL/i.test(idx.indexdef), "índice único sobre el código, ignorando los vacíos: " + (idx?.indexdef || "no existe"))
  const optica = (await c.query("select id from opticas where slug='v8twzq'")).rows[0].id
  const n = (await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado) values ($1,'ENSAYO 0101','2099-03-03','10:00 AM','Examen','Pendiente') returning codigo, id", [optica])).rows[0]
  ok(n.codigo === "CIT-2099-" + n.id.replace(/-/g, "").slice(0, 6).toUpperCase(), "insert por la vista sin código: la base lo genera (" + n.codigo + ")")
  const e = (await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado, codigo) values ($1,'ENSAYO 0101 b','2099-03-03','11:00 AM','Examen','Pendiente','CIT-2099-PROPIO') returning codigo", [optica])).rows[0]
  ok(e.codigo === "CIT-2099-PROPIO", "un código explícito no se pisa")
  // Colisión forzada: el código que le tocaría ya existe → genera otro
  await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado, codigo) values ($1,'ENSAYO 0101 c','2099-03-04','10:00 AM','Examen','Pendiente','CIT-2099-ABCDEF')", [optica])
  const col = (await c.query("insert into citas (id, optica_id, paciente, fecha, hora, motivo, estado) values ('abcdef00-0000-4000-8000-000000000001', $1,'ENSAYO 0101 d','2099-03-05','10:00 AM','Examen','Pendiente') returning codigo", [optica])).rows[0]
  ok(col.codigo === "CIT-2099-ABCDEF0", "si el código generado ya existe, genera otro (" + col.codigo + ")")
  // La reserva web sigue generando su código como antes (lo calcula la función, no el trigger)
  const ced = (await c.query("select cedula from pacientes where optica_id=$1 and cedula is not null limit 1", [optica])).rows[0]?.cedula
  if (ced) {
    const pub = (await c.query("select * from crear_cita_publica($1,'ENSAYO WEB','2099-04-01','10:00 AM',$2,'1990-01-01','0999999999','Consulta General',null,null,null)", [optica, ced])).rows[0]
    ok(pub && pub.codigo === "CIT-2099-" + pub.id.replace(/-/g, "").slice(0, 6).toUpperCase(), "la reserva web (crear_cita_publica) sigue dando su código: " + pub?.codigo)
  } else console.log("· sin paciente con cédula en la óptica de pruebas: se omite la reserva web")
} catch (e) { fallos++; console.error("✘ Error:", e.message) }
finally {
  await c.query("rollback"); await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó.` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
