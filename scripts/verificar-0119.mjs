// Verificación con sesiones REALES (por la API, no por la pantalla) de la migración 0119 ya aplicada (panel del superadmin v2):
// óptica de prueba, datos del negocio, restaurar roles y registro de actividad que no se borra ni se edita.
// Las credenciales del superadmin se pasan por el entorno (no se guardan en ningún archivo):
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0119.mjs
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
const admin = await sesion(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD, "administrador de la óptica de pruebas")
const paula = await sesion(process.env.E2E_OPTOMETRA_EMAIL, process.env.E2E_OPTOMETRA_PASSWORD, "optómetra de la óptica de pruebas")
const anon = nuevo()

// 1. Óptica de prueba
const { data: opticas } = await sup.from("opticas").select("id, slug, es_de_prueba")
const pruebas = opticas.filter((o) => o.es_de_prueba).map((o) => o.slug).sort().join(",")
ok(pruebas === "3pldf1,qu7u2j,v8twzq", `quedaron marcadas solo Demo, QA Test Claude y la vacía (${pruebas})`)
const demo = opticas.find((o) => o.slug === "qu7u2j")
const qa = opticas.find((o) => o.slug === "v8twzq")
const { error: eAdmin } = await admin.from("opticas").update({ es_de_prueba: false }).eq("id", qa.id)
ok(!!eAdmin, `el administrador de la óptica NO puede cambiar la marca (${eAdmin?.message?.slice(0, 60)})`)
const { data: sigue } = await sup.from("opticas").select("es_de_prueba").eq("id", qa.id).single()
ok(sigue.es_de_prueba === true, "la marca de QA Test Claude sigue puesta")
const { error: eSup } = await sup.from("opticas").update({ es_de_prueba: false }).eq("id", demo.id)
const { data: cambio } = await sup.from("opticas").select("es_de_prueba").eq("id", demo.id).single()
ok(!eSup && cambio.es_de_prueba === false, "el superadmin sí puede cambiarla (se restaura enseguida)")
await sup.from("opticas").update({ es_de_prueba: true }).eq("id", demo.id)
ok((await sup.from("opticas").select("es_de_prueba").eq("id", demo.id).single()).data.es_de_prueba === true, "la Demo quedó otra vez como óptica de prueba")

// 2. Datos del negocio
const { data: d, error: eD } = await sup.rpc("datos_negocio_superadmin")
ok(!eD && Array.isArray(d.personas) && d.personas.length > 0, `el superadmin recibe las personas (${d?.personas?.length})`)
ok(d.personas.some((p) => p.ultimo_ingreso), "al menos una persona trae su último ingreso")
ok(d.opticas.length === opticas.length && d.opticas.every((o) => "citas" in o && "pacientes" in o && "asistentes" in o && o.previo), "una fila de uso por óptica, con los 30 días anteriores")
ok(!/clave|password|token|email/i.test(JSON.stringify(d)), "no entrega correos, claves ni tokens")
for (const [n, c] of [["administrador", admin], ["optómetra", paula], ["sin sesión", anon]]) {
  const { error } = await c.rpc("datos_negocio_superadmin")
  ok(!!error, `${n}: datos_negocio_superadmin se le niega`)
}

// 3. Roles de la óptica vacía: restaurar los predefinidos
const vacia = opticas.find((o) => o.slug === "3pldf1")
const { data: rol } = await sup.from("roles").select("id, permisos").eq("optica_id", vacia.id).eq("clave", "recepcion").single()
const original = rol.permisos
await sup.from("roles").update({ permisos: { citas: ["ver"] } }).eq("id", rol.id)
const { data: n, error: eR } = await sup.rpc("restaurar_roles_predefinidos", { p_optica_id: vacia.id })
const { data: despues } = await sup.from("roles").select("permisos").eq("id", rol.id).single()
ok(!eR && n === 3 && JSON.stringify(despues.permisos) === JSON.stringify(original), "restaurar devuelve Recepción a como estaba (la plantilla actual)")
ok((await sup.from("roles").select("id").eq("optica_id", vacia.id).eq("es_predefinido", true)).data.length === 3, "siguen siendo tres roles predefinidos")
for (const [nombre, c] of [["administrador", admin], ["sin sesión", anon]]) {
  const { error } = await c.rpc("restaurar_roles_predefinidos", { p_optica_id: vacia.id })
  ok(!!error, `${nombre}: restaurar_roles_predefinidos se le niega`)
}

// 4. Registro de actividad
const marca = `verificar-0119-${Date.now()}`
const { data: yo } = await sup.auth.getUser()
const nueva = await sup.from("auditoria").insert({ actor_id: yo.user.id, actor_nombre: "Verificación", accion: "cambiar_suscripcion", optica_id: qa.id, optica_nombre: "QA Test Claude", detalle: marca, antes: "a", despues: "b" }).select("id").single()
ok(!nueva.error, "el superadmin registra una acción nueva con antes y después")
const { error: eBorrar } = await sup.from("auditoria").delete().eq("id", nueva.data?.id)
const { data: sigueAhi } = await sup.from("auditoria").select("id").eq("id", nueva.data?.id)
ok(sigueAhi.length === 1, `no se puede borrar (${eBorrar?.message?.slice(0, 50) || "0 filas"})`)
await sup.from("auditoria").update({ detalle: "editado" }).eq("id", nueva.data?.id)
ok((await sup.from("auditoria").select("detalle").eq("id", nueva.data?.id).single()).data.detalle === marca, "no se puede editar")
ok((await sup.from("auditoria").insert({ actor_id: yo.user.id, actor_nombre: "x", accion: "accion_inventada", optica_nombre: "x" })).error !== null, "una acción que no existe se rechaza")
ok((await admin.from("auditoria").select("id")).data?.length === 0, "el administrador de una óptica no lee la actividad del superadmin")
{ const r = await anon.from("auditoria").select("id"); ok(!!r.error || (r.data || []).length === 0, "sin sesión tampoco (no recibe filas)") }
console.log(`(queda 1 registro de la verificación: «${marca}»; la actividad no se puede borrar a propósito)`)

console.log(fallos === 0 ? "\nVerificación completa: todo pasó." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
