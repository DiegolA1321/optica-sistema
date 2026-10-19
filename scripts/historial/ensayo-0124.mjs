// Ensayo de la migración 0124 (descargar datos y pedir eliminación quedan en la actividad): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0124.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0124_actividad_de_datos_del_paciente.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
// Ejecuta una función como la API (rol anon); lo que escribe se conserva dentro de la transacción del ensayo.
const comoAnon = async (fn, ...args) => {
  await c.query("savepoint r")
  try {
    await c.query("set local role anon")
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
const logs = async (op, nombre, accion) => (await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = $2 and detalle = $3", [op, accion, nombre]))[0].n

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente Ensayo 0124', cedula = '0900000031', usuario = null, clave_temporal = null, sesion_token = 'tok-A', sesion_token_creado_en = now()")
  const A = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  const NOM = "Paciente Ensayo 0124"
  const DESCARGA = "El paciente descargó una copia de sus datos"
  const ELIMINAR = "El paciente pidió eliminar su cuenta"

  const antes = await comoAnon("exportar_mis_datos_paciente", A, "tok-A")
  ok(!antes.e && antes.r?.perfil?.nombre === NOM, "ANTES: la descarga funciona")
  ok((await logs(OP, NOM, DESCARGA)) === 0, "ANTES: no deja nada en la actividad (el defecto)")

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const f of ["exportar_mis_datos_paciente", "solicitar_eliminacion_paciente"]) ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)

  const d = await comoAnon("exportar_mis_datos_paciente", A, "tok-A")
  ok(!d.e && d.r?.perfil?.nombre === NOM && Array.isArray(d.r?.citas) && Array.isArray(d.r?.consultas), "la descarga entrega lo mismo que antes")
  ok(!/clave|token|intentos|monto/i.test(JSON.stringify(Object.keys(d.r?.perfil || {}))), "sin campos internos")
  ok((await logs(OP, NOM, DESCARGA)) === 1, "la descarga queda en la actividad, con el nombre del paciente")
  const mala = await comoAnon("exportar_mis_datos_paciente", A, "falso")
  ok(!mala.e && mala.r === null, "con un token falso no entrega nada")
  ok((await logs(OP, NOM, DESCARGA)) === 1, "y tampoco deja registro")

  const s1 = await comoAnon("solicitar_eliminacion_paciente", A, "tok-A", "Ya no uso la óptica")
  ok(!s1.e && s1.r === true, "la solicitud se crea")
  ok((await q("select count(*)::int n from solicitudes_eliminacion_paciente where paciente_id = $1", [A]))[0].n === 1, "una sola solicitud pendiente")
  ok((await logs(OP, NOM, ELIMINAR)) === 1, "la solicitud queda en la actividad")
  const s2 = await comoAnon("solicitar_eliminacion_paciente", A, "tok-A", "otra vez")
  ok(!s2.e && s2.r === true && (await logs(OP, NOM, ELIMINAR)) === 1, "insistir no duplica ni la solicitud ni el registro")
  const s3 = await comoAnon("solicitar_eliminacion_paciente", A, "falso")
  ok(!s3.e && s3.r === false, "con un token falso se rechaza")
  const reg = (await q("select usuario_id, modulo from logs_optica where optica_id = $1 and accion = $2 and detalle = $3", [OP, ELIMINAR, NOM]))[0]
  ok(reg.usuario_id === null && reg.modulo === "pacientes", "el registro es del paciente (sin usuario del personal) y del módulo Pacientes")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
