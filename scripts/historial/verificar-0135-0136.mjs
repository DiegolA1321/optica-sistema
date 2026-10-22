// Verificación con sesión REAL de las migraciones 0135 y 0136 (administrador, recepción y ventas de la óptica de pruebas, por la API). Deja todo limpio.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0135-0136.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
const nuevo = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const MARCA = "E Dos E Verif 0136"
const limpiar = async () => {
  await c.query("delete from citas_base where optica_id = $1 and paciente like $2", [OP, MARCA + "%"])
  // El historial de contactos no se borra a mano: se va con el paciente (la base solo lo permite así).
  await c.query("delete from pacientes_base where optica_id = $1 and nombre like $2", [OP, MARCA + "%"])
  await c.query("delete from logs_optica where optica_id = $1 and detalle like $2", [OP, MARCA + "%"])
}
const ingreso = async (prefijo) => {
  const cl = nuevo()
  const { data, error } = await cl.auth.signInWithPassword({ email: process.env[`E2E_${prefijo}_EMAIL`], password: process.env[`E2E_${prefijo}_PASSWORD`] })
  if (error) throw new Error(`No inició sesión ${prefijo}: ${error.message}`)
  return { cl, uid: data.user.id }
}
try {
  await limpiar()
  const admin = await ingreso("ADMIN")
  const rec = await ingreso("RECEPCION")
  const ventas = await ingreso("VENTAS")
  ok(true, "administrador, recepción y ventas inician sesión de verdad")

  // ── tipo de documento ──
  const a = await admin.cl.from("pacientes").insert({ optica_id: OP, nombre: MARCA + " Pasaporte", cedula: "ZX9988776", tipo_documento: "pasaporte", telefono: "0999999999", correo: "Sin Correo", fecha_nacimiento: "1985-04-02" }).select().single()
  ok(!a.error && a.data.tipo_documento === "pasaporte" && a.data.cedula === "ZX9988776", "el administrador registra un paciente con pasaporte" + (a.error ? " — " + a.error.message : ""))
  const p = a.data
  const b = await admin.cl.from("pacientes").update({ tipo_documento: "otro", nombre: MARCA + " Otro doc" }).eq("id", p.id).select().single()
  ok(!b.error && b.data.tipo_documento === "otro" && b.data.nombre === MARCA + " Otro doc", "lo edita (tipo y nombre)")
  const lee = await rec.cl.from("pacientes").select("tipo_documento").eq("id", p.id).single()
  ok(lee.data?.tipo_documento === "otro", "recepción lo ve igual")
  const anonLee = await nuevo().from("pacientes").select("id").eq("id", p.id)
  ok(anonLee.error != null || (anonLee.data || []).length === 0, "sin sesión no se ve")

  // ── cita «Presencial» ──
  const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date d"))[0].d.toISOString().slice(0, 10)
  const cita = await rec.cl.from("citas").insert({ optica_id: OP, paciente_id: p.id, paciente: MARCA + " Otro doc", cedula: p.cedula, fecha: hoy, hora: "11:59 PM", estado: "En Atención", motivo: "Consulta General", origen: "presencial" }).select().single()
  ok(!cita.error && cita.data.origen === "presencial", "recepción crea una cita «Presencial»" + (cita.error ? " — " + cita.error.message : ""))
  const ev = (await admin.cl.from("citas_eventos").select("tipo, datos").eq("cita_id", cita.data.id)).data || []
  ok(ev[0]?.tipo === "agendada" && ev[0].datos.origen === "presencial", "el seguimiento dice «Agendada · presencial»")

  // ── dejar de atender ──
  const d1 = await rec.cl.rpc("dejar_de_atender_cita", { p_cita_id: cita.data.id })
  ok(d1.data === "En Espera", "mismo día: queda «En espera»" + (d1.error ? " — " + d1.error.message : ""))
  const ev2 = (await admin.cl.from("citas_eventos").select("tipo").eq("cita_id", cita.data.id).order("ocurrido_en")).data || []
  ok(ev2.map((e) => e.tipo).join() === "agendada,volvio_en_espera", "queda en el seguimiento")
  const vieja = await rec.cl.from("citas").insert({ optica_id: OP, paciente_id: p.id, paciente: MARCA + " Otro doc", cedula: p.cedula, fecha: "2020-02-04", hora: "10:00 AM", estado: "En Atención", motivo: "Consulta General" }).select().single()
  const d2 = await rec.cl.rpc("dejar_de_atender_cita", { p_cita_id: vieja.data.id })
  ok(d2.data === "No Asistió", "día pasado: queda «No efectuada»" + (d2.error ? " — " + d2.error.message : ""))
  const motivo = ((await admin.cl.from("citas_eventos").select("tipo, datos").eq("cita_id", vieja.data.id)).data || []).find((e) => e.tipo === "no_efectuada")
  ok(motivo?.datos.motivo === "La atención se interrumpió", "con el motivo «La atención se interrumpió»")
  ok((await nuevo().rpc("dejar_de_atender_cita", { p_cita_id: cita.data.id })).error != null, "sin sesión no puede")

  // ── contactos de los avisos en el CRM, con el permiso del módulo ──
  for (const [cl, quien, motivo] of [[rec.cl, "recepción", "cita_no_efectuada"], [ventas.cl, "ventas", "lentes_listos"], [admin.cl, "el administrador", "control_vencido"]]) {
    const r = await cl.rpc("registrar_contacto_de_aviso", { p_paciente_id: p.id, p_motivo: motivo, p_mensaje: "Verif 0136 " + motivo })
    ok(!r.error && r.data, `${quien} registra un contacto «${motivo}»` + (r.error ? " — " + r.error.message : ""))
  }
  const crm = (await admin.cl.from("crm_contactos").select("motivo, canal").eq("paciente_id", p.id)).data || []
  ok(crm.length === 3 && crm.every((x) => x.canal === "whatsapp"), "los tres están en el Seguimiento del CRM (lo lee el administrador)")
  const pl = await admin.cl.rpc("guardar_plantilla_crm", { p_motivo: "lentes_listos", p_texto: "Hola {nombre}, tus lentes de {óptica} ya están listos." })
  ok(!pl.error, "el administrador personaliza la plantilla de «lentes listos»" + (pl.error ? " — " + pl.error.message : ""))
  await admin.cl.rpc("guardar_plantilla_crm", { p_motivo: "lentes_listos", p_texto: "" }) // vuelve al mensaje base
  ok((await q("select count(*)::int n from crm_plantillas where optica_id = $1 and motivo = 'lentes_listos'", [OP]))[0].n === 0, "(se dejó sin plantilla propia, como estaba)")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await limpiar().catch((e) => console.error("limpieza:", e.message))
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Lo que se creó se borró.")
process.exit(fallos ? 1 : 0)
