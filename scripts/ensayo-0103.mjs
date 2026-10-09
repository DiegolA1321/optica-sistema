// Ensayo de la migración 0103 (la reserva web valida día y hora): la aplica dentro de una transacción y SIEMPRE revierte.
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

try {
  await c.query("begin")
  const { id: optica, semanal } = await c.query("select o.id, d.horario_semanal semanal from opticas o join disponibilidad d on d.optica_id = o.id where o.slug = 'v8twzq'").then((r) => r.rows[0])
  const ced = (await c.query("select cedula from pacientes where optica_id = $1 and cedula is not null limit 1", [optica])).rows[0].cedula
  const sobrecargas = async () => (await c.query("select count(*)::int n from pg_proc where proname = 'crear_cita_publica'")).rows[0].n
  const antes = await sobrecargas()
  await c.query(sql)
  ok(true, "se aplica sin errores")
  ok((await sobrecargas()) === antes && antes === 1, "sigue habiendo una sola crear_cita_publica")

  const reservar = async (opticaId, fecha, hora, rol = "anon") => {
    await c.query("savepoint r")
    try {
      await c.query(`set local role ${rol}`)
      const r = (await c.query("select * from crear_cita_publica($1,'ENSAYO 0103',$2,$3,$4,'1990-01-01','0999999999','Consulta General',null,null,null)", [opticaId, fecha, hora, ced])).rows[0]
      return { r }
    } catch (e) { return { e: e.message } } finally { await c.query("rollback to savepoint r"); await c.query("reset role") }
  }

  const fAbierto = fechaDonde(semanal, abierto)
  const fCerrado = fechaDonde(semanal, (d) => !abierto(d))
  const diaAb = semanal[DIAS[new Date(fAbierto + "T00:00:00Z").getUTCDay()]]
  const sesion = diaAb.manana?.activo ? diaAb.manana : diaAb.tarde
  const aAmPm = (hhmm, desplazarMin = 0) => {
    const [h, m] = hhmm.split(":").map(Number)
    const t = h * 60 + m + desplazarMin
    const hh = Math.floor(t / 60), mm = t % 60
    return `${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`
  }
  console.log(`  (día abierto ${fAbierto}, sesión ${sesion.inicio}–${sesion.fin}; día cerrado ${fCerrado})`)

  let x = await reservar(optica, fAbierto, aAmPm(sesion.inicio))
  ok(!!x.r && /^CIT-2027-/.test(x.r.codigo), "una reserva web válida (día abierto, hora de inicio de la sesión) sigue funcionando: " + x.r?.codigo)
  x = await reservar(optica, fAbierto, aAmPm(sesion.fin, -40))
  ok(!!x.r, "también la última hora que cabe antes del cierre de la sesión")
  x = await reservar(optica, fAbierto, aAmPm(sesion.fin))
  ok(/fuera del horario/.test(x.e || ""), "la hora de cierre ya queda fuera: " + x.e)
  x = await reservar(optica, fAbierto, aAmPm(sesion.inicio, -20))
  ok(/fuera del horario/.test(x.e || ""), "antes de abrir: " + x.e)
  x = await reservar(optica, fAbierto, "11:30 PM")
  ok(/fuera del horario/.test(x.e || ""), "de noche: " + x.e)
  x = await reservar(optica, fAbierto, "25:99 AM")
  ok(/hora no es válida/.test(x.e || ""), "hora mal escrita: " + x.e)
  x = await reservar(optica, fCerrado, "10:00 AM")
  ok(/no atiende/.test(x.e || ""), "día cerrado: " + x.e)

  // Excepciones sobre un día cerrado
  const conExcepcion = async (exc) => {
    await c.query("update disponibilidad set excepciones = $2::jsonb where optica_id = $1", [optica, JSON.stringify({ [fCerrado]: exc })])
    return reservar(optica, fCerrado, "10:00 AM")
  }
  const sesionAbierta = { manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } }
  x = await conExcepcion({ ...sesionAbierta, reservasWeb: false })
  ok(/no admite reservas en línea/.test(x.e || ""), "día abierto solo para el personal (reservasWeb false): " + x.e)
  x = await conExcepcion({ ...sesionAbierta, reservasWeb: true })
  ok(!!x.r, "día abierto con reservas web: sí reserva")
  x = await conExcepcion(sesionAbierta)
  ok(!!x.r, "excepción anterior, sin la marca: sigue admitiendo reservas web")
  x = await conExcepcion({ manana: { activo: false, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } })
  ok(/no atiende/.test(x.e || ""), "excepción que cierra un día normalmente abierto o cerrado: no reserva")

  // Óptica sin horario configurado: no se valida
  const sin = (await c.query("select o.id from opticas o left join disponibilidad d on d.optica_id = o.id where d.optica_id is null and o.activa limit 1")).rows[0]
  if (sin) {
    await c.query("savepoint s")
    await c.query("insert into pacientes (optica_id, nombre, cedula, fecha_nacimiento, evolucion, ultima_consulta, fecha_registro, estado_clinico) values ($1,'x',$2,'1990-01-01','Sin evaluación','Pendiente',current_date,'Activo')", [sin.id, ced]).catch(() => {})
    await c.query("rollback to savepoint s")
    x = await reservar(sin.id, "2027-03-07", "10:00 AM")
    ok(!!x.r || !/no atiende|fuera del horario|reservas en línea/.test(x.e || ""), "óptica sin horario configurado: no se valida (" + (x.r ? "reservó" : x.e) + ")")
  }

  // La validación no se puede llamar desde fuera
  const p = (await c.query(`select has_function_privilege('anon','public.validar_horario_reserva_web(uuid,date,text)','execute') a, has_function_privilege('authenticated','public.validar_horario_reserva_web(uuid,date,text)','execute') u,
    has_function_privilege('anon','public.crear_cita_publica(uuid,text,date,text,text,date,text,text,text,text,jsonb)','execute') w`)).rows[0]
  ok(!p.a && !p.u && p.w, "la validación no se llama desde fuera; la reserva web sigue pública")
} catch (e) { fallos++; console.error("✘ Error:", e.message) }
finally {
  await c.query("rollback"); await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó.` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
