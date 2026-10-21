// Reagendar NO es cancelar: contra la base real (migración 0134 ya aplicada), DENTRO de una transacción que SIEMPRE revierte.
// Reagenda una cita desde el personal (como la pantalla de Citas: update de fecha y hora) y desde el portal, y comprueba que la cita sigue viva
// (Pendiente), con su «reagendada» en el seguimiento, sin evento ni estado de cancelación y fuera de «Contactar al paciente» (que son No Asistió y Canceladas).
//   node --env-file=.env.local scripts/historial/verificar-reagendar.mjs
import pg from "pg"

const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const soltar = () => c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)")
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r"); await soltar()
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); await soltar(); return { e: e.message } }
}
const eventos = (id) => q("select tipo, actor_tipo, actor_nombre, datos from citas_eventos where cita_id = $1 order by ocurrido_en, id", [id])

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const rec = (await q("select id from perfiles where optica_id = $1 and nombre = 'Rosa Recepción Pruebas'", [OP]))[0]
  const claims = { sub: rec.id, role: "authenticated", aal: "aal2" }
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente Reagendar', cedula = '0900000089', usuario = null, clave_temporal = null, sesion_token = 'tok-rea', sesion_token_creado_en = now(), anonimizado_en = null, medidas_solicitadas_en = null")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  const DIA = "2099-03-10"
  await c.query(`update disponibilidad set excepciones = coalesce(excepciones, '{}'::jsonb) || jsonb_build_object('${DIA}', jsonb_build_object(
    'manana', jsonb_build_object('activo', true, 'inicio', '09:00', 'fin', '13:00'), 'tarde', jsonb_build_object('activo', true, 'inicio', '14:00', 'fin', '18:00'))) where optica_id = $1`, [OP])
  await c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('permitirReagendarPaciente', 'true', 'horasAntesReagendar', 0) where id = $1", [OP])
  const nueva = async (hora) => (await q(`insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen, duracion_minutos)
    values ($1, $2, 'Paciente Reagendar', '0900000089', $3, $4, 'Pendiente', 'staff', 40) returning id`, [OP, P, DIA, hora]))[0].id

  // Desde el personal: la pantalla de Citas actualiza fecha y hora de la MISMA cita.
  const A = await nueva("09:00 AM")
  const r1 = await como("authenticated", claims, "update citas set fecha = $2, hora = $3 where id = $1 returning estado", [A, DIA, "10:00 AM"])
  ok(r1.r?.[0]?.estado === "Pendiente", "personal: la cita reagendada sigue Pendiente (viva)" + (r1.e ? " — " + r1.e : ""))
  const evA = await eventos(A)
  const reaA = evA.find((e) => e.tipo === "reagendada")
  ok(reaA?.datos.hora_anterior === "09:00 AM" && reaA.datos.hora_nueva === "10:00 AM" && reaA.actor_tipo === "personal", "personal: el seguimiento dice «Reagendada desde» el 09:00 AM, hecha por el personal")
  ok(!evA.some((e) => ["cancelada", "no_efectuada"].includes(e.tipo)), "personal: no se registra ninguna cancelación")

  // Desde el portal: reagendar_cita_publica con el paciente como autor.
  const B = await nueva("11:00 AM")
  ok((await como("anon", null, "select reagendar_cita_publica($1,$2,$3,$4,$5) as r", [B, P, DIA, "12:00 PM", "tok-rea"])).r?.[0].r === true, "portal: el paciente reagenda")
  const evB = await eventos(B)
  const reaB = evB.find((e) => e.tipo === "reagendada")
  ok(reaB?.datos.hora_anterior === "11:00 AM" && reaB.datos.hora_nueva === "12:00 PM" && reaB.actor_tipo === "paciente", "portal: el seguimiento dice «Reagendada desde» el 11:00 AM, hecha por el paciente")
  ok(!evB.some((e) => ["cancelada", "no_efectuada"].includes(e.tipo)), "portal: no se registra ninguna cancelación")

  // Ni cuenta como cancelada ni entra en «Contactar al paciente» (No efectuadas y Canceladas por el paciente).
  const filas = await q("select estado from citas_base where id = any($1)", [[A, B]])
  ok(filas.every((f) => f.estado === "Pendiente"), "las dos siguen Pendiente: no cuentan como canceladas en Inicio ni en Reportes")
  ok(filas.every((f) => !["Cancelada", "No Asistió"].includes(f.estado)), "ninguna cumple el criterio de «Contactar al paciente»")
  ok((await q("select count(*)::int n from citas_eventos where cita_id = any($1) and tipo = 'cancelada'", [[A, B]]))[0].n === 0, "cero eventos de cancelación")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
