// Verificación de la migración 0113 YA aplicada, con sesiones REALES por la API (óptica de pruebas; la limpieza borra lo que deja).
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0113.mjs
import { createClient } from "@supabase/supabase-js"
const URL = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_ANON_KEY
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const sesion = async (pref, ent) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: process.env[`${ent}_${pref}_EMAIL`], password: process.env[`${ent}_${pref}_PASSWORD`] })
  if (error) throw new Error(`sin sesión ${ent} ${pref}`)
  const { data: p } = await c.from("perfiles").select("optica_id").eq("id", data.user.id).single()
  return { c, optica: p.optica_id }
}
const admin = await sesion("ADMIN", "E2E"), recep = await sesion("RECEPCION", "E2E"), demo = await sesion("ADMIN", "DEMO")
const anon = createClient(URL, KEY, { auth: { persistSession: false } })
const nombre = "E2E verificación 0113"
let { data: prod, error } = await admin.c.from("inventario").insert({ optica_id: admin.optica, nombre, categoria: "Monturas", stock: 10, precio: 50 }).select().single()
if (error) prod = (await admin.c.from("inventario").select("*").eq("nombre", nombre).single()).data
ok(!("costo" in prod), "inventario ya no trae la columna costo")
let r = await admin.c.from("inventario_costos").upsert({ producto_id: prod.id, optica_id: admin.optica, costo: 20 })
ok(!r.error, "el administrador registra el costo" + (r.error ? ": " + r.error.message : ""))
r = await admin.c.from("inventario_costos").select("costo").eq("producto_id", prod.id)
ok(r.data?.length === 1 && Number(r.data[0].costo) === 20, "…y lo lee")
r = await recep.c.from("inventario").select("*").eq("id", prod.id)
ok(r.data?.length === 1 && !("costo" in r.data[0]), "Recepción (solo ve) ve el producto, sin costo en la fila")
r = await recep.c.from("inventario_costos").select("costo").eq("producto_id", prod.id)
ok(!r.error && r.data.length === 0, "…y la tabla de costos le devuelve 0 filas (sin error)")
r = await recep.c.from("inventario_costos").update({ costo: 1 }).eq("producto_id", prod.id).select()
ok((r.data || []).length === 0, "…ni puede cambiarlo")
r = await recep.c.from("inventario_costos").insert({ producto_id: prod.id, optica_id: recep.optica, costo: 1 })
ok(!!r.error, "…ni escribir uno: " + r.error?.message)
r = await demo.c.from("inventario_costos").select("costo").eq("producto_id", prod.id)
ok((r.data || []).length === 0, "el administrador de otra óptica no lo lee")
r = await anon.from("inventario_costos").select("costo")
ok(!!r.error, "sin sesión no se lee: " + r.error?.message)

const c = await admin.c.rpc("registrar_conteo_inventario", { p_conteos: [{ producto_id: prod.id, contado: 8 }] })
ok(!c.error && c.data?.conteo_id && c.data.ajustes.length === 1, "el conteo devuelve su acta" + (c.error ? ": " + c.error.message : ""))
r = await admin.c.from("conteos_inventario").select("*").eq("id", c.data.conteo_id).single()
ok(Number(r.data.valor_precio) === -100 && Number(r.data.valor_costo) === -40 && r.data.productos_contados === 1, "…con su valor en dinero (−$100 a precio, −$40 a costo)")
r = await recep.c.from("conteos_inventario").select("id")
ok((r.data || []).length === 0, "Recepción no lee las actas")
r = await admin.c.from("conteos_inventario").update({ unidades_faltantes: 0 }).eq("id", c.data.conteo_id)
ok(!!r.error, "nadie edita un acta por la API: " + r.error?.message)
r = await admin.c.from("conteos_inventario").delete().eq("id", c.data.conteo_id)
ok(!!r.error, "ni la borra: " + r.error?.message)
r = await demo.c.from("conteos_inventario").select("id").eq("id", c.data.conteo_id)
ok((r.data || []).length === 0, "otra óptica no la lee")
console.log(fallos === 0 ? "\nTodo bien." : `\n${fallos} comprobaciones fallaron.`)
process.exitCode = fallos === 0 ? 0 : 1
