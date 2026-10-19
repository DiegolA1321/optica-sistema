// Ensayo de la migración 0125 (detalle de citas, confirmar asistencia y calificar la atención desde el portal): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0125.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0125_portal_detalle_de_citas.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const comoAnon = async (fn, ...args) => {
  await c.query("savepoint r")
  try {
    await c.query("set local role anon")
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  const clonar = async (cedula, token, nombre) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
    await c.query("update t_p set id = gen_random_uuid(), nombre = $3, cedula = $1, usuario = null, clave_temporal = null, sesion_token = $2, sesion_token_creado_en = now()", [cedula, token, nombre])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const A = await clonar("0900000041", "tok-A", "Paciente A 0125")
  const B = await clonar("0900000042", "tok-B", "Paciente B 0125")
  const perfil = (await q("select id, nombre from perfiles where optica_id = $1 and es_optometra and rol = 'asistente' limit 1", [OP]))[0]
  const cita = async (estado, dias, hora, quien = A) => (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado, atendido_por, asignado_a) values ($1, $2, 'x', (now() at time zone 'America/Guayaquil')::date + $3::int, $4, 'Consulta General', $5, $6, $6) returning id`, [OP, quien, dias, hora, estado, estado === "Atendida" ? perfil.id : null]))[0].id
  const futura = await cita("Pendiente", 3, "10:20 AM")
  const atendida = await cita("Atendida", -3, "10:20 AM")
  const pasada = await cita("Pendiente", -3, "11:00 AM")
  const deB = await cita("Atendida", -4, "09:00 AM", B)
  await c.query("update citas_base set asignado_a = $2 where id = $1", [futura, perfil.id])
  await c.query(`insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, cita_id, datos_clinicos) values ($1, $2, 'x', current_date - 3, 'Control', $3, '{}'::jsonb)`, [OP, A, atendida])

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const f of ["mis_citas_detalle_paciente", "confirmar_asistencia_paciente", "calificar_atencion_paciente"]) ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)

  // Detalle
  const d = await comoAnon("mis_citas_detalle_paciente", A, "tok-A")
  ok(!d.e && d.r.length === 3, `el paciente recibe el detalle de SUS 3 citas (${d.r?.length ?? d.e})`)
  const claves = new Set(d.r.flatMap((x) => Object.keys(x)))
  ok([...claves].sort().join() === "calificacion,cita_id,confirmada_at,consulta_id,profesional", `solo esos campos, sin ids del personal: ${[...claves].join(",")}`)
  const det = (id) => d.r.find((x) => x.cita_id === id)
  ok(det(futura).profesional === perfil.nombre && det(atendida).profesional === perfil.nombre, "el profesional va por su nombre (atendió o está asignado)")
  ok(det(atendida).consulta_id !== null && det(futura).consulta_id === null, "la cita atendida enlaza su receta; la futura no")
  ok(!d.r.some((x) => x.cita_id === deB), "no entrega citas de otro paciente")
  const falso = await comoAnon("mis_citas_detalle_paciente", A, "inventado")
  ok(!falso.e && falso.r.length === 0, "con un token inventado no entrega nada")

  // Confirmar asistencia
  const c1 = await comoAnon("confirmar_asistencia_paciente", A, "tok-A", futura)
  ok(!c1.e && c1.r === true, "confirma una cita pendiente y futura")
  ok((await q("select confirmada_at is not null ok from citas_base where id = $1", [futura]))[0].ok, "la cita queda «Confirmada» (confirmada_at) para el personal")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'El paciente confirmó su asistencia'", [OP]))[0].n === 1, "queda en la actividad")
  const c2 = await comoAnon("confirmar_asistencia_paciente", A, "tok-A", futura)
  ok(!c2.e && c2.r === true && (await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'El paciente confirmó su asistencia'", [OP]))[0].n === 1, "confirmar otra vez no duplica el registro")
  ok((await comoAnon("confirmar_asistencia_paciente", A, "tok-A", pasada)).r === false, "una cita ya pasada no se confirma")
  ok((await comoAnon("confirmar_asistencia_paciente", A, "tok-A", atendida)).r === false, "una cita atendida no se confirma")
  ok((await comoAnon("confirmar_asistencia_paciente", B, "tok-B", futura)).r === false, "el paciente B no puede confirmar la cita de A")
  ok((await comoAnon("confirmar_asistencia_paciente", A, "falso", futura)).r === false, "con un token falso no confirma")

  // Calificar
  const k1 = await comoAnon("calificar_atencion_paciente", A, "tok-A", atendida, 5, "Muy buena atención")
  ok(!k1.e && k1.r === true, "califica una cita atendida")
  const fila = (await q("select puntaje, comentario from respuestas_satisfaccion where cita_id = $1", [atendida]))[0]
  ok(fila?.puntaje === 5 && fila?.comentario === "Muy buena atención", "queda en respuestas_satisfaccion (la misma tabla de Reportes)")
  const k2 = await comoAnon("calificar_atencion_paciente", A, "tok-A", atendida, 1, "otra vez")
  ok(!k2.e && k2.r === false && (await q("select puntaje from respuestas_satisfaccion where cita_id = $1", [atendida]))[0].puntaje === 5, "una sola vez por cita")
  ok((await comoAnon("calificar_atencion_paciente", A, "tok-A", futura, 5, null)).r === false, "una cita sin atender no se califica")
  ok((await comoAnon("calificar_atencion_paciente", A, "tok-A", deB, 5, null)).r === false, "no se califica la cita de otro paciente")
  ok((await comoAnon("calificar_atencion_paciente", B, "tok-B", deB, 6, null)).e !== undefined, "un puntaje fuera de 1 a 5 se rechaza")
  ok((await comoAnon("calificar_atencion_paciente", A, "falso", atendida, 5, null)).r === false, "con un token falso no califica")
  const largo = await comoAnon("calificar_atencion_paciente", B, "tok-B", deB, 4, "x".repeat(900))
  ok(largo.r === true && (await q("select length(comentario) l from respuestas_satisfaccion where cita_id = $1", [deB]))[0].l === 500, "el comentario se corta en 500 caracteres")
  const d2 = await comoAnon("mis_citas_detalle_paciente", A, "tok-A")
  ok(d2.r.find((x) => x.cita_id === atendida).calificacion?.puntaje === 5 && d2.r.find((x) => x.cita_id === futura).confirmada_at !== null, "el detalle ya trae la calificación y la confirmación")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
