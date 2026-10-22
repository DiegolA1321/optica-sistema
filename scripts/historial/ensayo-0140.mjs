// Ensayo de la migración 0140 (toda atención guardada tiene su cita): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/historial/ensayo-0140.mjs
import pg from "pg"
import fs from "node:fs"
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
try {
  await c.query("begin")
  const antes = (await q("select count(*)::int n from consultas_base where cita_id is null"))[0].n
  const citasAntes = (await q("select count(*)::int n from citas_base"))[0].n
  const detalleAntes = await q("select id, optica_id, paciente_id, paciente, fecha, motivo, profesional_id, created_at from consultas_base where cita_id is null")
  const otrasAntes = (await q("select md5(string_agg(id::text || estado || fecha::text || hora, ',' order by id)) h from citas_base"))[0].h
  const clinicoAntes = (await q("select md5(string_agg(id::text || coalesce(diagnostico,'') || coalesce(indicaciones,'') || coalesce(motivo,'') || fecha::text, ',' order by id)) h from consultas"))[0].h
  console.log(`Antes: ${antes} atenciones sin cita, ${citasAntes} citas`)
  ok(antes === 34, "son 34 las atenciones sin cita (13 Demo, 20 Solna Vision, 1 QA)")

  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0140_atenciones_sin_cita_con_su_cita.sql", import.meta.url), "utf8"))

  ok((await q("select count(*)::int n from consultas_base where cita_id is null"))[0].n === 0, "ya no queda ninguna atención sin cita")
  ok((await q("select count(*)::int n from citas_base"))[0].n === citasAntes + antes, `se crearon exactamente ${antes} citas`)
  const nuevas = await q(`select k.id kid, k.fecha kf, k.motivo km, k.profesional_id kp, k.paciente_id kpac, k.paciente knom, k.optica_id ko, b.*
                          from consultas_base k join citas_base b on b.id = k.cita_id where k.id = any($1)`, [detalleAntes.map((x) => x.id)])
  ok(nuevas.length === antes, "cada atención quedó enlazada a su propia cita")
  ok(new Set(nuevas.map((x) => x.id)).size === antes, "dos atenciones nunca comparten la misma cita")
  ok(nuevas.every((x) => x.estado === "Atendida" && x.origen === "presencial"), "todas nacen «Atendida» con origen «presencial»")
  ok(nuevas.every((x) => String(x.fecha.toISOString().slice(0, 10)) === String(x.kf.toISOString().slice(0, 10))), "la misma fecha de la consulta")
  ok(nuevas.every((x) => x.optica_id === x.ko && x.paciente_id === x.kpac && x.paciente === x.knom), "misma óptica, mismo paciente")
  ok(nuevas.every((x) => (x.kp ? x.asignado_a === x.kp && x.atendido_por === x.kp : x.asignado_a === null && x.atendido_por === null)), "el mismo profesional (nulo si la consulta no lo tenía)")
  ok(nuevas.every((x) => x.motivo === x.km), "el mismo motivo")
  ok(nuevas.every((x) => /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(x.hora)), "la hora en formato «HH:MM AM/PM»")
  ok(nuevas.every((x) => x.codigo), "todas tienen su código de cita")
  const dup = await q("select optica_id, fecha, hora, count(*)::int n from citas_base where estado <> 'Cancelada' group by 1,2,3 having count(*) > 1")
  ok(dup.length === 0, "ninguna cita activa comparte óptica, fecha y hora con otra")
  const ev = await q("select tipo, count(*)::int n from citas_eventos where cita_id = any($1) group by 1", [nuevas.map((x) => x.id)])
  ok(ev.length === 1 && ev[0].tipo === "agendada" && ev[0].n === antes, "solo dejó el evento «agendada» (no se inventó una atención de hoy)")
  ok((await q("select count(*)::int n from citas_eventos where cita_id = any($1) and tipo in ('atendida','en_atencion')", [nuevas.map((x) => x.id)]))[0].n === 0, "no disparó eventos de atención ni la encuesta de satisfacción")
  ok((await q("select md5(string_agg(id::text || estado || fecha::text || hora, ',' order by id)) h from citas_base where id <> all($1)", [nuevas.map((x) => x.id)]))[0].h === otrasAntes, "las demás citas quedaron idénticas")
  ok((await q("select md5(string_agg(id::text || coalesce(diagnostico,'') || coalesce(indicaciones,'') || coalesce(motivo,'') || fecha::text, ',' order by id)) h from consultas"))[0].h === clinicoAntes, "nada clínico cambió (diagnóstico, indicaciones, motivo y fecha)")
  const diego = await q("select count(*)::int n from citas where paciente ilike 'Diego alarcon dd' and fecha = '2026-10-07' and estado = 'Atendida'")
  ok(diego[0].n === 2, "Diego alarcon dd tiene 2 citas atendidas el 7 oct (el historial y la asistencia cuadran)")
  // repetirla no hace nada
  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0140_atenciones_sin_cita_con_su_cita.sql", import.meta.url), "utf8"))
  ok((await q("select count(*)::int n from citas_base"))[0].n === citasAntes + antes, "repetirla no crea nada más")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await c.query("rollback").catch(() => {}); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
