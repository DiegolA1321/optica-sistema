// Verificación con sesión REAL de paciente (API + token) de la migración 0133 en la óptica de pruebas: la receta del portal trae lo nuevo de la ficha y nada más. Deja todo limpio.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0133.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0].id
const dc = {
  od: { esfera: "-1.75", cilindro: "-0.75", eje: "10", avSc: "20/50", avCc: "20/25", avRx: "20/20", avRxF: "2" }, oi: { esfera: "-1.00", cilindro: "-0.50", eje: "180", avSc: "20/40", avCc: "20/25", avRx: "20/25" },
  medidas: { adicion: "+1.50", adicionOd: "+1.50", adicionOi: "+1.75", dp: "62", dpOd: "31", dpOi: "31", dpCerca: "59", prismaOdCant: "2", prismaOdBase: "Nasal" },
  examen: { pioOd: "14" }, ficha: { v: 2, anamnesis: { sintomas: ["Dolor de cabeza"] }, salud: { pio: { od: "14" } } },
}
let id = null
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  id = (await q("insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, datos_clinicos, antecedentes, alergias) values ($1, $2, 'E Dos E Portal Auditoria', '2099-01-01', 'Control', $3::jsonb, 'Diabetes', 'Penicilina') returning id", [OP, P, JSON.stringify(dc)]))[0].id
  const mis = await api.rpc("mis_consultas_paciente", { p_paciente_id: P, p_token: token })
  const fila = (mis.data || []).find((x) => x.id === id)
  ok(!!fila, "el paciente ve su consulta por la API")
  const d = fila?.datos_clinicos || {}
  ok(d.od?.avRx === "20/20" && d.od?.avRxF === "2" && d.oi?.avRx === "20/25", "recibe la agudeza con la receta nueva")
  ok(d.medidas?.adicionOd === "+1.50" && d.medidas?.adicionOi === "+1.75" && d.medidas?.prismaOdCant === "2", "recibe la adición por ojo y el prisma")
  const permite = (await q("select portal_muestra_montaje($1) m", [P]))[0].m
  ok(permite ? d.medidas?.dpOd === "31" : !("dpOd" in (d.medidas || {})) && !("dp" in (d.medidas || {})), `la distancia pupilar ${permite ? "viaja (la óptica lo permite)" : "NO viaja (la óptica no lo permite)"}`)
  const todo = JSON.stringify(fila)
  ok(!todo.includes("Diabetes") && !todo.includes("Penicilina") && !todo.includes("anamnesis") && !todo.includes("pioOd") && !todo.includes("Dolor de cabeza"), "no recibe anamnesis, antecedentes, alergias ni salud ocular")
  const exp = await api.rpc("exportar_mis_datos_paciente", { p_paciente_id: P, p_token: token })
  ok(JSON.stringify(exp.data?.consultas || []).includes("anamnesis"), "«Descargar mis datos» sí incluye la ficha completa (derecho de acceso)")
  const otro = await api.rpc("mis_consultas_paciente", { p_paciente_id: P, p_token: "inventado" })
  ok((otro.data || []).length === 0, "con un token inventado no recibe nada")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  if (id) await c.query("delete from consultas where id = $1", [id])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
