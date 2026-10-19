// Verificación con sesiones REALES (por la API) de la migración 0121 ya aplicada: el estado del sistema, el personal y el uso de un módulo solo los ve el
// superadmin; nadie escribe en la tabla de verificaciones desde la aplicación; y la tarea de cada 15 minutos corre sola. No cambia datos de ninguna óptica.
// Las credenciales del superadmin se pasan por el entorno (no se guardan):
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0121.mjs
import { createClient } from "@supabase/supabase-js"

let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(email, password, nombre) {
  const c = nuevo()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo entrar como ${nombre}: ${error.message}`)
  return c
}

const sup = await sesion(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin")
const admin = await sesion(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD, "administrador (pruebas)")
const anon = nuevo()
const { data: solna } = await sup.from("opticas").select("id").eq("slug", "optica-solna").single()

// 1. El superadmin ve el estado
const { data: e, error: eErr } = await sup.rpc("estado_sistema")
ok(!eErr && e?.ultimos?.length === 5, `estado_sistema entrega lo último de los cinco componentes (${eErr?.message || e?.ultimos?.map((u) => `${u.componente}:${u.estado}`).join(", ")})`)
ok(Array.isArray(e?.historial) && Array.isArray(e?.fallos) && Array.isArray(e?.tareas), "entrega el historial, los fallos y las tareas programadas")
ok(e?.tareas?.some((t) => t.nombre === "verificar_sistema" && t.programacion === "*/15 * * * *"), "la verificación cada 15 minutos está programada")
const correo = e?.ultimos?.find((u) => u.componente === "correo")
ok(correo?.estado === "no_configurado", `el correo dice «No configurado» (${correo?.estado})`)

// 2. «Verificar ahora»
const { data: v, error: vErr } = await sup.rpc("verificar_sistema")
ok(!vErr && Array.isArray(v) && v.length === 5, `«Verificar ahora» guarda y devuelve las cinco verificaciones (${vErr?.message || "ok"})`)
const { data: filas, error: tErr } = await sup.from("verificaciones_sistema").select("id").limit(100)
ok(!tErr && filas.length >= 10, `el superadmin lee la tabla (${filas?.length} filas)`)

// 3. Nadie más ve ni escribe
for (const [nombre, c] of [["el administrador de una óptica", admin], ["sin sesión", anon]]) {
  ok(!!(await c.rpc("estado_sistema")).error, `${nombre} NO ve el estado del sistema`)
  ok(!!(await c.rpc("verificar_sistema")).error, `${nombre} NO puede verificar`)
  ok(!!(await c.rpc("personal_de_la_optica", { p_optica: solna.id })).error, `${nombre} NO ve el personal con su rol`)
  ok(!!(await c.rpc("uso_de_modulo", { p_optica: solna.id, p_modulo: "citas" })).error, `${nombre} NO ve el uso de módulos`)
}
const { data: lecturaAdmin } = await admin.from("verificaciones_sistema").select("id")
ok((lecturaAdmin?.length ?? 0) === 0, "el administrador de una óptica no lee la tabla de verificaciones")
const { error: insErr } = await sup.from("verificaciones_sistema").insert({ componente: "datos", estado: "operativo" })
ok(!!insErr, "ni el superadmin inserta filas desde la aplicación")
const { error: regErr } = await sup.rpc("_registrar_verificacion", { p_componente: "datos", p_estado: "operativo", p_ms: 1, p_detalle: null })
ok(!!regErr, "la función interna no se llama desde fuera")

// 4. Personal y uso, sin conteos ni datos de pacientes
const { data: per, error: pErr } = await sup.rpc("personal_de_la_optica", { p_optica: solna.id })
ok(!pErr && per.length >= 1 && per.every((x) => x.rol && "ultimo_ingreso" in x && "activa_30d" in x), `personal_de_la_optica entrega ${per?.length} persona(s) con rol y último ingreso`)
const { data: uso, error: uErr } = await sup.rpc("uso_de_modulo", { p_optica: solna.id, p_modulo: "citas" })
ok(!uErr && Array.isArray(uso.dias) && uso.dias.every((d) => Object.keys(d).sort().join() === "dia,roles"), "uso_de_modulo entrega solo días y roles (sin conteos)")
ok(!!(await sup.rpc("uso_de_modulo", { p_optica: solna.id, p_modulo: "inventado" })).error, "rechaza un módulo desconocido")

console.log(fallos === 0 ? "\nTodo pasó." : `\n${fallos} comprobación(es) fallaron.`)
process.exit(fallos === 0 ? 0 : 1)
