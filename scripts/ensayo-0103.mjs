// Ensayo de la migración 0103 (la reserva web y el reagendado del portal validan día y hora): la aplica dentro de una
// transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0103.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0103_reserva_web_valida_horario.sql", import.meta.url), "utf8")
const DIAS = ["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"]
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const abierto = (d) => d?.manana?.activo || d?.tarde?.activo

// Primera fecha (desde marzo de 2027) cuyo día de la semana cumple la condición, en "AAAA-MM-DD".
const fechaDonde = (semanal, cumple) => {
  for (let i = 0; i < 14; i++) {
    const d = new Date(Date.UTC(2027, 2, 1 + i))
    if (cumple(semanal[DIAS[d.getUTCDay()]])) return d.toISOString().slice(0, 10)
  }
  return null
}
const aAmPm = (hhmm, desplazarMin = 0) => {
  const [h, m] = hhmm.split(":").map(Number)
  const t = h * 60 + m + desplazarMin
  const hh = Math.floor(t / 60), mm = t % 60
  return `${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`
}

try {
  await c.query("begin")
  const { id: optica, semanal } = await c.query("select o.id, d.horario_semanal semanal from opticas o join disponibilidad d on d.optica_id = o.id where o.slug = 'v8twzq'").then((r) => r.rows[0])
  const ced = (await c.query("select cedula from pacientes where optica_id = $1 and cedula is not null limit 1", [optica])).rows[0].cedula
  const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where proname = $1", [n])).rows[0].n
  const antes = [await sobrecargas("crear_cita_publica"), await sobrecargas("reagendar_cita_publica")]
  await c.query(sql)
  ok(true, "se aplica sin errores")
  ok((await sobrecargas("crear_cita_publica")) === antes[0] && (await sobrecargas("reagendar_cita_publica")) === antes[1] && antes[0] === 1 && antes[1] === 1, "sigue habiendo una sola crear_cita_publica y una sola reagendar_cita_publica")

  const como = async (rol, fn) => {
    await c.query("savepoint r")
    try { await c.query(`set local role ${rol}`); return { r: await fn() } } catch (e) { return { e: e.message } } finally { await c.query("rollback to savepoint r"); await c.query("reset role") }
  }
  const reservar = (fecha, hora, opticaId = optica) => como("anon", async () =>
    (await c.query("select * from crear_cita_publica($1,'ENSAYO 0103',$2,$3,$4,'1990-01-01','0999999999','Consulta General',null,null,null)", [opticaId, fecha, hora, ced])).rows[0])
  const poner = (excepciones, semanalNuevo = semanal) => c.query("update disponibilidad set excepciones = $2::jsonb, horario_semanal = $3::jsonb where optica_id = $1", [optica, JSON.stringify(excepciones), JSON.stringify(semanalNuevo)])

  const fAbierto = fechaDonde(semanal, abierto)
  const fCerrado = fechaDonde(semanal, (d) => !abierto(d))
  const diaAb = semanal[DIAS[new Date(fAbierto + "T00:00:00Z").getUTCDay()]]
  const sesion = diaAb.manana?.activo ? diaAb.manana : diaAb.tarde
  console.log(`  (día abierto ${fAbierto}, sesión ${sesion.inicio}–${sesion.fin}; día cerrado ${fCerrado})`)
  const abrir = { manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } }
  const cerrar = { manana: { activo: false, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } }

  // ── Reserva web
  let x = await reservar(fAbierto, aAmPm(sesion.inicio))
  ok(!!x.r && /^CIT-2027-/.test(x.r.codigo), "reserva web válida (día del horario habitual, hora de inicio de la sesión): " + x.r?.codigo)
  x = await reservar(fAbierto, aAmPm(sesion.fin, -40)); ok(!!x.r, "también la última hora que cabe antes del cierre")
  x = await reservar(fAbierto, aAmPm(sesion.fin)); ok(/fuera del horario/.test(x.e || ""), "la hora de cierre queda fuera: " + x.e)
  x = await reservar(fAbierto, aAmPm(sesion.inicio, -20)); ok(/fuera del horario/.test(x.e || ""), "antes de abrir: " + x.e)
  x = await reservar(fAbierto, "11:30 PM"); ok(/fuera del horario/.test(x.e || ""), "de noche: " + x.e)
  x = await reservar(fAbierto, "25:99 AM"); ok(/hora no es válida/.test(x.e || ""), "hora mal escrita: " + x.e)
  x = await reservar(fCerrado, "10:00 AM"); ok(/no atiende/.test(x.e || ""), "día cerrado: " + x.e)

  // ── Excepciones
  await poner({ [fCerrado]: abrir })
  x = await reservar(fCerrado, "10:00 AM")
  ok(/no admite reservas en línea/.test(x.e || ""), "día abierto de forma excepcional (normalmente cerrado): solo personal: " + x.e)
  await poner({ [fAbierto]: { manana: { activo: true, inicio: "10:00", fin: "12:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } } })
  x = await reservar(fAbierto, "10:00 AM"); ok(!!x.r, "excepción que solo cambia las horas de un día habitual: sigue admitiendo reservas web")
  x = await reservar(fAbierto, "09:00 AM"); ok(/fuera del horario/.test(x.e || ""), "…y respeta esas horas: " + x.e)
  await poner({ [fAbierto]: cerrar })
  x = await reservar(fAbierto, "10:00 AM"); ok(/no atiende/.test(x.e || ""), "excepción que cierra un día habitual (feriado): no reserva")
  await poner({ [fAbierto]: { ...cerrar, nombre: "Feriado: Día de los Difuntos" } })
  x = await reservar(fAbierto, "10:00 AM"); ok(/no atiende/.test(x.e || ""), "feriado con nombre: tampoco reserva")
  // Un domingo que está en el horario habitual de la óptica admite reservas web
  const conDomingo = { ...semanal, domingo: abrir }
  const fDomingo = fechaDonde(conDomingo, (d) => d === abrir)
  await poner({}, conDomingo)
  x = await reservar(fDomingo, "10:00 AM"); ok(!!x.r, "un domingo del horario habitual de la óptica admite reservas web (" + fDomingo + ")")
  await poner({}, semanal)

  // ── Óptica sin horario configurado: no se valida
  const sin = (await c.query("select o.id from opticas o left join disponibilidad d on d.optica_id = o.id where d.optica_id is null and o.activa limit 1")).rows[0]
  if (sin) {
    x = await reservar("2027-03-07", "10:00 AM", sin.id)
    ok(!!x.r || !/no atiende|fuera del horario|reservas en línea/.test(x.e || ""), "óptica sin horario configurado: no se valida (" + (x.r ? "reservó" : x.e) + ")")
  }

  // ── Reagendado desde el portal
  const cita = (await c.query("select * from crear_cita_publica($1,'ENSAYO 0103',$2,$3,$4,'1990-01-01','0999999999','Consulta General',null,null,null)", [optica, fAbierto, aAmPm(sesion.inicio), ced])).rows[0]
  const { paciente_id: pacienteId } = (await c.query("select paciente_id from citas_base where id = $1", [cita.id])).rows[0]
  await c.query("update pacientes_base set sesion_token = 'tok-ensayo', sesion_token_creado_en = now() where id = $1", [pacienteId])
  const reagendar = (fecha, hora) => como("anon", async () => (await c.query("select reagendar_cita_publica($1,$2,$3,$4,'tok-ensayo') ok", [cita.id, pacienteId, fecha, hora])).rows[0].ok)
  const fAbierto2 = (() => { const d = new Date(fAbierto + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + 7); return d.toISOString().slice(0, 10) })()
  x = await reagendar(fAbierto2, aAmPm(sesion.inicio, 40)); ok(x.r === true, "reagendado válido desde el portal: " + JSON.stringify(x))
  x = await reagendar(fCerrado, "10:00 AM"); ok(/no atiende/.test(x.e || ""), "reagendar a un día cerrado: " + x.e)
  x = await reagendar(fAbierto2, "11:30 PM"); ok(/fuera del horario/.test(x.e || ""), "reagendar a una hora fuera del horario: " + x.e)
  x = await reagendar(fAbierto2, "xx"); ok(/hora no es válida/.test(x.e || ""), "reagendar con hora mal escrita: " + x.e)
  await poner({ [fCerrado]: abrir })
  x = await reagendar(fCerrado, "10:00 AM"); ok(/no admite reservas en línea/.test(x.e || ""), "reagendar a un día abierto de forma excepcional: " + x.e)
  await poner({}, semanal)
  x = await como("anon", async () => (await c.query("select reagendar_cita_publica($1,$2,$3,$4,'otro-token') ok", [cita.id, pacienteId, fAbierto2, aAmPm(sesion.inicio)])).rows[0].ok)
  ok(x.r === false, "sin sesión válida sigue devolviendo false (no cambia)")

  // ── Permisos
  const p = (await c.query(`select has_function_privilege('anon','public.validar_horario_reserva_web(uuid,date,text)','execute') a, has_function_privilege('authenticated','public.validar_horario_reserva_web(uuid,date,text)','execute') u,
    has_function_privilege('anon','public.crear_cita_publica(uuid,text,date,text,text,date,text,text,text,text,jsonb)','execute') w,
    has_function_privilege('anon','public.reagendar_cita_publica(uuid,uuid,date,text,text)','execute') rg`)).rows[0]
  ok(!p.a && !p.u && p.w && p.rg, "la validación no se llama desde fuera; la reserva web y el reagendado siguen públicos")
} catch (e) { fallos++; console.error("✘ Error:", e.message) }
finally {
  await c.query("rollback"); await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó.` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
