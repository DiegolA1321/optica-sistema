// Crea en la Óptica Demo cinco citas pendientes de HOY para la reunión del 7 de octubre: tres asignadas a Paula
// (05:00, 05:40 y 06:20 PM) y dos al administrador (04:40 y 05:20 PM), con pacientes que ya existen y motivos variados.
// Las citas nacen con el recordatorio y la encuesta ya marcados como enviados, para que ningún proceso automático
// escriba a nadie. Solo toca la Óptica Demo y compara el conteo de las demás ópticas antes y después.
//
//   node --env-file=.env.local scripts/crear-citas-demo-reunion.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/crear-citas-demo-reunion.mjs --ejecutar   # escribe de verdad
import pg from "pg"
import { randomBytes } from "node:crypto"

const EJECUTAR = process.argv.includes("--ejecutar")
const PLAN = [
  { hora: "04:40 PM", quien: "admin", paciente: "Alexandra Moreira Mendoza", motivo: "Examen de Control" },
  { hora: "05:00 PM", quien: "paula", paciente: "Jessica Cevallos Bravo", motivo: "Consulta General" },
  { hora: "05:20 PM", quien: "admin", paciente: "Diego Pincay Quiroz", motivo: "Adaptación de Lentes" },
  { hora: "05:40 PM", quien: "paula", paciente: "Esteban Cedeño Intriago", motivo: "Garantía / Ajuste" },
  { hora: "06:20 PM", quien: "paula", paciente: "Verónica Cedeño Intriago", motivo: "Examen de Control" },
]

const client = new pg.Client()
await client.connect()
await client.query("begin")
try {
  const { rows: opts } = await client.query("select id from opticas where nombre = 'Óptica Demo'")
  if (opts.length !== 1) throw new Error("No se encontró exactamente una óptica 'Óptica Demo'")
  const O = opts[0].id
  const otras = async () => JSON.stringify((await client.query(`select optica_id, count(*)::int n from citas_base where optica_id <> $1 group by 1 order by 1`, [O])).rows)
  const antes = await otras()
  const { rows: pf } = await client.query(`select id, nombre, rol from perfiles where optica_id = $1 and (rol = 'admin' or nombre like 'Paula%')`, [O])
  const admin = pf.find((p) => p.rol === "admin"), paula = pf.find((p) => p.nombre.startsWith("Paula"))
  if (!admin || !paula) throw new Error("Faltan el administrador o Paula")
  const { rows: [{ hoy }] } = await client.query(`select (now() at time zone 'America/Guayaquil')::date::text hoy`)

  for (const c of PLAN) {
    if (!/^(0[1-9]|1[0-2]):[0-5]\d (AM|PM)$/.test(c.hora)) throw new Error("Hora con formato inválido: " + c.hora)
    const { rows: [p] } = await client.query(`select id, nombre, cedula, telefono, correo from pacientes_base where optica_id = $1 and nombre = $2`, [O, c.paciente])
    if (!p) throw new Error("No existe el paciente " + c.paciente)
    const { rows: choque } = await client.query(`select 1 from citas_base where optica_id = $1 and fecha = $2 and hora = $3 and estado not in ('Cancelada')`, [O, hoy, c.hora])
    if (choque.length) throw new Error("Ya hay una cita hoy a las " + c.hora)
    await client.query(
      `insert into citas_base (optica_id, paciente_id, paciente, cedula, telefono, correo, fecha, hora, motivo, estado, origen, codigo, duracion_minutos,
                               asignado_a, recordatorio_enviado_at, encuesta_enviada_at, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'Pendiente','staff',$10,40,$11, now(), now(), now())`,
      [O, p.id, p.nombre, p.cedula, p.telefono, p.correo, hoy, c.hora, c.motivo, "CIT-2026-" + randomBytes(3).toString("hex").toUpperCase(), c.quien === "paula" ? paula.id : admin.id])
  }

  const { rows: vistas } = await client.query(`select hora, estado, motivo, paciente, asignado_a = $2 as de_paula, asignado_a = $3 as del_admin from citas_base where optica_id = $1 and fecha = $4 and estado = 'Pendiente' order by hora`, [O, paula.id, admin.id, hoy])
  const fallos = []
  if (vistas.length < PLAN.length) fallos.push("no quedaron todas las citas")
  if ((await otras()) !== antes) fallos.push("cambió otra óptica: " + antes + " → " + await otras())
  const { rows: [{ n }] } = await client.query(`select count(*)::int n from mensajes`)
  console.log(`modo: ${EJECUTAR ? "EJECUTAR" : "ENSAYO"} · hoy ${hoy}`)
  console.table(vistas)
  console.log("mensajes en la base:", n, "· verificaciones:", fallos.length ? fallos.join("; ") : "correctas")
  if (fallos.length) throw new Error("Verificaciones fallidas")
  if (EJECUTAR) { await client.query("commit"); console.log("✔ COMMIT") } else { await client.query("rollback"); console.log("↩ ENSAYO: ROLLBACK") }
} catch (e) {
  await client.query("rollback"); console.error("✗ Se revirtió todo:", e.message); process.exitCode = 1
} finally { await client.end() }
