// Ensayo de la migración 0132 (respuesta a la solicitud de medidas de montaje): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0132.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, fn, ...args) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
const anon = (fn, ...a) => como("anon", null, fn, ...a)

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente 0132', cedula = '0900000071', usuario = null, clave_temporal = null, sesion_token = 'tok-M', sesion_token_creado_en = now(), anonimizado_en = null, medidas_solicitadas_en = null")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
  const claims = { sub: admin, role: "authenticated", aal: "aal2" }
  const staff = (fn, ...a) => como("authenticated", claims, fn, ...a)

  const abiertasAntes = (await q("select count(*)::int n from pacientes_base where medidas_solicitadas_en is not null and id <> $1", [P]))[0].n
  await c.query(leer("0132_medidas_de_montaje_respuesta.sql"))
  ok((await q("select count(*)::int n from pacientes_base where medidas_solicitadas_en is not null and id <> $1", [P]))[0].n === abiertasAntes, `las ${abiertasAntes} solicitudes abiertas que ya existían siguen abiertas`)
  for (const f of ["cerrar_solicitud_medidas", "mi_solicitud_medidas_paciente", "solicitar_medidas_paciente"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)
  }

  // ── el paciente pide ──
  ok((await anon("solicitar_medidas_paciente", P, "falso")).r === false, "con un token falso no pide")
  ok((await anon("solicitar_medidas_paciente", P, "tok-M")).r === true, "pide sus medidas")
  const pedida = (await q("select medidas_solicitadas_en t from pacientes_base where id = $1", [P]))[0].t
  ok(pedida !== null, "queda la marca de la solicitud")
  ok((await anon("solicitar_medidas_paciente", P, "tok-M")).r === true && (await q("select medidas_solicitadas_en t from pacientes_base where id = $1", [P]))[0].t.getTime() === pedida.getTime(), "pedirla otra vez no cambia la fecha")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'El paciente pidió sus medidas de montaje' and detalle = 'Paciente 0132'", [OP]))[0].n === 1, "queda UNA anotación en la actividad")
  const v1 = await anon("mi_solicitud_medidas_paciente", P, "tok-M")
  ok(v1.r?.abierta_desde && v1.r.ultima === null, "el paciente ve su solicitud abierta y ninguna respuesta aún")
  ok((await anon("mi_solicitud_medidas_paciente", P, "falso")).r === null, "con un token falso no ve nada")

  // ── la óptica responde ──
  ok((await anon("cerrar_solicitud_medidas", P, "enviadas", "62", "18")).e !== undefined, "un anónimo no puede cerrarla")
  ok((await staff("cerrar_solicitud_medidas", P, "enviadas", null, null)).e?.includes("No hay medidas"), "no se «envían» medidas vacías")
  ok((await staff("cerrar_solicitud_medidas", P, "cita", null, null)).e?.includes("Falta la fecha"), "una cita sin fecha y hora se rechaza")
  ok((await staff("cerrar_solicitud_medidas", P, "otra", "62", null)).e?.includes("no válido"), "un resultado inválido se rechaza")
  ok((await staff("cerrar_solicitud_medidas", P, "enviadas", "62", "18")).r === true, "la óptica marca las medidas como enviadas")
  ok((await q("select medidas_solicitadas_en t from pacientes_base where id = $1", [P]))[0].t === null, "la solicitud sale de «abiertas»")
  ok((await staff("cerrar_solicitud_medidas", P, "enviadas", "62", "18")).r === false, "cerrarla otra vez no hace nada (devuelve falso)")
  const v2 = await anon("mi_solicitud_medidas_paciente", P, "tok-M")
  ok(v2.r?.abierta_desde === null && v2.r.ultima?.resultado === "enviadas" && v2.r.ultima.dp === "62" && v2.r.ultima.altura === "18", "el paciente ve las medidas que le enviaron")
  ok(Object.keys(v2.r.ultima).sort().join() === "altura,cerrada,cita_fecha,cita_hora,dp,resultado,solicitada", "solo ve campos propios (nada del personal)")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'Envió las medidas de montaje al paciente' and detalle = 'Paciente 0132'", [OP]))[0].n === 1, "el envío queda en la actividad")

  // ── segunda solicitud, resuelta con una cita ──
  await anon("solicitar_medidas_paciente", P, "tok-M")
  ok((await staff("cerrar_solicitud_medidas", P, "cita", null, null, "2099-03-10", "03:00 PM")).r === true, "la óptica agenda la toma de medidas")
  const v3 = await anon("mi_solicitud_medidas_paciente", P, "tok-M")
  ok(v3.r?.ultima?.resultado === "cita" && v3.r.ultima.cita_fecha === "2099-03-10" && v3.r.ultima.cita_hora === "03:00 PM" && v3.r.ultima.dp === null, "el paciente ve «te esperamos» con la fecha y la hora")
  ok((await q("select count(*)::int n from solicitudes_medidas where paciente_id = $1", [P]))[0].n === 2, "quedan las dos respuestas en el historial")

  // ── nadie escribe directo ──
  const directo = await como("anon", null, "(select count(*) from solicitudes_medidas)")
  ok(directo.e !== undefined || Number(directo.r) === 0, "un anónimo no lee la tabla")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
