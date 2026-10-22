// Verificación con sesión REAL de las migraciones 0137 y 0138 (óptica de pruebas). Deja todo limpio.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0137-0138.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
const nuevo = () => createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const OP = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0].id
const MARCA = "E Dos E Verif 0138"
const limpiar = async () => {
  await c.query("delete from citas_base where optica_id = $1 and paciente like $2", [OP, MARCA + "%"])
  await c.query("delete from pacientes_base where optica_id = $1 and nombre like $2", [OP, MARCA + "%"])
}
const ingreso = async (p) => { const cl = nuevo(); const { error } = await cl.auth.signInWithPassword({ email: process.env[`E2E_${p}_EMAIL`], password: process.env[`E2E_${p}_PASSWORD`] }); if (error) throw new Error(p); return cl }
try {
  await limpiar()
  const admin = await ingreso("ADMIN"), opto = await ingreso("OPTOMETRA"), ventas = await ingreso("VENTAS"), rec = await ingreso("RECEPCION")
  for (const [n, cl] of [["administrador", admin], ["ventas", ventas], ["recepción", rec]]) {
    const r = await cl.rpc("plantillas_de_avisos")
    ok(!r.error && Array.isArray(r.data), `${n} lee las plantillas${r.error ? " — " + r.error.message : ""}`)
  }
  ok((await nuevo().rpc("plantillas_de_avisos")).error != null, "sin sesión no")
  const { data: p, error: e0 } = await admin.from("pacientes").insert({ optica_id: OP, nombre: MARCA, cedula: "ZY5544332", tipo_documento: "pasaporte", telefono: "0999999999", correo: "Sin Correo", fecha_nacimiento: "1990-01-01" }).select().single()
  if (e0) throw new Error(e0.message)
  const datos = { motivo: "Verif 0138", odEsfera: "-1.25" }
  const g = await opto.rpc("guardar_borrador_ficha", { p_paciente_id: p.id, p_cita_id: null, p_datos: datos })
  ok(!g.error, "el optómetra guarda un borrador" + (g.error ? " — " + g.error.message : ""))
  const l = await opto.rpc("leer_borrador_ficha", { p_paciente_id: p.id, p_cita_id: null })
  ok(l.data?.[0]?.datos?.odEsfera === "-1.25", "lo lee desde «otra computadora» (otra sesión)")
  ok((await ventas.rpc("guardar_borrador_ficha", { p_paciente_id: p.id, p_cita_id: null, p_datos: datos })).error != null, "ventas (sin Ficha clínica «crear») no puede")
  ok((await opto.from("fichas_borradores").select("*")).error != null, "la tabla no se lee directo")
  ok((await nuevo().rpc("leer_borrador_ficha", { p_paciente_id: p.id, p_cita_id: null })).error != null, "sin sesión no")
  const c1 = await rec.from("citas").insert({ optica_id: OP, paciente_id: p.id, paciente: MARCA, cedula: p.cedula, fecha: "2099-04-10", hora: "09:00 AM", estado: "Pendiente", motivo: "Consulta General" }).select().single()
  const c2 = await rec.from("citas").insert({ optica_id: OP, paciente_id: p.id, paciente: MARCA, cedula: p.cedula, fecha: "2099-04-11", hora: "09:00 AM", estado: "Pendiente", motivo: "Consulta General" }).select().single()
  await opto.rpc("guardar_borrador_ficha", { p_paciente_id: p.id, p_cita_id: c1.data.id, p_datos: datos })
  const h = await opto.rpc("heredar_borrador_ficha", { p_cita_origen: c1.data.id, p_cita_nueva: c2.data.id })
  ok(h.data === true, "la cita nueva hereda el borrador" + (h.error ? " — " + h.error.message : ""))
  const adm = await admin.rpc("leer_borrador_ficha", { p_paciente_id: p.id, p_cita_id: c2.data.id })
  ok(adm.data?.[0]?.datos?.motivo === "Verif 0138", "otro profesional (administrador) retoma el heredado")
  await opto.rpc("borrar_borrador_ficha", { p_paciente_id: p.id, p_cita_id: c2.data.id })
  ok(((await opto.rpc("leer_borrador_ficha", { p_paciente_id: p.id, p_cita_id: c2.data.id })).data || []).length === 0, "al terminar se borra")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await limpiar().catch((e) => console.error("limpieza:", e.message)); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Lo que se creó se borró.")
process.exit(fallos ? 1 : 0)
