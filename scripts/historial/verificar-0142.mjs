// Verificación de la 0142 con SESIÓN REAL (administrador de la óptica de pruebas): crea pedidos por la API con entrega y los corrige. Un pedido de prueba no se puede cancelar por la API (solo al anular la venta): hay que borrarlo aparte por la conexión directa.
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0142.mjs
import { createClient } from "@supabase/supabase-js"
const s = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const { data: ses, error: e0 } = await s.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
ok(!e0, "sesión del administrador de pruebas" + (e0 ? " — " + e0.message : ""))
const { data: perfil } = await s.from("perfiles").select("optica_id").eq("id", ses.user.id).maybeSingle()
const { data: facturas } = await s.from("facturas_venta").select("id").eq("optica_id", perfil.optica_id).neq("estado", "anulada").limit(1)
if (!facturas?.length) { console.log("(la óptica de pruebas no tiene una venta vigente: no se puede crear un pedido de prueba)"); process.exit(1) }
const f = facturas[0].id
const d = (x = {}) => ({ tipo_lente: "monofocal", fecha_prometida: "2026-11-05", receta_od: {}, receta_oi: {}, ...x })
const ids = []
const { error: e1 } = await s.rpc("crear_orden_laboratorio", { p_factura_id: f, p_datos: d({ entrega: "envio" }) })
ok(!!e1 && /dirección de envío/.test(e1.message), "un envío sin dirección se rechaza por la API: " + (e1?.message || "sin error"))
const { data: id1, error: e2 } = await s.rpc("crear_orden_laboratorio", { p_factura_id: f, p_datos: d({ entrega: "envio", direccion_entrega: "Av. Sol 12 y Luna" }) })
ok(!e2 && id1, "crea un pedido con envío y dirección" + (e2 ? " — " + e2.message : "")); if (id1) ids.push(id1)
const { data: fila } = await s.from("ordenes_laboratorio").select("entrega, direccion_entrega, estado").eq("id", id1).single()
ok(fila?.entrega === "envio" && fila?.direccion_entrega === "Av. Sol 12 y Luna" && fila?.estado === "enviada", "la API devuelve la entrega, la dirección y «en proceso»")
const { data: id2, error: e3 } = await s.rpc("crear_orden_laboratorio", { p_factura_id: f, p_datos: d() })
ok(!e3 && id2, "un pedido sin entrega (cliente viejo) se crea" + (e3 ? " — " + e3.message : "")); if (id2) ids.push(id2)
const { data: f2 } = await s.from("ordenes_laboratorio").select("entrega, direccion_entrega").eq("id", id2).single()
ok(f2?.entrega === "retira" && f2?.direccion_entrega === null, "y queda «retira», sin dirección")
const { error: e4 } = await s.rpc("actualizar_orden_laboratorio", { p_orden_id: id1, p_datos: { entrega: "retira" } })
const { data: f3 } = await s.from("ordenes_laboratorio").select("entrega, direccion_entrega").eq("id", id1).single()
ok(!e4 && f3?.entrega === "retira" && f3?.direccion_entrega === null, "corregir a «retira» quita la dirección")
const { error: e5 } = await s.rpc("cambiar_estado_orden", { p_orden_id: id1, p_estado: "lista" })
ok(!e5, "marcar listo sigue funcionando" + (e5 ? " — " + e5.message : ""))
const { data: viejas } = await s.from("ordenes_laboratorio").select("entrega").eq("optica_id", perfil.optica_id).limit(50)
ok((viejas || []).every((o) => o.entrega === "retira" || o.entrega === "envio"), "todos los pedidos de la óptica tienen una entrega válida")
console.log("Pedidos de prueba creados (borrar por la conexión directa):", ids.join(", "))
process.exit(fallos ? 1 : 0)
