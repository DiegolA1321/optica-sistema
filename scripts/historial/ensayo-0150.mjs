// Ensayo de la migración 0150 (recordatorios cada hora y remitente configurable). La aplica dentro de una transacción que SIEMPRE se revierte y prueba la regla con un reloj fijo.
// NO se envía ningún correo real: pg_net solo encola la petición en una tabla que el proceso que envía lee DESPUÉS de confirmar la transacción, y aquí nunca se confirma; además la
// llave de Resend se reemplaza, dentro de la transacción, por una falsa. El ensayo comprueba al final que la cola y el registro de envíos quedaron como estaban.
//
//   node --env-file=.env.local scripts/historial/ensayo-0150.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0150_recordatorios_cada_hora.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const EC = (iso) => `${iso}-05:00` // hora de Ecuador (sin horario de verano)

const colaAntes = (await q("select count(*)::int n from net.http_request_queue"))[0].n
const enviosAntes = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
const cronAntes = await q("select jobname from cron.job order by jobname")

try {
  await c.query("begin")
  // Llave falsa: nada de lo que se encole podría autenticarse aunque llegara a salir.
  await c.query("delete from vault.secrets where name = 'resend_api_key'")
  await c.query("select vault.create_secret('LLAVE-FALSA-DEL-ENSAYO', 'resend_api_key')")
  await c.query(sql)
  ok(true, "0150 se aplica sin errores")

  // ── Cron y funciones ──
  const jobs = await q("select jobname, schedule, active from cron.job order by jobname")
  const nuevo = jobs.find((j) => j.jobname === "recordatorios_citas_cada_hora")
  ok(nuevo?.schedule === "0 * * * *" && nuevo.active, "el cron corre cada hora en punto (0 * * * *) y está activo")
  ok(!jobs.some((j) => j.jobname === "recordatorios_citas_diarios"), "el cron diario viejo ya no existe")
  ok(JSON.stringify(jobs.map((j) => j.jobname).filter((n) => n !== "recordatorios_citas_cada_hora")) === JSON.stringify(cronAntes.map((j) => j.jobname).filter((n) => n !== "recordatorios_citas_diarios")), "los demás trabajos del cron no cambiaron")
  const firmas = await q("select pg_get_function_identity_arguments(p.oid) a from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'enviar_recordatorios_citas'")
  ok(firmas.length === 1 && /timestamp with time zone/.test(firmas[0].a), "queda UNA sola enviar_recordatorios_citas (sin sobrecargas): " + firmas.map((f) => f.a))
  for (const n of ["enviar_saludos_cumpleanos", "notificar_encuesta_satisfaccion", "enviar_recordatorios_citas"]) {
    const d = (await q("select pg_get_functiondef(p.oid) d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1", [n]))[0].d
    ok(/_remitente_correo/.test(d) && !/onboarding@resend\.dev/.test(d), `${n} ya no lleva el remitente escrito en el código`)
  }

  // ── Remitente configurable ──
  let r = (await q("select public._remitente_correo('Recordatorios') r"))[0].r
  ok(r === "Recordatorios <onboarding@resend.dev>", "sin configurar, el remitente sigue siendo onboarding@resend.dev: " + r)

  // ── Reloj fijo: lunes 2 nov 2026, 10:30 (Ecuador) ──
  const optica = (await q("select id, nombre from opticas where slug = 'v8twzq'"))[0] // la óptica de pruebas
  const ahora = EC("2026-11-02T10:30:00")
  const cita = async (fecha, hora, extra = {}) => (await q(
    "insert into citas_base (optica_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, correo, recordatorio_enviado_at) values ($1, $2, '1710034065', '0991234567', $3, $4, 'Consulta General', $5, 'presencial', $6, $7) returning id",
    [optica.id, 'Paciente Ensayo ' + hora, fecha, hora, extra.estado || "Pendiente", "correo" in extra ? extra.correo : "prueba@example.invalid", extra.enviado || null]))[0].id
  const A = await cita("2026-11-02", "03:00 PM") // dentro de 4,5 h → sí
  const B = await cita("2026-11-03", "09:00 AM") // dentro de 22,5 h → sí
  const C = await cita("2026-11-03", "11:00 AM") // dentro de 24,5 h → todavía no
  const D = await cita("2026-11-02", "09:00 AM") // ya empezó → no
  const E = await cita("2026-11-02", "04:00 PM", { enviado: "2026-11-02T08:00:00-05:00" }) // ya tiene recordatorio → no
  const F = await cita("2026-11-02", "05:00 PM", { estado: "Cancelada" }) // cancelada → no
  const G = await cita("2026-11-02", "06:00 PM", { correo: "no-es-un-correo" }) // sin correo válido → se marca, no se envía
  const enviado = async (id) => (await q("select recordatorio_enviado_at is not null as e from citas_base where id = $1", [id]))[0].e
  // Solo las de este ensayo (las citas reales de la óptica de pruebas, si las hubiera en esas fechas, también se encolarían, pero no cuentan aquí).
  const cola = async () => (await q("select convert_from(body, 'utf8')::jsonb b from net.http_request_queue where url = 'https://api.resend.com/emails' order by id")).map((x) => x.b).filter((b) => /Paciente Ensayo/.test(b.html || ""))
  const colaBase = (await cola()).length

  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [ahora])
  let enCola = (await cola()).slice(colaBase)
  ok(enCola.length === 2, `10:30 → se encolan 2 correos (las citas de las próximas 24 horas): ${enCola.length}`)
  ok(!!(await enviado(A)) && !!(await enviado(B)), "las dos quedan marcadas como enviadas")
  ok(!(await enviado(C)) && !(await enviado(D)), "la de dentro de 24,5 h y la que ya empezó NO se tocan")
  ok(!!(await enviado(G)) && enCola.every((b) => b.to[0] !== "no-es-un-correo"), "la de correo inválido se marca como procesada y no se envía")
  ok(!(await enviado(F)), "la cancelada no se toca")
  ok(enCola.every((b) => b.from === "Recordatorios <onboarding@resend.dev>"), "el remitente por defecto es onboarding@resend.dev")
  ok(enCola.every((b) => b.subject === `Recordatorio de tu cita en ${optica.nombre}`), "el asunto ya no dice «mañana»: " + enCola[0]?.subject)
  const htmlB = enCola.map((b) => b.html).find((h) => /03\/11\/2026/.test(h)) || ""
  ok(/03\/11\/2026 a las 9:00 AM/.test(htmlB) && !/a las 09:00/.test(htmlB), "la hora del correo se escribe sin cero de adelante («9:00 AM»)")
  ok(/No necesitas confirmar tu asistencia/.test(htmlB), "el texto del correo no cambió")

  // Sin duplicados: la misma corrida otra vez no envía nada más.
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [ahora])
  ok((await cola()).length - colaBase === 2, "una segunda corrida con el mismo reloj no repite ningún correo")
  const regs = (await q("select count(*)::int n from notificaciones_enviadas where tipo = 'recordatorio_cita' and referencia_id in ($1, $2)", [A, B]))[0].n
  ok(regs === 2, "queda un solo registro de envío por cita")

  // ── Horario de descanso: 22:00 no envía; 07:00 sí ──
  const H = await cita("2026-11-03", "08:00 AM") // agendada «de noche» para temprano
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-02T22:00:00")])
  ok((await cola()).length - colaBase === 2 && !(await enviado(H)) && !(await enviado(C)), "a las 10:00 PM no se envía nada: lo pendiente espera")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-02T20:59:00")])
  ok((await cola()).length - colaBase === 4, "a las 8:59 PM todavía se envía (el descanso empieza a las 9:00 PM): se encolaron las de las próximas 24 h")
  // (las dos anteriores salieron a las 20:59; para probar las 7:00 AM se arma otro caso)
  const I = await cita("2026-11-04", "08:00 AM")
  const J = await cita("2026-11-04", "09:00 AM")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-04T06:59:00")])
  ok(!(await enviado(I)) && !(await enviado(J)), "a las 6:59 AM no se envía")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-04T07:00:00")])
  ok(!!(await enviado(J)) && !!(await enviado(I)), "a las 7:00 AM sí: salen las dos pendientes (la de las 8:00 AM y la de las 9:00 AM)")

  // ── Óptica con los recordatorios apagados ──
  await c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || '{\"recordatoriosCitaActivo\": false}'::jsonb where id = $1", [optica.id])
  const K = await cita("2026-11-05", "01:00 PM")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-05T08:00:00")])
  ok(!(await enviado(K)), "con «recordatoriosCitaActivo» apagado en la óptica no se envía")
  await c.query("update opticas set settings = settings - 'recordatoriosCitaActivo' where id = $1", [optica.id])

  // ── Remitente configurado en el vault ──
  await c.query("select vault.create_secret('avisos@dominio-verificado.com', 'resend_remitente')")
  r = (await q("select public._remitente_correo('Encuestas') r"))[0].r
  ok(r === "Encuestas <avisos@dominio-verificado.com>", "con el secreto resend_remitente, el remitente cambia sin tocar código: " + r)
  const L = await cita("2026-11-06", "10:00 AM")
  const antes = (await cola()).length
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-06T08:00:00")])
  const ultimo = (await cola()).slice(antes)
  ok(ultimo.length >= 1 && ultimo.every((b) => b.from === "Recordatorios <avisos@dominio-verificado.com>") && !!(await enviado(L)), "el recordatorio sale con el remitente configurado")

  // ── Una cita creada hace menos de 2 horas no recibe recordatorio todavía ──
  const citaCreada = async (fecha, hora, creada) => (await q(
    "insert into citas_base (optica_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, correo, created_at) values ($1, $2, '1710034065', '0991234567', $3, $4, 'Consulta General', 'Pendiente', 'presencial', 'prueba@example.invalid', $5) returning id",
    [optica.id, 'Paciente Ensayo ' + hora, fecha, hora, creada]))[0].id
  const N = await citaCreada("2026-11-09", "04:00 PM", EC("2026-11-09T07:00:00")) // creada hace 3 h → sí
  const M = await citaCreada("2026-11-09", "03:00 PM", EC("2026-11-09T08:30:00")) // creada a las 8:30 → recibe recordatorio desde las 10:30
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-09T10:29:00")])
  ok(!!(await enviado(N)), "creada hace 3 horas: sí recibe recordatorio")
  ok(!(await enviado(M)), "creada hace 1 hora y 59 minutos: todavía NO (el paciente acaba de recibir su confirmación)")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-09T10:30:00")])
  ok(!!(await enviado(M)), "al cumplir las 2 horas, ya sale")
  const hoyCreada = await citaCreada("2026-11-10", "09:00 AM", EC("2026-11-09T22:30:00")) // creada de noche
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-09T22:40:00")])
  ok(!(await enviado(hoyCreada)), "creada hace 10 minutos y en horario de descanso: no sale")
  await c.query("select public.enviar_recordatorios_citas($1::timestamptz)", [EC("2026-11-10T07:00:00")])
  ok(!!(await enviado(hoyCreada)), "a las 7:00 AM del día siguiente (ya con más de 2 horas) sale")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback")
  const colaDespues = (await q("select count(*)::int n from net.http_request_queue"))[0].n
  const enviosDespues = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
  const key = (await q("select count(*)::int n from vault.decrypted_secrets where name = 'resend_api_key' and decrypted_secret <> 'LLAVE-FALSA-DEL-ENSAYO'"))[0].n
  const cronDespues = await q("select jobname, schedule from cron.job order by jobname")
  ok(colaDespues === colaAntes && enviosDespues === enviosAntes, `NO se envió ningún correo: la cola de pg_net (${colaAntes} → ${colaDespues}) y el registro de envíos (${enviosAntes} → ${enviosDespues}) quedaron igual`)
  ok(key === 1, "la llave real de Resend sigue en el vault (la falsa se revirtió)")
  ok(JSON.stringify(cronDespues.map((j) => j.jobname)) === JSON.stringify(cronAntes.map((j) => j.jobname)) && cronDespues.some((j) => j.jobname === "recordatorios_citas_diarios"), "revertido: el cron diario original sigue ahí")
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nEnsayo limpio: todo bien y revertido; ningún correo real.")
process.exit(fallos ? 1 : 0)
