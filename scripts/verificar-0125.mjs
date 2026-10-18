// Verificación con sesión REAL de paciente (la API, con el token del inicio de sesión) de la migración 0125, en la óptica de pruebas.
// Crea dos citas del paciente fijo del portal (una futura y una atendida) y las borra al terminar, con su confirmación, su calificación y su actividad.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0125.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id, nombre from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
const otro = (await q("select id from pacientes_base where optica_id = $1 and id <> $2 and anonimizado_en is null limit 1", [OP, P.id]))[0]
const citas = []
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  const perfil = (await q("select id, nombre from perfiles where optica_id = $1 order by created_at limit 1", [OP]))[0]
  const nueva = async (estado, dias, hora, quien = P.id) => {
    const id = (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado, atendido_por, asignado_a) values ($1, $2, $7, (now() at time zone 'America/Guayaquil')::date + $3::int, $4, 'Consulta General', $5, $6, $8) returning id`,
      [OP, quien, dias, hora, estado, estado === "Atendida" ? perfil.id : null, P.nombre, perfil.id]))[0].id
    citas.push(id); return id
  }
  const futura = await nueva("Pendiente", 4, "10:20 AM")
  const atendida = await nueva("Atendida", -2, "10:20 AM")
  const ajena = otro ? await nueva("Atendida", -2, "09:00 AM", otro.id) : null

  const d = await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: token })
  ok(!d.error && d.data.some((x) => x.cita_id === futura && x.profesional === perfil.nombre), "el detalle trae al profesional de su cita futura")
  ok(!d.data.some((x) => x.cita_id === ajena), "no entrega citas de otro paciente")
  ok(d.data.every((x) => Object.keys(x).sort().join() === "calificacion,cita_id,confirmada_at,consulta_id,profesional"), "solo los cinco campos, sin ids del personal")
  const f = await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: "inventado" })
  ok(!f.error && f.data.length === 0, "con un token inventado no entrega nada")

  const c1 = await api.rpc("confirmar_asistencia_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: futura })
  ok(!c1.error && c1.data === true, "confirma su cita futura")
  ok((await q("select confirmada_at from citas_base where id = $1", [futura]))[0].confirmada_at !== null, "queda confirmada en el sistema del personal")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'El paciente confirmó su asistencia' and (detalle like $2 or detalle like 'x · %')", [OP, P.nombre + "%"]))[0].n >= 1, "queda en la actividad")
  const c2 = await api.rpc("confirmar_asistencia_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: atendida })
  ok(c2.data === false, "una cita atendida no se confirma")
  if (ajena) ok((await api.rpc("confirmar_asistencia_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: ajena })).data === false, "no confirma la cita de otro paciente")
  ok((await api.rpc("confirmar_asistencia_paciente", { p_paciente_id: P.id, p_token: "inventado", p_cita_id: futura })).data === false, "con un token inventado no confirma")

  const k1 = await api.rpc("calificar_atencion_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: atendida, p_puntaje: 5, p_comentario: "Muy buena atención" })
  ok(!k1.error && k1.data === true, "califica una cita atendida")
  ok((await q("select puntaje from respuestas_satisfaccion where cita_id = $1", [atendida]))[0]?.puntaje === 5, "la calificación llega a la misma tabla de Reportes")
  ok((await api.rpc("calificar_atencion_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: atendida, p_puntaje: 1 })).data === false, "una sola vez por cita")
  ok((await api.rpc("calificar_atencion_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: futura, p_puntaje: 4 })).data === false, "una cita sin atender no se califica")
  ok(!!(await api.rpc("calificar_atencion_paciente", { p_paciente_id: P.id, p_token: token, p_cita_id: atendida, p_puntaje: 9 })).error, "un puntaje fuera de 1 a 5 se rechaza")
  const d2 = await api.rpc("mis_citas_detalle_paciente", { p_paciente_id: P.id, p_token: token })
  ok(d2.data.find((x) => x.cita_id === atendida)?.calificacion?.puntaje === 5 && d2.data.find((x) => x.cita_id === futura)?.confirmada_at, "el detalle ya trae la calificación y la confirmación")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  if (citas.length) {
    await c.query("delete from respuestas_satisfaccion where cita_id = any($1)", [citas])
    await c.query("delete from citas_base where id = any($1)", [citas])
  }
  await c.query("delete from logs_optica where optica_id = $1 and accion = 'El paciente confirmó su asistencia' and (detalle like $2 or detalle like 'x · %')", [OP, P.nombre + "%"])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
