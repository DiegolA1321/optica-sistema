// Comprueba, con la base real y dentro de una transacción que SIEMPRE revierte, que un pasaporte de 10 números se guarda como pasaporte (no como cédula) al reservar por la web,
// y que el enlace con un paciente existente sigue siendo por ese documento.
//
//   node --env-file=.env.local scripts/historial/ensayo-pasaporte.mjs
import pg from "pg"

const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows

try {
  await c.query("begin")
  const optica = (await q("select id from opticas where slug = 'v8twzq'"))[0].id // la óptica de pruebas
  let dia = null
  for (let i = 1; i < 60 && !dia; i++) {
    const f = (await q("select (current_date + $1::int)::text f", [i]))[0].f
    await c.query("savepoint v")
    try { await q("select validar_horario_reserva_web($1, $2::date, '10:00 AM')", [optica, f]); dia = f } catch { /* ese día no atiende */ }
    await c.query("rollback to savepoint v")
  }
  if (!dia) throw new Error("La óptica de pruebas no tiene un día de atención a las 10:00 AM")
  const reservar = (doc, tipo, hora) => q("select * from crear_cita_publica($1, 'Viajero Prueba', $2::date, $3, $4, null, '0991234567', 'Consulta General', 'Consulta General', null, null, 'web', null, $5)", [optica, dia, hora, doc, tipo])

  await reservar("1234567890", "pasaporte", "10:00 AM")
  let p = await q("select tipo_documento, cedula, fecha_nacimiento from pacientes_base where optica_id = $1 and cedula = '1234567890'", [optica])
  ok(p.length === 1 && p[0].tipo_documento === "pasaporte" && p[0].fecha_nacimiento === null, "un pasaporte de 10 números se guarda como pasaporte (sin pasar por el dígito verificador) y sin fecha de nacimiento")

  await c.query("savepoint s")
  let error = null
  try { await reservar("1234567890", "cedula", "10:40 AM") } catch (e) { error = e.message }
  await c.query("rollback to savepoint s")
  ok(/cédula no es válida/i.test(error || ""), "con tipo cédula, esos mismos 10 números siguen rechazados porque no son una cédula válida: " + error)

  await reservar("1234567890", "pasaporte", "10:40 AM")
  p = await q("select count(*)::int n from pacientes_base where optica_id = $1 and cedula = '1234567890'", [optica])
  ok(p[0].n === 1, "otra reserva con el mismo pasaporte se enlaza al mismo paciente (no lo duplica)")
  const citas = await q("select count(*)::int n from citas_base where optica_id = $1 and cedula = '1234567890' and fecha = $2", [optica, dia])
  ok(citas[0].n === 2, "las dos citas quedaron registradas")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nEnsayo limpio: todo bien y revertido.")
process.exit(fallos ? 1 : 0)
