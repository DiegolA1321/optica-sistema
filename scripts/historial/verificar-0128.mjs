// Verificación con sesión REAL de paciente (la API, con el token del inicio de sesión) de la migración 0128, en la óptica de pruebas.
// Crea dos pacientes que el paciente fijo del portal refirió (uno por id y otro por nombre) y uno anonimizado, y los borra al terminar.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0128.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id, nombre from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
const creados = []
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  const antes = await api.rpc("mis_referidos_paciente", { p_paciente_id: P.id, p_token: token })
  ok(!antes.error && typeof antes.data === "number", "la función responde un número")
  const base = Number(antes.data)
  const [modelo] = await q("select * from pacientes_base where id = $1", [P.id])
  const clonar = async (cedula, nombre, extra) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [modelo.id])
    await c.query("update t_p set id = gen_random_uuid(), nombre = $2, cedula = $1, usuario = null, clave_temporal = null, sesion_token = null, referido_por = $3, referido_por_id = $4, anonimizado_en = $5", [cedula, nombre, extra.referidoPor ?? null, extra.referidoPorId ?? null, extra.anonimizadoEn ?? null])
    const id = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
    creados.push(id)
    return id
  }
  await clonar("0900000061", "Referido por id 0128", { referidoPorId: P.id })
  await clonar("0900000062", "Referido por nombre 0128", { referidoPor: P.nombre })
  await clonar("0900000063", "Referido anonimizado 0128", { referidoPorId: P.id, anonimizadoEn: new Date().toISOString() })
  const despues = await api.rpc("mis_referidos_paciente", { p_paciente_id: P.id, p_token: token })
  ok(Number(despues.data) === base + 2, `cuenta los dos referidos (por id y por nombre) y no el anonimizado (${base} → ${despues.data})`)
  ok((await api.rpc("mis_referidos_paciente", { p_paciente_id: P.id, p_token: "inventado" })).data === 0, "con un token inventado: 0")
  const otro = await q("select id from pacientes_base where optica_id = $1 and id <> $2 and anonimizado_en is null and id <> all($3) limit 1", [OP, P.id, creados])
  if (otro[0]) ok((await api.rpc("mis_referidos_paciente", { p_paciente_id: otro[0].id, p_token: token })).data === 0, "el token de un paciente no sirve para contar los referidos de otro")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  if (creados.length) await c.query("delete from pacientes_base where id = any($1)", [creados])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
