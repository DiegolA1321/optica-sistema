// Verificación de la migración 0111 YA aplicada, con sesiones REALES por la API (PostgREST), no con SQL directo.
// Escribe solo en la óptica de pruebas (producto "E2E verificación 0111", que la limpieza de las pruebas borra).
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0111.mjs
import { createClient } from "@supabase/supabase-js"

const URL = process.env.VITE_SUPABASE_URL, KEY = process.env.VITE_SUPABASE_ANON_KEY
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const sesion = async (pref, ent) => {
  const c = createClient(URL, KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: process.env[`${ent}_${pref}_EMAIL`], password: process.env[`${ent}_${pref}_PASSWORD`] })
  if (error) throw new Error(`sin sesión ${ent} ${pref}`)
  const { data: p } = await c.from("perfiles").select("optica_id").eq("id", data.user.id).single()
  return { c, id: data.user.id, optica: p.optica_id }
}

const admin = await sesion("ADMIN", "E2E")
const demo = await sesion("ADMIN", "DEMO")
const anonimo = createClient(URL, KEY, { auth: { persistSession: false } })

const nombre = "E2E verificación 0111"
await admin.c.from("inventario").delete().eq("nombre", nombre) // por si quedó uno (sin kárdex puede borrarse; con kárdex fallará y se ignora)
let { data: prod, error } = await admin.c.from("inventario").insert({ optica_id: admin.optica, nombre, categoria: "Montura", stock: 10, precio: 50 }).select().single()
if (error) { const r = await admin.c.from("inventario").select("*").eq("nombre", nombre).single(); prod = r.data }
ok(!!prod, "el administrador crea un producto con la pantalla publicada (insert directo)")
const movs = async () => (await admin.c.from("movimientos_inventario").select("tipo,cantidad,stock_resultante,motivo,usuario_nombre").eq("producto_id", prod.id).order("created_at").order("seq")).data
let m = await movs()
ok(m.length >= 1 && m[0].tipo === "saldo_inicial", "…y nace con su saldo inicial")

let r = await admin.c.rpc("registrar_movimiento_inventario", { p_producto_id: prod.id, p_tipo: "ingreso_compra", p_cantidad: 5, p_motivo: "Verificación real" })
ok(!r.error && r.data === 15 || (!r.error && r.data === prod.stock + 5), "ingreso por la API: existencia " + r.data)
r = await admin.c.rpc("registrar_movimiento_inventario", { p_producto_id: prod.id, p_tipo: "merma", p_cantidad: -1000, p_motivo: "Demasiado" })
ok(!!r.error && /No hay tantas unidades/.test(r.error.message), "una merma de más es rechazada: " + r.error?.message)
r = await admin.c.rpc("registrar_movimiento_inventario", { p_producto_id: prod.id, p_tipo: "ingreso_compra", p_cantidad: 1, p_motivo: "" })
ok(!!r.error && /motivo/.test(r.error.message), "sin motivo es rechazado: " + r.error?.message)

const { data: pac } = await admin.c.from("pacientes").select("id").limit(1)
let paciente = pac?.[0]?.id
if (!paciente) {
  const ins = await admin.c.from("pacientes").insert({ optica_id: admin.optica, nombre: "E Dos E Verificación", cedula: "1700000010", telefono: "0990000010", correo: "Sin Correo", fecha_nacimiento: "1990-05-15", evolucion: "Sin evaluación", ultima_consulta: "Pendiente", fecha_registro: new Date().toISOString().slice(0, 10), estado_clinico: "Activo" }).select("id").single()
  paciente = ins.data?.id
}
const venta = await admin.c.rpc("crear_factura_venta", { p_optica_id: admin.optica, p_paciente_id: paciente, p_metodo_pago: "directo", p_registrado_por: admin.id, p_lineas: [{ producto_id: prod.id, tipo: "producto", descripcion: nombre, cantidad: 2, precio_unitario: 50 }] })
ok(!venta.error, "vender con la función publicada sigue funcionando" + (venta.error ? ": " + venta.error.message : ""))
const factura = Array.isArray(venta.data) ? venta.data[0] : venta.data
m = await movs()
const v = m.at(-1)
ok(v?.tipo === "venta" && v.cantidad === -2, "…y deja su movimiento de venta (−2, queda " + v?.stock_resultante + ")")
ok(!!v?.usuario_nombre, "…con quién lo hizo: " + v?.usuario_nombre)
const anul = await admin.c.rpc("anular_factura_venta", { p_factura_id: factura.id, p_motivo: "Verificación", p_anulada_por: admin.id })
ok(!anul.error, "anular con la función publicada sigue funcionando")
m = await movs()
ok(m.at(-1)?.tipo === "anulacion_venta" && m.at(-1).cantidad === 2, "…y deja su movimiento de anulación (+2)")

const cont = await admin.c.rpc("registrar_conteo_inventario", { p_conteos: [{ producto_id: prod.id, contado: 3 }] })
ok(!cont.error && cont.data?.length === 1, "el conteo físico registra la diferencia")
m = await movs()
ok(m.at(-1)?.tipo === "ajuste_conteo" && m.at(-1).motivo === "Conteo físico" && m.at(-1).stock_resultante === 3, "…como ajuste por conteo con el motivo «Conteo físico»")
const suma = m.reduce((s, x) => s + x.cantidad, 0)
ok(suma === 3, "la suma del kárdex da la existencia (3)")

const mod = await admin.c.from("movimientos_inventario").update({ cantidad: 99 }).eq("producto_id", prod.id)
ok(!!mod.error, "nadie edita un movimiento por la API: " + mod.error?.message)
const bor = await admin.c.from("movimientos_inventario").delete().eq("producto_id", prod.id)
ok(!!bor.error, "ni lo borra: " + bor.error?.message)
const elim = await admin.c.from("inventario").delete().eq("id", prod.id)
ok(!!elim.error, "un producto con movimientos no se elimina: " + elim.error?.message?.slice(0, 80))

const ajeno = await demo.c.from("movimientos_inventario").select("id").eq("producto_id", prod.id)
ok(!ajeno.error && ajeno.data.length === 0, "el administrador de otra óptica no lee su kárdex")
const ajeno2 = await demo.c.rpc("registrar_movimiento_inventario", { p_producto_id: prod.id, p_tipo: "ingreso_compra", p_cantidad: 1, p_motivo: "ajeno" })
ok(!!ajeno2.error, "…ni ajusta su producto: " + ajeno2.error?.message)
const anon = await anonimo.from("movimientos_inventario").select("id")
ok(!!anon.error || (anon.data || []).length === 0, "sin sesión no se lee nada: " + (anon.error?.message || "0 filas"))
const anon2 = await anonimo.rpc("registrar_movimiento_inventario", { p_producto_id: prod.id, p_tipo: "ingreso_compra", p_cantidad: 1, p_motivo: "anon" })
ok(!!anon2.error, "…ni se registra: " + anon2.error?.message)

const cats = await admin.c.from("opticas").select("categorias_inventario").eq("id", admin.optica).single()
ok(!(cats.data.categorias_inventario || []).includes("Armazones"), "el catálogo de categorías ya no trae 'Armazones'")
console.log(fallos === 0 ? "\nTodo bien." : `\n${fallos} comprobaciones fallaron.`)
process.exitCode = fallos === 0 ? 0 : 1
