// Ensayo de las reglas de 0148 y 0149 pedidas por Diego (complementa a ensayo-0148-0149.mjs): citas sin profesional, cruces por duración, estados que no ocupan la hora,
// foto y «Mostrarme en la página pública». Aplica ambas migraciones dentro de una transacción y SIEMPRE revierte.
//
//   node --env-file=.env.local scripts/historial/ensayo-0149-reglas.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (n) => fs.readFileSync(new URL(`../../supabase/migrations/${n}`, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
let n = 0
const intentar = async (fn) => {
  const sp = `s${++n}`
  await c.query(`savepoint ${sp}`)
  try { const r = await fn(); await c.query(`release savepoint ${sp}`); return { r } } catch (e) { await c.query(`rollback to savepoint ${sp}`); return { e: e.message, code: e.code } }
}
// Como una persona con sesión real (rol authenticated con sus claims); deshace lo que haga.
const como = async (uid, fn) => {
  const sp = `s${++n}`
  await c.query(`savepoint ${sp}`)
  try {
    await c.query("set local role authenticated")
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
    const r = await fn()
    await c.query("reset role"); await c.query(`rollback to savepoint ${sp}`)
    return { r }
  } catch (e) { await c.query(`rollback to savepoint ${sp}`); await c.query("reset role"); return { e: e.message } }
}

try {
  await c.query("begin")
  const demo = (await q("select id from opticas where nombre = 'Óptica Demo'"))[0].id
  const otra = (await q("select id from opticas where nombre like 'Óptica Vac%'"))[0].id
  const pros = await q("select id, nombre, rol, registro_profesional from perfiles where optica_id = $1 and activo and rol in ('admin','asistente') and es_optometra order by nombre", [demo])
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' and activo limit 1", [demo]))[0].id
  const noPro = (await q("select id from perfiles where optica_id = $1 and activo and not coalesce(es_optometra, false) limit 1", [demo]))[0]?.id
  const adminOtra = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' and activo limit 1", [otra]))[0].id
  const [A, B] = pros
  ok(pros.length >= 2, `Óptica Demo tiene ${pros.length} profesionales (${pros.map((p) => p.nombre).join(", ")})`)

  // ── Antes: cuántas citas vigentes hay sin profesional ──
  const sinProAntes = await q("select o.nombre, count(*)::int n, count(*) filter (where cb.fecha >= current_date)::int futuras from citas_base cb join opticas o on o.id = cb.optica_id where cb.asignado_a is null and cb.estado not in ('Cancelada','No Asistió') group by 1")
  console.log("   citas ACTIVAS sin profesional antes:", JSON.stringify(sinProAntes))
  const eventosAntes = (await q("select count(*)::int n from citas_eventos"))[0].n

  await c.query(leer("0148_pagina_publica_datos.sql"))
  await c.query(leer("0149_una_hora_un_profesional.sql"))
  ok(true, "0148 y 0149 se aplican sin errores")

  // ── Punto 1: citas sin profesional ──
  const futurasSin = await q("select count(*)::int n from citas_base cb where cb.asignado_a is null and cb.fecha >= current_date and cb.estado not in ('Cancelada','No Asistió') and exists (select 1 from perfiles p where p.optica_id = cb.optica_id and p.activo and p.rol in ('admin','asistente') and p.es_optometra)")
  ok(futurasSin[0].n === 0, "tras la migración, ninguna cita futura y activa de una óptica con profesionales queda sin profesional")
  console.log("   eventos de citas nuevos por la asignación:", (await q("select count(*)::int n from citas_eventos"))[0].n - eventosAntes)

  // Un día en que los dos atienden a las 10:00 AM y hay hueco.
  let dia = null
  for (let i = 1; i < 60 && !dia; i++) {
    const f = (await q("select (current_date + $1::int)::text f", [i]))[0].f
    const libres = (await q("select count(*)::int n from _profesionales_libres($1, $2::date, 600, _dia_optica($1, $2::date))", [demo, f]))[0].n
    const ocupadas = (await q("select count(*)::int n from citas_base where optica_id = $1 and fecha = $2 and estado not in ('Cancelada','No Asistió')", [demo, f]))[0].n
    if (libres >= 2 && ocupadas === 0) dia = f
  }
  ok(!!dia, `hay un día limpio (${dia}) con los dos profesionales atendiendo`)
  const pac = (await q("select id, nombre, cedula from pacientes_base where optica_id = $1 limit 1", [demo]))[0]
  const ins = (hora, asignado, extra = {}) => q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado, origen, asignado_a, duracion_minutos) values ($1,$2,$3,$4,$5,$6,'x',$7,'presencial',$8,$9) returning id, asignado_a", [demo, pac.id, pac.nombre, pac.cedula, dia, hora, extra.estado || "Pendiente", asignado, extra.duracion ?? null])

  if (dia) {
    // Cualquiera disponible / sin profesional: se asigna uno libre al guardar (todo camino de escritura).
    const s1 = await intentar(() => ins("09:00 AM", null))
    ok(!s1.e && s1.r[0].asignado_a, "personal: una cita guardada sin profesional recibe uno libre al confirmar" + (s1.e ? " — " + s1.e : ""))
    const s2 = await intentar(() => ins("09:00 AM", null))
    ok(!s2.e && s2.r[0].asignado_a && s2.r[0].asignado_a !== s1.r[0]?.asignado_a, "otra sin profesional a la misma hora recibe el OTRO profesional")
    const s3 = await intentar(() => ins("09:00 AM", null))
    ok(!!s3.e && s3.code === "23505", "una tercera, con los dos ocupados, se rechaza («" + s3.e + "»)")

    // ── Punto 2: cruces por duración ──
    const a1 = await intentar(() => ins("10:00 AM", A.id))
    ok(!a1.e, "cita de A a las 10:00 (40 min)" + (a1.e ? " — " + a1.e : ""))
    const cruce = await intentar(() => ins("10:20 AM", A.id))
    ok(!!cruce.e && cruce.code === "23505", "otra de A a las 10:20 (cruza 10:00–10:40) se rechaza: " + cruce.e)
    const pegada = await intentar(() => ins("10:40 AM", A.id))
    ok(!pegada.e, "otra de A a las 10:40 (empieza cuando termina la primera) se acepta")
    const deB = await intentar(() => ins("10:20 AM", B.id))
    ok(!deB.e, "otra de B a las 10:20 (otro profesional) se acepta")
    const larga = await intentar(() => ins("11:20 AM", A.id, { duracion: 60 }))
    ok(!larga.e, "cita de A a las 11:20 de 60 minutos (hasta 12:20)")
    const cruceLarga = await intentar(() => ins("12:00 PM", A.id))
    ok(!!cruceLarga.e && cruceLarga.code === "23505", "otra de A a las 12:00 se cruza con la de 60 minutos y se rechaza")

    // Mover una cita a un hueco que cruza.
    const mov = await intentar(() => q("update citas_base set hora = '10:20 AM' where id = $1", [pegada.r[0].id]))
    ok(!!mov.e && mov.code === "23505", "mover la de las 10:40 a las 10:20 (cruza con la de las 10:00) se rechaza")

    // ── Estados que no ocupan la hora ──
    const noEf = await intentar(() => ins("02:00 PM", A.id, { estado: "No Asistió" }))
    const sobre = await intentar(() => ins("02:00 PM", A.id))
    ok(!noEf.e && !sobre.e, "una cita «No efectuada» no ocupa la hora: otra de A a la misma hora se acepta")
    const revive = await intentar(() => q("update citas_base set estado = 'Pendiente' where id = $1", [noEf.r[0].id]))
    ok(!!revive.e && revive.code === "23505", "volver a poner «Pendiente» la no efectuada, con la hora ya tomada, se rechaza")
    const canc = await intentar(async () => { const x = await ins("03:00 PM", A.id); await q("update citas_base set estado = 'Cancelada' where id = $1", [x[0].id]); return ins("03:00 PM", A.id) })
    ok(!canc.e, "una cita cancelada no ocupa la hora")
    // Lo que ve el público no incluye las no efectuadas ni las canceladas.
    const oc = await q("select hora, estado from horas_ocupadas_publicas($1) where fecha = $2::date", [demo, dia])
    ok(oc.every((r) => !["Cancelada", "No Asistió"].includes(r.estado)), "horas_ocupadas_publicas no lista canceladas ni no efectuadas")

    // Marcar atendida una cita (aunque tuviera un vecino) nunca se bloquea.
    const atendida = await intentar(() => q("update citas_base set estado = 'Atendida' where id = $1", [a1.r[0].id]))
    ok(!atendida.e, "cambiar el estado de una cita (atendida) no se bloquea por sus vecinas")
  }

  // Cruces ya existentes (citas activas del mismo profesional que se solapan): no se tocan, solo se informan.
  const cruzadasHoy = await q(`select count(*)::int n from citas_base a join citas_base b on a.optica_id = b.optica_id and a.fecha = b.fecha and a.id < b.id
      and a.estado not in ('Cancelada','No Asistió') and b.estado not in ('Cancelada','No Asistió') and a.asignado_a is not distinct from b.asignado_a
      and _minutos_hora(a.hora) is not null and _minutos_hora(b.hora) is not null
      and _minutos_hora(a.hora) < _minutos_hora(b.hora) + coalesce(b.duracion_minutos, 40) and _minutos_hora(b.hora) < _minutos_hora(a.hora) + coalesce(a.duracion_minutos, 40)
      and a.fecha >= current_date`)
  console.log("   parejas de citas FUTURAS activas del mismo profesional que ya se cruzan:", cruzadasHoy[0].n)
  const cruzadasPasadas = await q(`select count(*)::int n from citas_base a join citas_base b on a.optica_id = b.optica_id and a.fecha = b.fecha and a.id < b.id
      and a.estado not in ('Cancelada','No Asistió') and b.estado not in ('Cancelada','No Asistió') and a.asignado_a is not distinct from b.asignado_a
      and _minutos_hora(a.hora) is not null and _minutos_hora(b.hora) is not null
      and _minutos_hora(a.hora) < _minutos_hora(b.hora) + coalesce(b.duracion_minutos, 40) and _minutos_hora(b.hora) < _minutos_hora(a.hora) + coalesce(a.duracion_minutos, 40)
      and a.fecha < current_date`)
  console.log("   parejas PASADAS que se cruzan (no se tocan):", cruzadasPasadas[0].n)

  // ── Punto 3: foto y «Mostrarme en la página pública» ──
  await c.query("savepoint pub"); await c.query("set local role anon")
  let d = (await q("select pagina_publica_datos($1) d", [demo]))[0].d
  ok(d.optometras.length === 0 && Number(d.optometrasTotal) === pros.length, `por defecto la página pública no muestra a nadie (${d.optometras.length}) y el total es solo un número (${d.optometrasTotal})`)
  ok(!/cedula|correo|email|telefono|paciente_id/i.test(JSON.stringify(d)), "pagina_publica_datos no trae ningún dato de pacientes: solo totales")
  const ag = (await q("select profesionales_agendamiento($1) d", [demo]))[0].d
  ok(ag.length === pros.length && ag.every((p) => p.registro === null), "el agendamiento lista a quienes atienden (nombre y foto), sin registro mientras no activen «mostrarme»")
  await c.query("rollback to savepoint pub"); await c.query("reset role")

  const url = `https://x.supabase.co/storage/v1/object/public/logos/${demo}/fotos/${A.id}.png`
  const r1 = await como(A.id, async () => {
    await q("select guardar_mi_foto($1)", [url])
    await q("select guardar_mi_visibilidad_publica(true)")
    await c.query("set local role anon")
    const pub = (await q("select pagina_publica_datos($1) d", [demo]))[0].d
    const ag2 = (await q("select profesionales_agendamiento($1) d", [demo]))[0].d
    return { pub, ag2 }
  })
  ok(!r1.e && r1.r.pub.optometras.length === 1 && r1.r.pub.optometras[0].foto === url && r1.r.pub.optometras[0].id === A.id, "la propia persona sube su foto y activa «mostrarme»: aparece ELLA sola en la página pública" + (r1.e ? " — " + r1.e : ""))
  ok(!r1.e && r1.r.ag2.find((p) => p.id === B.id)?.registro === null && r1.r.ag2.find((p) => p.id === A.id)?.foto === url, "el agendamiento muestra su foto; el registro solo de quien activó")
  const r2 = await como(A.id, () => q("select guardar_mi_foto('https://x.supabase.co/storage/v1/object/public/logos/00000000-0000-0000-0000-000000000000/f.png')"))
  ok(!!r2.e, "una foto de la carpeta de OTRA óptica se rechaza: " + r2.e)
  if (noPro) {
    const r3 = await como(noPro, () => q("select guardar_mi_visibilidad_publica(true)"))
    ok(!!r3.e, "quien no atiende pacientes no puede activar «mostrarme»: " + r3.e)
  }
  const r4 = await como(admin, async () => { await q("select guardar_foto_de($1, $2)", [B.id, `https://x.supabase.co/storage/v1/object/public/logos/${demo}/fotos/${B.id}.jpg`]); return (await q("select foto_url, mostrar_en_publica from perfiles where id = $1", [B.id]))[0] })
  ok(!r4.e && r4.r.foto_url && r4.r.mostrar_en_publica === false, "el administrador pone la foto de B, pero NO puede activarle «mostrarme»" + (r4.e ? " — " + r4.e : ""))
  const r5 = await como(adminOtra, () => q("select guardar_foto_de($1, null)", [B.id]))
  ok(!!r5.e, "el administrador de otra óptica no puede tocar la foto de B: " + r5.e)
  const r6 = await como(B.id, () => q("select guardar_foto_de($1, null)", [A.id]))
  ok(!!r6.e, "un profesional que no es administrador no puede cambiar la foto de otra persona: " + r6.e)
  const r7 = await como(A.id, async () => { try { await q("update perfiles set mostrar_en_publica = true where id = $1", [B.id]); } catch { /* sin permiso */ } return (await q("select mostrar_en_publica from perfiles where id = $1", [B.id]))[0]?.mostrar_en_publica })
  ok(r7.r !== true, "nadie puede activar el «mostrarme» de otra persona con un update directo")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nEnsayo limpio: todo bien y revertido.")
process.exit(fallos ? 1 : 0)
