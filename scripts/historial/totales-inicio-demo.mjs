// Los totales de citas del Inicio de la Óptica Demo (hoy, esta semana, este mes y todas), leídos con la sesión REAL del administrador de la Demo (solo lectura), con la misma cuenta del Inicio
// (utilidades/inicio.js: «registradas» no incluyen canceladas; pendientes = registradas − atendidas − no efectuadas).
//   node --env-file=.env.local --env-file=.env.test scripts/historial/totales-inicio-demo.mjs
import { createClient } from "@supabase/supabase-js"
const cl = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
const { error } = await cl.auth.signInWithPassword({ email: process.env.DEMO_ADMIN_EMAIL, password: process.env.DEMO_ADMIN_PASSWORD })
if (error) throw new Error("No se pudo entrar como administrador de la Demo")
const { data: citas, error: e2 } = await cl.from("citas").select("id, fecha, estado, origen").limit(5000)
if (e2) throw new Error(e2.message)
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil" }).format(new Date())
const [y, m, d] = hoy.split("-").map(Number)
const dow = (new Date(y, m - 1, d).getDay() + 6) % 7
const iso = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`
const lunes = iso(new Date(y, m - 1, d - dow)), domingo = iso(new Date(y, m - 1, d - dow + 6))
const periodos = {
  hoy: (c) => c.fecha === hoy,
  semana: (c) => c.fecha >= lunes && c.fecha <= domingo,
  mes: (c) => c.fecha.slice(0, 7) === hoy.slice(0, 7),
  todas: () => true,
}
const filas = Object.entries(periodos).map(([p, f]) => {
  const l = citas.filter(f)
  const n = (e) => l.filter((c) => c.estado === e).length
  const registradas = l.filter((c) => c.estado !== "Cancelada").length
  return { periodo: p, registradas, atendidas: n("Atendida"), noEfectuadas: n("No Asistió"), pendientes: registradas - n("Atendida") - n("No Asistió"), canceladas: n("Cancelada") }
})
console.log(`Óptica Demo · hoy ${hoy} · semana ${lunes} al ${domingo} · ${citas.length} citas en total`)
console.table(filas)
