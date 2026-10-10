// Ensayo de la migración 0106 (anticipación mínima para cambiar o cancelar una cita desde el portal, validada en el servidor con la hora de
// Ecuador): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0106.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0106_anticipacion_cambio_cita_portal.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
const aAmPm = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}` }

// Ejecuta fn como la API (anon) y deshace lo que haga, devolviendo el resultado o el mensaje de error.
const comoAnon = async (fn, conservar = false) => {
  await c.query("savepoint r")
  try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); if (!conservar) await c.query("rollback to savepoint r"); return { r } }
  catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}

try {
  await c.query("begin")
  const [op] = await q("select id, settings from opticas where slug = 'v8twzq'")
  const OP = op.id
  const [disp] = await q("select horario_semanal, excepciones from disponibilidad where optica_id = $1", [OP])
  const sesionDe = (fecha) => { const ex = disp.excepciones?.[fecha]; const d = ex || disp.horario_semanal[DIAS[new Date(fecha + "T12:00:00Z").getUTCDay()]]; return d?.manana?.activo ? d.manana : d?.tarde?.activo ? d.tarde : null }
  const abiertoDesde = (n) => { for (let i = n; i < n + 40; i++) { const f = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10); const s = sesionDe(f); if (s) return { fecha: f, hora: aAmPm(s.inicio) } } }
  const cerrado = (() => { for (let i = 2; i < 40; i++) { const f = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10); if (!sesionDe(f)) return f } })()
  const dia1 = abiertoDesde(5), dia2 = abiertoDesde(9)

  const antesOverloads = (await q("select count(*)::int n from pg_proc where proname in ('reagendar_cita_publica','cancelar_cita_publica')"))[0].n
  const aclAntes = JSON.stringify((await q("select proname, proacl::text from pg_proc where proname in ('reagendar_cita_publica','cancelar_cita_publica') order by proname")))
  await c.query(sql)
  ok(true, "la migración se aplica sin errores")
  ok((await q("select count(*)::int n from pg_proc where proname in ('reagendar_cita_publica','cancelar_cita_publica')"))[0].n === antesOverloads && antesOverloads === 2, "sin sobrecargas: una sola versión de cada función")
  ok(JSON.stringify((await q("select proname, proacl::text from pg_proc where proname in ('reagendar_cita_publica','cancelar_cita_publica') order by proname"))) === aclAntes, "los permisos de las dos funciones quedan iguales")
  const interna = await comoAnon(() => c.query("select validar_cambio_cita_portal(gen_random_uuid(), gen_random_uuid())"))
  ok(!!interna.e, "la función de apoyo no se puede llamar desde la API: " + (interna.e || "").slice(0, 60))

  // ── Datos: paciente A (con sesión), paciente B (otro) y citas de prueba de A
  const [A] = await q(`select p.* from pacientes_base p where p.optica_id = $1 and p.anonimizado_en is null
                        and exists (select 1 from citas_base c where c.paciente_id = p.id) limit 1`, [OP])
  const clonarPaciente = async (cedula) => {
    await c.query("drop table if exists t_p"); await c.query("create temp table t_p as select * from pacientes_base where id = $1", [A.id])
    await c.query("update t_p set id = gen_random_uuid(), cedula = $1, usuario = null, clave_temporal = null, sesion_token = null", [cedula])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const B = await clonarPaciente("0900000009")
  await c.query("update pacientes_base set sesion_token = 'tok-A', sesion_token_creado_en = now() where id = $1", [A.id])
  await c.query("update pacientes_base set sesion_token = 'tok-B', sesion_token_creado_en = now() where id = $1", [B])
  const ahoraEc = async (minutos) => (await q("select to_char((now() at time zone 'America/Guayaquil') + make_interval(mins => $1), 'YYYY-MM-DD') f, to_char((now() at time zone 'America/Guayaquil') + make_interval(mins => $1), 'HH12:MI AM') h", [minutos]))[0]
  const nuevaCita = async (paciente, fecha, hora, estado = "Pendiente") => {
    await c.query("drop table if exists t_c"); await c.query("create temp table t_c as select * from citas_base where paciente_id = $1 limit 1", [A.id])
    await c.query("update t_c set id = gen_random_uuid(), paciente_id = $1, codigo = null, fecha = $2::date, hora = $3, estado = $4, recordatorio_enviado_at = null, confirmada_at = null, cancelada_por = null", [paciente, fecha, hora, estado])
    return (await q("insert into citas_base select * from t_c returning id"))[0].id
  }
  const poner = (settings) => c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || $2::jsonb where id = $1", [OP, JSON.stringify(settings)])
  const estadoDe = async (id) => (await q("select estado, fecha::text f, hora from citas_base where id = $1", [id]))[0]
  const reag = (cita, pac, tok, fecha, hora) => comoAnon(async () => (await c.query("select reagendar_cita_publica($1,$2,$3,$4,$5) r", [cita, pac, fecha, hora, tok])).rows[0].r, true)
  const canc = (cita, pac, tok) => comoAnon(async () => (await c.query("select cancelar_cita_publica($1,$2,$3) r", [cita, pac, tok])).rows[0].r, true)

  await poner({ permitirReagendarPaciente: true, horasAntesReagendar: 2 })
  // citas de A: lejana (más de 2 h), dos en el borde de 2 h, una muy cercana, una pasada, una atendida y una cancelada
  const lejana1 = await nuevaCita(A.id, dia1.fecha, dia1.hora)
  const lejana2 = await nuevaCita(A.id, dia2.fecha, dia2.hora)
  const f125 = await ahoraEc(125), f115 = await ahoraEc(115), f30 = await ahoraEc(30), fPas = await ahoraEc(-90)
  const dentro = await nuevaCita(A.id, f125.f, f125.h)   // faltan ~2 h 05: se puede
  const justoFuera = await nuevaCita(A.id, f115.f, f115.h) // faltan ~1 h 55: no
  const cercana = await nuevaCita(A.id, f30.f, f30.h)
  const pasada = await nuevaCita(A.id, fPas.f, fPas.h)
  const atendida = await nuevaCita(A.id, dia1.fecha, "10:30 AM", "Atendida")
  const deB = await nuevaCita(B, dia1.fecha, "11:30 AM")
  console.log(`   (hora de Ecuador ahora: ${(await ahoraEc(0)).f} ${(await ahoraEc(0)).h}; lejanas: ${dia1.fecha} ${dia1.hora} y ${dia2.fecha} ${dia2.hora})`)

  // ── Con más anticipación: se puede reagendar y cancelar
  let x = await reag(lejana1, A.id, "tok-A", dia2.fecha, "10:00 AM")
  const e1 = await estadoDe(lejana1)
  ok(!x.e && x.r === true && e1.f === dia2.fecha && e1.hora === "10:00 AM" && e1.estado === "Pendiente", "una cita con más de 2 horas se puede reagendar" + (x.e ? " — " + x.e : ""))
  x = await canc(lejana2, A.id, "tok-A")
  ok(!x.e && x.r === true && (await estadoDe(lejana2)).estado === "Cancelada", "una cita con más de 2 horas se puede cancelar" + (x.e ? " — " + x.e : ""))
  x = await reag(dentro, A.id, "tok-A", dia1.fecha, "11:00 AM")
  ok(!x.e && x.r === true, "en el borde por dentro (faltan ~2 h 05) se puede")

  // ── Con menos anticipación: se rechaza con un mensaje claro
  const antes = JSON.stringify(await estadoDe(justoFuera))
  x = await reag(justoFuera, A.id, "tok-A", dia1.fecha, "09:00 AM")
  ok(/hasta 2 horas antes/.test(x.e || "") && JSON.stringify(await estadoDe(justoFuera)) === antes, "faltan ~1 h 55: reagendar se rechaza — «" + x.e + "»")
  x = await canc(justoFuera, A.id, "tok-A")
  ok(/hasta 2 horas antes/.test(x.e || "") && (await estadoDe(justoFuera)).estado === "Pendiente", "faltan ~1 h 55: cancelar se rechaza — «" + x.e + "»")
  x = await canc(cercana, A.id, "tok-A"); ok(/hasta 2 horas antes/.test(x.e || ""), "faltan ~30 min: cancelar se rechaza")
  x = await reag(cercana, A.id, "tok-A", dia1.fecha, "09:00 AM"); ok(/hasta 2 horas antes/.test(x.e || ""), "faltan ~30 min: reagendar se rechaza")
  x = await canc(pasada, A.id, "tok-A"); ok(/hasta 2 horas antes/.test(x.e || ""), "una cita que ya pasó: se rechaza")

  // ── Otras reglas
  x = await reag(atendida, A.id, "tok-A", dia1.fecha, "09:30 AM")
  ok(/ya no se puede/.test(x.e || "") && (await estadoDe(atendida)).estado === "Atendida", "una cita atendida no se puede 'resucitar' reagendándola (antes la función la dejaba Pendiente) — «" + x.e + "»")
  x = await canc(lejana2, A.id, "tok-A"); ok(/ya no se puede/.test(x.e || ""), "una cita ya cancelada no se vuelve a cancelar")
  await poner({ permitirReagendarPaciente: false })
  x = await reag(lejana1, A.id, "tok-A", dia1.fecha, "09:30 AM"); ok(/no permite/.test(x.e || ""), "con la política apagada, reagendar se rechaza — «" + x.e + "»")
  x = await canc(lejana1, A.id, "tok-A"); ok(/no permite/.test(x.e || ""), "con la política apagada, cancelar se rechaza")
  await c.query("update opticas set settings = settings - 'permitirReagendarPaciente' where id = $1", [OP])
  x = await canc(lejana1, A.id, "tok-A"); ok(/no permite/.test(x.e || ""), "sin el dato en la configuración tampoco se permite (igual que la pantalla)")
  await poner({ permitirReagendarPaciente: true, horasAntesReagendar: 24 })
  const f600 = await ahoraEc(600); const diezH = await nuevaCita(A.id, f600.f, f600.h)
  x = await canc(diezH, A.id, "tok-A"); ok(/hasta 24 horas antes/.test(x.e || ""), "con 24 horas de anticipación configuradas, una cita a 10 horas se rechaza — «" + x.e + "»")
  await poner({ horasAntesReagendar: 1 })
  const f90 = await ahoraEc(90); const noventa = await nuevaCita(A.id, f90.f, f90.h)
  x = await canc(noventa, A.id, "tok-A"); ok(!x.e && x.r === true, "con 1 hora configurada, una cita a 90 minutos se puede cancelar")
  x = await canc(cercana, A.id, "tok-A"); ok(/hasta 1 hora antes/.test(x.e || ""), "…y el mensaje dice «1 hora» en singular — «" + x.e + "»")
  await poner({ horasAntesReagendar: 2 })

  // ── Seguridad y reglas anteriores
  x = await canc(deB, A.id, "tok-A"); ok(!x.e && x.r === false && (await estadoDe(deB)).estado === "Pendiente", "un paciente no puede cancelar la cita de otro (devuelve false, no cambia nada)")
  x = await reag(deB, B, "tok-A", dia1.fecha, "09:30 AM"); ok(x.r === false, "…ni con el id del otro y su propio token")
  x = await canc(lejana1, A.id, "token-inventado"); ok(x.r === false, "token inventado: rechazado")
  await c.query("update pacientes_base set sesion_token_creado_en = now() - interval '31 days' where id = $1", [A.id])
  x = await canc(lejana1, A.id, "tok-A"); ok(x.r === false && (await estadoDe(lejana1)).estado === "Pendiente", "sesión vencida (más de 30 días): ahora también se rechaza al cancelar")
  await c.query("update pacientes_base set sesion_token_creado_en = now() where id = $1", [A.id])
  if (cerrado) { x = await reag(lejana1, A.id, "tok-A", cerrado, "10:00 AM"); ok(/no atiende/.test(x.e || ""), "las reglas de horario de la 0103 siguen: día cerrado — «" + x.e + "»") }
  x = await reag(lejana1, A.id, "tok-A", dia1.fecha, "11:30 PM"); ok(/fuera del horario/.test(x.e || ""), "…y hora fuera del horario — «" + x.e + "»")
  x = await reag(lejana1, A.id, "tok-A", dia1.fecha, "25:99 AM"); ok(/hora no es válida/.test(x.e || ""), "…y hora mal escrita")
  const choque = await nuevaCita(A.id, dia1.fecha, "09:15 AM")
  x = await reag(lejana1, A.id, "tok-A", dia1.fecha, "09:15 AM"); ok(/ya no está disponible/.test(x.e || ""), "…y un horario ya ocupado — «" + x.e + "»")
  // el personal sigue cambiando citas por la vista, sin pasar por estas reglas
  await c.query("update citas_base set hora = '03:15 PM' where id = $1", [cercana])
  ok((await estadoDe(cercana)).hora === "03:15 PM", "el personal sigue pudiendo cambiar cualquier cita (las reglas son solo del portal)")
  void choque
} catch (e) {
  console.log("✘ error inesperado:", e.message); fallos++
} finally {
  await c.query("rollback"); await c.end()
}
console.log(fallos === 0 ? "\nTodo bien (la transacción se revirtió: nada cambió en la base)." : `\n${fallos} fallo(s). Se revirtió.`)
process.exit(fallos ? 1 : 0)
