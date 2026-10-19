// Verificación con sesión REAL (paciente por la API con su token; personal con la sesión del administrador de la óptica de pruebas) de la migración 0132. Deja todo limpio.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0132.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const url = process.env.VITE_SUPABASE_URL, anon = process.env.VITE_SUPABASE_ANON_KEY
const api = createClient(url, anon, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
const limpiar = async () => {
  await c.query("delete from solicitudes_medidas where paciente_id = $1", [P.id])
  await c.query("update pacientes_base set medidas_solicitadas_en = null where id = $1", [P.id])
  await c.query("delete from logs_optica where optica_id = $1 and accion in ('El paciente pidió sus medidas de montaje', 'Envió las medidas de montaje al paciente', 'Agendó la toma de medidas de montaje') and detalle = 'E Dos E Portal Auditoria'", [OP])
}
try {
  await limpiar()
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  const pide = await api.rpc("solicitar_medidas_paciente", { p_paciente_id: P.id, p_token: token })
  ok(pide.data === true, "pide sus medidas por la API")
  const v1 = await api.rpc("mi_solicitud_medidas_paciente", { p_paciente_id: P.id, p_token: token })
  ok(!!v1.data?.abierta_desde && v1.data.ultima === null, "la ve abierta")
  ok((await api.rpc("mi_solicitud_medidas_paciente", { p_paciente_id: P.id, p_token: "inventado" })).data === null, "con un token inventado no ve nada")
  ok((await api.rpc("cerrar_solicitud_medidas", { p_paciente_id: P.id, p_resultado: "enviadas", p_dp: "62", p_altura: "18" })).error != null, "el paciente (anónimo) no puede cerrarla")
  ok(((await api.from("solicitudes_medidas").select("id")).data ?? []).length === 0, "la tabla no se lee sin sesión del personal")

  const { data: ses, error: e2 } = await api.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
  ok(!e2 && !!ses?.session, "el administrador inicia sesión de verdad")
  const staff = createClient(url, anon, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${ses.session.access_token}` } } })
  const vacio = await staff.rpc("cerrar_solicitud_medidas", { p_paciente_id: P.id, p_resultado: "enviadas", p_dp: null, p_altura: null })
  ok(vacio.error?.message?.includes("No hay medidas"), "no se envían medidas vacías")
  const cierra = await staff.rpc("cerrar_solicitud_medidas", { p_paciente_id: P.id, p_resultado: "enviadas", p_dp: "62", p_altura: "18" })
  ok(cierra.data === true, "la óptica marca las medidas como enviadas" + (cierra.error ? " — " + cierra.error.message : ""))
  const v2 = await api.rpc("mi_solicitud_medidas_paciente", { p_paciente_id: P.id, p_token: token })
  ok(v2.data?.abierta_desde === null && v2.data.ultima?.dp === "62" && v2.data.ultima?.altura === "18", "el paciente ve las medidas que le enviaron")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and detalle = 'E Dos E Portal Auditoria' and accion in ('El paciente pidió sus medidas de montaje', 'Envió las medidas de montaje al paciente')", [OP]))[0].n === 2, "pedirlas y enviarlas quedan en la actividad")
  ok((await staff.rpc("cerrar_solicitud_medidas", { p_paciente_id: P.id, p_resultado: "enviadas", p_dp: "62", p_altura: "18" })).data === false, "cerrarla otra vez no hace nada")
  const hist = await staff.from("solicitudes_medidas").select("resultado").eq("paciente_id", P.id)
  ok(hist.data?.length === 1, "el personal con permiso lee el historial")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  await limpiar()
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
