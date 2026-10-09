// Ensayo de la migración 0104 (editar un paciente actualiza sus citas y consultas): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0104.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0104_propagar_datos_paciente.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
try {
  await c.query("begin")
  await c.query(sql)
  ok(true, "se aplica sin errores")
  const { rows } = await c.query("select p.id, p.nombre from pacientes_base p where exists (select 1 from citas_base c where c.paciente_id = p.id) and exists (select 1 from consultas_base k where k.paciente_id = p.id) limit 1")
  const pac = rows[0]
  ok(!!pac, "hay un paciente con citas y consultas para probar")
  const antes = (await c.query("select (select count(*)::int from citas_base where paciente_id = $1) c, (select count(*)::int from consultas_base where paciente_id = $1) k", [pac.id])).rows[0]
  await c.query("update pacientes_base set nombre = $2, telefono = '0999999999' where id = $1", [pac.id, "ZZ Nombre de ensayo"])
  const citas = (await c.query("select paciente, telefono from citas_base where paciente_id = $1", [pac.id])).rows
  const cons = (await c.query("select paciente from consultas_base where paciente_id = $1", [pac.id])).rows
  ok(citas.length === antes.c && citas.every((x) => x.paciente === "ZZ Nombre de ensayo" && x.telefono === "0999999999"), `las ${antes.c} citas del paciente quedan con el nombre y teléfono nuevos`)
  ok(cons.length === antes.k && cons.every((x) => x.paciente === "ZZ Nombre de ensayo"), `las ${antes.k} consultas del paciente quedan con el nombre nuevo`)
  const otras = (await c.query("select count(*)::int n from citas_base where paciente_id <> $1 and paciente = 'ZZ Nombre de ensayo'", [pac.id])).rows[0].n
  ok(otras === 0, "las citas de otros pacientes no cambian")
  await c.query("update pacientes_base set referido_por = 'x' where id = $1", [pac.id])
  ok(true, "editar un dato que no se copia no dispara nada")
} catch (e) {
  console.log("✘ error:", e.message); fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTodo bien (la transacción se revirtió: nada cambió en la base)." : `\n${fallos} fallo(s). Se revirtió.`)
process.exit(fallos ? 1 : 0)
