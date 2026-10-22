// Verificación de la 0141 con SESIÓN REAL (administrador de la óptica de pruebas): guarda y quita un máximo propio por la API y deja todo como estaba.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0141.mjs
import { createClient } from "@supabase/supabase-js"
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const { data: ses, error: e0 } = await s.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
ok(!e0, "sesión del administrador de pruebas" + (e0 ? " — " + e0.message : ""))
const { data: perfil } = await s.from("perfiles").select("optica_id").eq("id", ses.user.id).maybeSingle()
const { data: nuevo, error: e1 } = await s.from("inventario").insert({ optica_id: perfil.optica_id, nombre: "VERIFICAR 0141", categoria: "Monturas", stock: 40, precio: 1, stock_maximo: 30 }).select().single()
ok(!e1 && nuevo?.stock_maximo === 30 && nuevo?.stock === 40, "guarda un máximo propio y no limita la existencia" + (e1 ? " — " + e1.message : ""))
const { data: leido } = await s.from("inventario").select("stock_maximo").eq("id", nuevo.id).single()
ok(leido?.stock_maximo === 30, "la API lo devuelve")
const { error: e2 } = await s.from("inventario").update({ stock_maximo: 0 }).eq("id", nuevo.id)
ok(!!e2, "un máximo de 0 se rechaza")
const { data: antes } = await s.from("inventario").select("id", { count: "exact", head: true }).not("stock_maximo", "is", null)
await s.from("inventario").update({ activo: false, stock_maximo: null }).eq("id", nuevo.id) // un producto con movimientos no se borra: se descontinúa
const { data: post } = await s.from("inventario").select("activo").eq("id", nuevo.id)
ok(post[0]?.activo === false, "el producto de prueba queda descontinuado")
process.exit(fallos ? 1 : 0)
