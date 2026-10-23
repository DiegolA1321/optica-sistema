// Verificación de 0150 DESPUÉS de aplicarla, sin enviar ningún correo real: comprueba el cron, las funciones y el remitente, y ensaya la función con los datos de verdad dentro de una
// transacción que se revierte (con la llave de Resend reemplazada por una falsa), para ver a quién le tocaría recibir recordatorio ahora, sin que salga nada.
//
//   node --env-file=.env.local scripts/historial/verificar-0150.mjs
import pg from "pg"

const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

const colaAntes = (await q("select count(*)::int n from net.http_request_queue"))[0].n
const enviosAntes = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
const marcadasAntes = (await q("select count(*)::int n from citas_base where recordatorio_enviado_at is not null"))[0].n

const jobs = await q("select jobname, schedule, active from cron.job order by jobname")
const j = jobs.find((x) => x.jobname === "recordatorios_citas_cada_hora")
ok(j?.schedule === "0 * * * *" && j.active, "el cron «recordatorios_citas_cada_hora» está activo, cada hora en punto")
ok(!jobs.some((x) => x.jobname === "recordatorios_citas_diarios"), "el cron diario viejo ya no existe")
ok(["saludos_cumpleanos_diarios", "marcar_no_asistio_automatico", "verificar_sistema", "limpiar_limite_solicitudes"].every((n) => jobs.some((x) => x.jobname === n)), "los demás trabajos del cron siguen")
const f = await q("select pg_get_function_identity_arguments(p.oid) a, pg_get_functiondef(p.oid) d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'enviar_recordatorios_citas'")
ok(f.length === 1 && /p_ahora/.test(f[0].a), "hay una sola enviar_recordatorios_citas, con p_ahora")
ok(/created_at <= p_ahora - interval '2 hours'/.test(f[0].d), "no recuerda las citas creadas hace menos de 2 horas")
for (const n of ["enviar_saludos_cumpleanos", "notificar_encuesta_satisfaccion"]) {
  const d = (await q("select pg_get_functiondef(p.oid) d from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = $1", [n]))[0].d
  ok(/_remitente_correo/.test(d), `${n} usa el remitente configurable`)
}
ok((await q("select public._remitente_correo('Recordatorios') r"))[0].r === "Recordatorios <onboarding@resend.dev>", "sin secreto configurado, el remitente sigue siendo onboarding@resend.dev")

// ¿A quién le tocaría ahora? (misma regla, dentro de una transacción que se revierte y con llave falsa).
try {
  await c.query("begin")
  await c.query("delete from vault.secrets where name = 'resend_api_key'")
  await c.query("select vault.create_secret('LLAVE-FALSA-DE-LA-VERIFICACION', 'resend_api_key')")
  const antes = (await q("select count(*)::int n from net.http_request_queue"))[0].n
  await c.query("select public.enviar_recordatorios_citas(now())")
  const encoladas = (await q("select count(*)::int n from net.http_request_queue"))[0].n - antes
  console.log(`   con los datos de hoy y la hora actual, le tocaría recordatorio a ${encoladas} cita(s) (todas se revierten: no sale nada)`)
} finally {
  await c.query("rollback")
}

const colaDespues = (await q("select count(*)::int n from net.http_request_queue"))[0].n
const enviosDespues = (await q("select count(*)::int n from notificaciones_enviadas"))[0].n
const marcadasDespues = (await q("select count(*)::int n from citas_base where recordatorio_enviado_at is not null"))[0].n
const llaveReal = (await q("select count(*)::int n from vault.decrypted_secrets where name = 'resend_api_key' and decrypted_secret not like 'LLAVE-FALSA%'"))[0].n
ok(colaDespues === colaAntes && enviosDespues === enviosAntes && marcadasDespues === marcadasAntes, `no se envió nada: cola ${colaAntes}→${colaDespues}, envíos ${enviosAntes}→${enviosDespues}, citas marcadas ${marcadasAntes}→${marcadasDespues}`)
ok(llaveReal === 1, "la llave real de Resend sigue en el vault")
await c.end()
console.log(fallos ? `\n${fallos} fallo(s).` : "\nVerificación limpia: ningún correo real.")
process.exit(fallos ? 1 : 0)
