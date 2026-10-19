// Verificación con sesión REAL de paciente (la API, con el token del inicio de sesión) de la migración 0129, en la óptica de pruebas. Borra lo que crea.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0129.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
let creada = null
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  await c.query("delete from pases_a_venta where paciente_id = $1 and origen = 'portal'", [P.id])
  const s = await api.rpc("solicitar_lentes_paciente", { p_paciente_id: P.id, p_token: token, p_interes: "montura_nueva", p_comentario: "Prueba 0129" })
  creada = s.data
  ok(!s.error && typeof creada === "string", "solicita por la API con su token" + (s.error ? " — " + s.error.message : ""))
  const mis = await api.rpc("mis_solicitudes_lentes_paciente", { p_paciente_id: P.id, p_token: token })
  ok(mis.data?.length === 1 && mis.data[0].estado === "recibida", "la ve «recibida»")
  ok((await api.rpc("solicitar_lentes_paciente", { p_paciente_id: P.id, p_token: token, p_interes: "lentes_de_sol" })).error?.message?.includes("Ya tienes"), "la segunda se rechaza con mensaje claro")
  ok((await api.rpc("solicitar_lentes_paciente", { p_paciente_id: P.id, p_token: "inventado", p_interes: "lentes_de_sol" })).error != null, "con un token inventado se rechaza")
  const directo = await api.from("pases_a_venta").select("id").eq("paciente_id", P.id)
  ok((directo.data ?? []).length === 0, "sin sesión del personal la tabla no se lee directo")
  const ins = await api.from("pases_a_venta").insert({ optica_id: OP, paciente_id: P.id, origen: "portal", interes: "montura_nueva" })
  ok(ins.error != null, "tampoco se escribe directo")
  const compras = await api.rpc("mis_compras_paciente", { p_paciente_id: P.id, p_token: token })
  ok(!compras.error && (compras.data ?? []).every((x) => "cita_id" in x), "mis_compras_paciente trae cita_id")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  await c.query("delete from pases_a_venta where paciente_id = $1 and origen = 'portal'", [P.id])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
