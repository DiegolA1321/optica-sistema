// Ensayo de las migraciones 0148 (datos públicos de «Quiénes somos») y 0149 (una hora, un profesional): las aplica dentro de una transacción y prueba el comportamiento.
// SIEMPRE revierte (rollback): no deja ningún cambio en la base. La prueba de dos confirmaciones SIMULTÁNEAS (dos conexiones) está en verificar-0149.mjs y se corre DESPUÉS de aplicar.
//
//   node --env-file=.env.local scripts/historial/ensayo-0148-0149.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (n) => fs.readFileSync(new URL(`../../supabase/migrations/${n}`, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

let n = 0
// Ejecuta fn; si lanza, devuelve el mensaje. Siempre deja la transacción usable (savepoint).
const intentar = async (fn, { revertir = false } = {}) => {
  const sp = `s${++n}`
  await c.query(`savepoint ${sp}`)
  try {
    const r = await fn()
    await c.query(revertir ? `rollback to savepoint ${sp}` : `release savepoint ${sp}`)
    return { r }
  } catch (e) {
    await c.query(`rollback to savepoint ${sp}`)
    return { e: e.message, code: e.code }
  }
}

const CEDULAS = ["1710034065", "0926687856", "0914546437", "1713175071", "1104680135"]
const web = (optica, cedula, fecha, hora, profesional = null) =>
  q("select * from crear_cita_publica($1, 'Paciente Ensayo', $2::date, $3, $4, '1990-03-12', '0991234567', 'Consulta General', 'Consulta General', null, null, 'web', $5)", [optica, fecha, hora, cedula, profesional])

try {
  await c.query("begin")
  const citasAntes = (await q("select count(*)::int n from citas_base"))[0].n
  const activasAntes = (await q("select count(*)::int n from citas_base where estado <> 'Cancelada'"))[0].n
  ok((await q("select count(*)::int n from (select optica_id, fecha, hora from citas_base where estado <> 'Cancelada' group by 1,2,3 having count(*) > 1) x"))[0].n === 0, "antes: ninguna cita activa choca con otra (el índice viejo ya lo impedía)")

  await c.query(leer("0148_pagina_publica_datos.sql"))
  ok(true, "0148 se aplica sin errores")
  await c.query(leer("0149_una_hora_un_profesional.sql"))
  ok(true, "0149 se aplica sin errores")

  ok((await q("select count(*)::int n from citas_base"))[0].n === citasAntes, "ninguna cita existente cambió (mismo total)")
  for (const nombre of ["crear_cita_publica", "reagendar_cita_publica", "horas_ocupadas_publicas"]) {
    const f = await q("select count(*)::int n from pg_proc p join pg_namespace s on s.oid = p.pronamespace where s.nspname = 'public' and p.proname = $1", [nombre])
    ok(f[0].n === 1, `queda UNA sola ${nombre} (sin sobrecargas)`)
  }
  ok((await q("select count(*)::int n from pg_indexes where indexname = 'citas_optica_fecha_hora_activa_idx'"))[0].n === 0 && (await q("select count(*)::int n from pg_indexes where indexname = 'citas_optica_fecha_hora_profesional_activa_idx'"))[0].n === 1, "el índice por óptica+hora se cambió por el de óptica+hora+profesional")

  // ── 0148 ──
  const opticas = await q("select o.id, o.nombre, (select count(*)::int from perfiles p where p.optica_id = o.id and p.activo and p.rol in ('admin','asistente') and p.es_optometra) pros, exists (select 1 from disponibilidad d where d.optica_id = o.id) tiene_horario from opticas o where o.activa order by o.nombre")
  const dos = opticas.find((o) => o.pros >= 2)
  const una = opticas.find((o) => o.pros === 1 && o.tiene_horario)
  const ninguna = opticas.find((o) => o.pros === 0)
  ok(!!dos && !!una, `hay una óptica con 2+ profesionales (${dos?.nombre}) y una con 1 (${una?.nombre}) para probar`)

  await c.query("savepoint anon"); await c.query("set local role anon")
  const pub = (await q("select pagina_publica_datos($1) d", [dos.id]))[0].d
  const claves = JSON.stringify(pub)
  ok(Array.isArray(pub.optometras) && pub.optometras.length === dos.pros && typeof Number(pub.pacientesAtendidos) === "number", `pagina_publica_datos (sin sesión) entrega ${pub.optometras.length} optómetra(s) y ${pub.pacientesAtendidos} paciente(s) atendidos`)
  ok(!/cedula|correo|email|permisos|telefono/i.test(claves), "no expone cédula, correo, teléfono ni permisos")
  const inexistente = (await q("select pagina_publica_datos('00000000-0000-0000-0000-000000000000') d"))[0].d
  ok(inexistente === null, "una óptica que no existe (o suspendida) no devuelve nada")
  await c.query("rollback to savepoint anon"); await c.query("reset role")

  // ── 0149 con 2+ profesionales ──
  // Un día de atención en que los 2 trabajan a las 10:00 AM (se busca en las próximas semanas, según el horario real).
  const hora = "10:00 AM"
  let dia = null
  for (let i = 1; i < 60 && !dia; i++) {
    const f = (await q("select (current_date + $1::int)::text f", [i]))[0].f
    const libres = await q("select count(*)::int n from _profesionales_libres($1, $2::date, 600, _dia_optica($1, $2::date))", [dos.id, f])
    const d = await q("select _dia_optica($1, $2::date) d", [dos.id, f])
    // Que el día admita reserva web (no una excepción abierta a mano): lo comprueba la propia función.
    if (libres[0].n >= 2) {
      const v = await intentar(() => q("select validar_horario_reserva_web($1, $2::date, $3)", [dos.id, f, hora]), { revertir: true })
      if (!v.e && d[0].d) dia = f
    }
  }
  ok(!!dia, `hay un día (${dia}) en que los 2 profesionales de ${dos?.nombre} atienden a las ${hora}`)
  if (dia) {
    const libreAntes = await q("select count(*)::int n from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado <> 'Cancelada'", [dos.id, dia, hora])
    ok(libreAntes[0].n === 0, "esa hora está sin citas (el ensayo no pisa nada)")

    const a = await intentar(() => web(dos.id, CEDULAS[0], dia, hora))
    ok(!a.e && a.r[0].codigo, "primera reserva web «cualquiera disponible» → se crea" + (a.e ? " — " + a.e : ""))
    const b = await intentar(() => web(dos.id, CEDULAS[1], dia, hora))
    ok(!b.e && b.r[0].codigo, "segunda reserva a la misma hora → se crea con OTRO profesional" + (b.e ? " — " + b.e : ""))
    const asig = await q("select asignado_a from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado <> 'Cancelada'", [dos.id, dia, hora])
    ok(asig.length === 2 && asig[0].asignado_a && asig[1].asignado_a && asig[0].asignado_a !== asig[1].asignado_a, "las dos citas quedaron con profesionales distintos")
    const t = await intentar(() => web(dos.id, CEDULAS[2], dia, hora))
    ok(!!t.e && /acaba de ocuparse/.test(t.e), "tercera reserva (los 2 ocupados) → «Esa hora acaba de ocuparse. Elige otra.»" + (t.e ? "" : " — NO falló"))

    // Profesional en particular, ocupado.
    const ocupado = asig[0].asignado_a
    const e = await intentar(() => web(dos.id, CEDULAS[3], dia, hora, ocupado))
    ok(!!e.e && /acaba de ocuparse/.test(e.e), "pedir al profesional que ya tiene esa hora → «Esa hora acaba de ocuparse»")

    // El personal: misma hora, mismo profesional, insert directo en la tabla (Gestionar cita / Atender ahora / mover).
    const pac = (await q("select id, nombre, cedula from pacientes_base where optica_id = $1 limit 1", [dos.id]))[0]
    const dir = (asignado) => q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado, origen, asignado_a) values ($1, $2, $3, $4, $5, $6, 'x', 'Pendiente', 'presencial', $7)", [dos.id, pac.id, pac.nombre, pac.cedula, dia, hora, asignado])
    const d1 = await intentar(() => dir(ocupado))
    ok(!!d1.e && d1.code === "23505", "el personal, insert directo al mismo profesional y hora → rechazado por la base (23505): " + d1.e)
    const d2 = await intentar(() => dir(null))
    ok(!d2.e, "una cita sin profesional a esa hora (con 2+ profesionales) no choca con las asignadas" + (d2.e ? " — " + d2.e : ""))
    const d3 = await intentar(() => dir(null))
    ok(!!d3.e && d3.code === "23505", "pero dos citas SIN profesional a la misma hora sí chocan")

    // Mover una cita a una hora ocupada del mismo profesional.
    const libreOtra = "10:20 AM"
    const m = await intentar(() => q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado, origen, asignado_a) values ($1, $2, $3, $4, $5, $6, 'x', 'Pendiente', 'presencial', $7) returning id", [dos.id, pac.id, pac.nombre, pac.cedula, dia, libreOtra, ocupado]))
    ok(!m.e, "una cita en otra hora libre del mismo profesional se crea")
    if (!m.e) {
      const mover = await intentar(() => q("update citas_base set hora = $1 where id = $2", [hora, m.r[0].id]))
      ok(!!mover.e && mover.code === "23505", "moverla a la hora ocupada de ese profesional → rechazado (reagendar / mover citas)")
    }

    // Cancelar libera la hora.
    await q("update citas_base set estado = 'Cancelada' where optica_id = $1 and fecha = $2 and hora = $3 and asignado_a = $4", [dos.id, dia, hora, ocupado])
    const r2 = await intentar(() => web(dos.id, CEDULAS[3], dia, hora, ocupado))
    ok(!r2.e, "cancelada la cita, esa hora vuelve a poder reservarse" + (r2.e ? " — " + r2.e : ""))

    // Lo que ve el público.
    await c.query("savepoint anon2"); await c.query("set local role anon")
    const oc = await q("select * from horas_ocupadas_publicas($1) where fecha = $2::date and hora = $3", [dos.id, dia, hora])
    ok(oc.length >= 1 && "asignado_a" in oc[0] && !("paciente" in oc[0]) && !("cedula" in oc[0]), "horas_ocupadas_publicas incluye asignado_a y sigue sin datos de personas")
    await c.query("rollback to savepoint anon2"); await c.query("reset role")
  }

  // ── 0149 con 1 profesional: la hora sigue siendo una sola para toda la óptica ──
  let diaUna = null
  for (let i = 1; i < 60 && !diaUna; i++) {
    const f = (await q("select (current_date + $1::int)::text f", [i]))[0].f
    const libres = await q("select count(*)::int n from _profesionales_libres($1, $2::date, 600, _dia_optica($1, $2::date))", [una.id, f])
    if (libres[0].n === 1) {
      const v = await intentar(() => q("select validar_horario_reserva_web($1, $2::date, $3)", [una.id, f, hora]), { revertir: true })
      if (!v.e) diaUna = f
    }
  }
  ok(!!diaUna, `hay un día (${diaUna}) en que el profesional de ${una?.nombre} atiende a las ${hora}`)
  if (diaUna) {
    const w = await intentar(() => web(una.id, CEDULAS[0], diaUna, hora))
    ok(!w.e, "reserva web con 1 profesional → se asigna a él" + (w.e ? " — " + w.e : ""))
    const pac = (await q("select id, nombre, cedula from pacientes_base where optica_id = $1 limit 1", [una.id]))[0] || (await q("select id, nombre, cedula from pacientes_base where cedula = $1 limit 1", [CEDULAS[0]]))[0]
    const sin = await intentar(() => q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado, origen) values ($1, $2, $3, $4, $5, $6, 'x', 'Pendiente', 'presencial')", [una.id, pac.id, pac.nombre, pac.cedula, diaUna, hora]))
    ok(!!sin.e && sin.code === "23505", "el personal, cita sin profesional a esa hora (ya tomada) → rechazado: la hora es una sola con 1 profesional")
  }

  // ── 0149 sin profesionales marcados: todo como antes ──
  if (ninguna) {
    let diaN = null
    for (let i = 1; i < 60 && !diaN; i++) {
      const f = (await q("select (current_date + $1::int)::text f", [i]))[0].f
      const v = await intentar(() => q("select validar_horario_reserva_web($1, $2::date, $3)", [ninguna.id, f, hora]), { revertir: true })
      if (!v.e) diaN = f
    }
    if (diaN) {
      const w1 = await intentar(() => web(ninguna.id, CEDULAS[0], diaN, hora))
      const w2 = await intentar(() => web(ninguna.id, CEDULAS[1], diaN, hora))
      ok(!w1.e && !!w2.e && /acaba de ocuparse/.test(w2.e), `${ninguna.nombre} (sin profesionales marcados): una hora, una cita, como antes`)
      const asignada = await q("select asignado_a from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado <> 'Cancelada'", [ninguna.id, diaN, hora])
      ok(asignada.length === 1 && asignada[0].asignado_a === null, "y la cita queda sin profesional, como antes")
    }
  }

  ok((await q("select count(*)::int n from citas_base where estado <> 'Cancelada'"))[0].n >= activasAntes, "(dentro del ensayo) nada se borró")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback")
  const col = await q("select count(*)::int n from information_schema.columns where table_name = 'perfiles' and column_name = 'foto_url'")
  const idx = await q("select count(*)::int n from pg_indexes where indexname = 'citas_optica_fecha_hora_activa_idx'")
  console.log(`Revertido: perfiles.foto_url ${col[0].n === 0 ? "ausente" : "PRESENTE (¡no revirtió!)"}, índice viejo ${idx[0].n === 1 ? "de vuelta" : "AUSENTE (¡no revirtió!)"}.`)
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nEnsayo limpio: todo bien y revertido.")
process.exit(fallos ? 1 : 0)
