// Verificación de 0149 (una hora, un profesional) DESPUÉS de aplicarla: dos y tres confirmaciones SIMULTÁNEAS desde conexiones distintas.
// Corre en la óptica de pruebas (slug v8twzq), crea citas y pacientes de prueba y los borra al terminar (la Demo no se toca).
//
//   node --env-file=.env.local scripts/historial/verificar-0149.mjs
import pg from "pg"

const nuevo = async () => { const c = new pg.Client(); await c.connect(); return c }
const admin = await nuevo()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (c, t, p) => (await c.query(t, p)).rows

const CEDULAS = ["1710034065", "0926687856", "0914546437", "1713175071", "1104680135"]
const optica = (await q(admin, "select id from opticas where slug = 'v8twzq'"))[0].id
const hora = "10:00 AM"

// Un día en que la web admita esa hora en la óptica de pruebas.
let dia = null
for (let i = 1; i < 60 && !dia; i++) {
  const f = (await q(admin, "select (current_date + $1::int)::text f", [i]))[0].f
  try { await q(admin, "select validar_horario_reserva_web($1, $2::date, $3)", [optica, f, hora]); dia = f } catch { /* ese día no atiende */ }
}
if (!dia) { console.error("La óptica de pruebas no tiene un día de atención a las 10:00 AM en 60 días"); process.exit(1) }
const libre = (await q(admin, "select count(*)::int n from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado <> 'Cancelada'", [optica, dia, hora]))[0].n
if (libre) { console.error("La hora de prueba ya tiene citas; se cancela para no pisar nada"); process.exit(1) }

const reservar = async (cedula) => {
  const c = await nuevo()
  try {
    await c.query("set role anon")
    return { r: (await c.query("select * from crear_cita_publica($1, 'Paciente Simultaneo', $2::date, $3, $4, '1990-03-12', '0991234567', 'Consulta General', 'Consulta General', null, null, 'web', null)", [optica, dia, hora, cedula])).rows[0] }
  } catch (e) { return { e: e.message } } finally { await c.end() }
}

try {
  // 1. Dos confirmaciones en el mismo instante: gana una, la otra ve el mensaje.
  let res = await Promise.all([reservar(CEDULAS[0]), reservar(CEDULAS[1])])
  let ganan = res.filter((x) => x.r).length
  ok(ganan === 1, `dos confirmaciones simultáneas → ${ganan} se crea (esperado: 1)`)
  ok(res.filter((x) => x.e).every((x) => /acaba de ocuparse/.test(x.e)), "la que pierde ve «Esa hora acaba de ocuparse. Elige otra.»: " + res.map((x) => x.e || "ok").join(" | "))
  ok((await q(admin, "select count(*)::int n from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado <> 'Cancelada'", [optica, dia, hora]))[0].n === 1, "en la base queda UNA sola cita a esa hora")

  // 2. Cinco a la vez, otra hora.
  const hora2 = "10:20 AM"
  const reservar2 = async (cedula) => {
    const c = await nuevo()
    try { await c.query("set role anon"); return { r: (await c.query("select * from crear_cita_publica($1, 'Paciente Simultaneo', $2::date, $3, $4, '1990-03-12', '0991234567', 'Consulta General', 'Consulta General', null, null, 'web', null)", [optica, dia, hora2, cedula])).rows[0] } }
    catch (e) { return { e: e.message } } finally { await c.end() }
  }
  res = await Promise.all(CEDULAS.map(reservar2))
  ganan = res.filter((x) => x.r).length
  ok(ganan === 1, `cinco confirmaciones simultáneas → ${ganan} se crea (esperado: 1)`)

  // 3. Dos del personal en el mismo instante (insert directo): gana una.
  const pac = (await q(admin, "select id, nombre, cedula from pacientes_base where optica_id = $1 limit 1", [optica]))[0]
  const directo = async () => {
    const c = await nuevo()
    try { await c.query("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, motivo, estado, origen) values ($1, $2, $3, $4, $5, '11:00 AM', 'x', 'Pendiente', 'presencial')", [optica, pac.id, pac.nombre, pac.cedula, dia]); return { r: true } }
    catch (e) { return { e: e.message, code: e.code } } finally { await c.end() }
  }
  res = await Promise.all([directo(), directo()])
  ok(res.filter((x) => x.r).length === 1 && res.filter((x) => x.e).every((x) => x.code === "23505"), "dos altas simultáneas del personal a la misma hora → una sola (la otra: 23505)")
} finally {
  // Limpieza: las citas de la hora de prueba y los pacientes que crearon.
  await admin.query("delete from citas_base where optica_id = $1 and fecha = $2 and (paciente = 'Paciente Simultaneo' or (hora = '11:00 AM' and motivo = 'x'))", [optica, dia])
  await admin.query("delete from pacientes_base where optica_id = $1 and nombre = 'Paciente Simultaneo'", [optica])
  const resto = (await q(admin, "select count(*)::int n from citas_base where optica_id = $1 and fecha = $2 and hora in ($3, '10:20 AM', '11:00 AM')", [optica, dia, hora]))[0].n
  console.log(`Limpieza: quedan ${resto} citas de prueba.`)
  await admin.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nVerificación limpia.")
process.exit(fallos ? 1 : 0)
