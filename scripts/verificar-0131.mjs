// Verificación con sesiones REALES (paciente y administrador, por la API) de la migración 0131, en la óptica de pruebas. Deja todo como estaba.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0131.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const api = nuevo()
const staff = nuevo()
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id, datos_bancarios from opticas where slug = 'v8twzq'"))[0]
const P = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP.id]))[0]
const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP.id]))[0].id
const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP.id]))[0].n
const F = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 30, 'pendiente_pago', $3, $4) returning id`, [OP.id, P.id, admin, numero]))[0].id
const FOTO = Buffer.from("comprobante de prueba ".repeat(20)).toString("base64")
const pagos = []
try {
  await c.query("update opticas set datos_bancarios = $2 where id = $1", [OP.id, JSON.stringify({ banco: "Banco Pruebas", tipo_cuenta: "Ahorros", numero: "1234567890", titular: "Óptica de pruebas" })])
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP.id })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad")
  const datos = await api.rpc("datos_transferencia_paciente", { p_paciente_id: P.id, p_token: token })
  ok(datos.data?.datos_bancarios?.banco === "Banco Pruebas", "ve los datos bancarios con su token")
  const sinToken = await api.rpc("datos_transferencia_paciente", { p_paciente_id: P.id, p_token: "inventado" })
  ok(sinToken.data === null, "con un token inventado no ve nada")
  const r1 = await api.rpc("reportar_pago_transferencia", { p_paciente_id: P.id, p_token: token, p_factura_id: F, p_monto: 12, p_archivo_nombre: "c.png", p_archivo_tipo: "image/png", p_archivo_base64: FOTO })
  ok(!r1.error && typeof r1.data === "string", "reporta un pago de $12 con su comprobante" + (r1.error ? " — " + r1.error.message : ""))
  pagos.push(r1.data)
  const r2 = await api.rpc("reportar_pago_transferencia", { p_paciente_id: P.id, p_token: token, p_factura_id: F, p_monto: 25, p_archivo_nombre: "c.png", p_archivo_tipo: "image/png", p_archivo_base64: FOTO })
  ok(r2.error?.message?.includes("supera lo que debes"), "no deja reportar más de lo que debe")
  ok(!(await api.from("pagos_transferencia").select("id")).data?.length, "sin sesión del personal la tabla no se lee")
  ok(!(await api.from("pagos_transferencia_archivos").select("pago_id")).data?.length, "ni los archivos")
  ok((await api.rpc("confirmar_pago_transferencia", { p_pago_id: r1.data })).error != null, "el paciente no puede confirmar su propio pago")

  const login = await staff.auth.signInWithPassword({ email: process.env.E2E_ADMIN_EMAIL, password: process.env.E2E_ADMIN_PASSWORD })
  ok(!login.error, "el administrador inicia sesión de verdad")
  const lista = await staff.from("pagos_transferencia").select("id, estado, monto").eq("id", r1.data)
  ok(lista.data?.length === 1 && lista.data[0].estado === "por_verificar", "el administrador ve el pago «por verificar»")
  const arch = await staff.rpc("archivo_pago_transferencia", { p_pago_id: r1.data })
  ok(arch.data?.base64 === FOTO, "y descarga el comprobante")
  const conf = await staff.rpc("confirmar_pago_transferencia", { p_pago_id: r1.data })
  ok(!conf.error && typeof conf.data === "string", "confirma el pago" + (conf.error ? " — " + conf.error.message : ""))
  const abono = (await q("select monto, pagos from abonos_factura where id = $1", [conf.data]))[0]
  ok(Number(abono?.monto) === 12 && abono.pagos[0].metodo === "transferencia", "queda un abono de $12 por transferencia")
  const r3 = await api.rpc("reportar_pago_transferencia", { p_paciente_id: P.id, p_token: token, p_factura_id: F, p_monto: 5, p_archivo_nombre: "c.png", p_archivo_tipo: "image/png", p_archivo_base64: FOTO })
  pagos.push(r3.data)
  const rech = await staff.rpc("rechazar_pago_transferencia", { p_pago_id: r3.data, p_motivo: "No aparece en el banco" })
  ok(!rech.error && rech.data === true, "rechaza otro con motivo")
  const vista = (await api.rpc("datos_transferencia_paciente", { p_paciente_id: P.id, p_token: token })).data.pagos.filter((x) => x.factura_id === F)
  ok(vista.some((x) => x.estado === "confirmado") && vista.some((x) => x.estado === "rechazado" && x.motivo_rechazo === "No aparece en el banco"), "el paciente ve «confirmado» y el motivo del rechazo")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  await c.query("delete from pagos_transferencia where factura_id = $1", [F])
  await c.query("delete from abonos_factura where factura_id = $1", [F])
  await c.query("delete from facturas_venta where id = $1", [F])
  await c.query("update opticas set datos_bancarios = $2 where id = $1", [OP.id, OP.datos_bancarios ? JSON.stringify(OP.datos_bancarios) : null])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
