// Verificación de 0147 YA APLICADA, con sesión real (administrador de la óptica de pruebas) por la API. Limpia lo que crea.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0147.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const db = new pg.Client(); await db.connect()
const creadas = []
try {
  const { data, error } = await s.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
  if (error) throw new Error("No se pudo entrar: " + error.message)
  const optica = (await db.query("select optica_id from perfiles where id = $1", [data.user.id])).rows[0].optica_id
  const pac = (await db.query("select id from pacientes_base where optica_id = $1 limit 1", [optica])).rows[0].id
  let r = await s.rpc("crear_campana_crm", { p_nombre: "Verificación 0147 sin quitados", p_grupo: "promociones", p_mensaje: "Hola {nombre}, una promoción." })
  ok(!r.error && r.data, "crea una campaña sin pasar quitados" + (r.error ? " — " + r.error.message : "")); if (r.data) creadas.push(r.data)
  r = await s.rpc("crear_campana_crm", { p_nombre: "Verificación 0147 con quitados", p_grupo: "promociones", p_mensaje: "Hola {nombre}, una promoción.", p_excluidos: [pac, "00000000-0000-0000-0000-000000000000"] })
  ok(!r.error && r.data, "crea una campaña con quitados" + (r.error ? " — " + r.error.message : "")); if (r.data) creadas.push(r.data)
  const { data: filas, error: e2 } = await s.from("crm_campanas").select("id, excluidos").in("id", creadas)
  const con = (filas || []).find((f) => f.id === creadas[1]), sin = (filas || []).find((f) => f.id === creadas[0])
  ok(!e2 && con?.excluidos?.length === 1 && con.excluidos[0] === pac, "guarda solo el paciente de su óptica (el inexistente se descarta)")
  ok(sin?.excluidos?.length === 0, "la campaña sin quitados queda con la lista vacía")
  const anon = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const a = await anon.rpc("crear_campana_crm", { p_nombre: "Anon", p_grupo: "promociones", p_mensaje: "Hola {nombre}, una promoción." })
  ok(!!a.error, "sin sesión no se puede crear: " + a.error?.message)
} catch (e) { console.error("ERROR", e.message); fallos++ } finally {
  for (const id of creadas) await db.query("delete from crm_campanas where id = $1", [id])
  await db.query("delete from logs_optica where modulo = 'crm' and accion = 'Creó una campaña' and detalle like 'Verificación 0147%'")
  await db.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien: verificado con sesión real y limpio.")
process.exit(fallos ? 1 : 0)
