// Verificación con sesión REAL de paciente (la API, con el token que emite el inicio de sesión) de las migraciones 0123 y 0124, en la óptica de pruebas.
// Crea una orden de laboratorio y una solicitud de eliminación del paciente fijo del portal y las borra al terminar (y sus registros de actividad).
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0123-0124.mjs
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
let ordenId = null
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad y recibe su token")
  const id = P.id

  // Una orden de su compra (CV-0006)
  const fac = (await q("select id from facturas_venta where paciente_id = $1 and estado <> 'anulada' order by created_at limit 1", [id]))[0]
  const n = ((await q("select coalesce(max(numero), 0) + 1 n from ordenes_laboratorio where optica_id = $1", [OP]))[0].n) + 1000
  ordenId = (await q(`insert into ordenes_laboratorio (optica_id, numero, factura_id, paciente_id, tipo_lente, montura, laboratorio, fecha_prometida, observaciones, estado)
                      values ($1, $2, $3, $4, 'progresivo', 'Montura verificación', 'Laboratorio interno', current_date + 5, 'Nota interna', 'enviada') returning id`, [OP, n, fac.id, id]))[0].id

  const o = await api.rpc("mis_ordenes_paciente", { p_paciente_id: id, p_token: token })
  ok(!o.error && o.data.length === 1 && o.data[0].estado === "enviada" && o.data[0].factura_id === fac.id, "mis_ordenes_paciente: su orden, enlazada a su compra")
  ok(!/laboratorio|interna|observaciones/i.test(JSON.stringify(o.data).replace("laboratorio", "").replace(/Laboratorio interno/gi, "X")) && !("laboratorio" in o.data[0]) && !("observaciones" in o.data[0]), "sin laboratorio ni observaciones")
  const falso = await api.rpc("mis_ordenes_paciente", { p_paciente_id: id, p_token: "inventado" })
  ok(!falso.error && falso.data.length === 0, "con un token inventado no entrega nada")
  const sin = await api.rpc("mis_ordenes_paciente", { p_paciente_id: id })
  ok(!sin.error && sin.data.length === 0, "sin token no entrega nada")

  const k = await api.rpc("mi_control_paciente", { p_paciente_id: id, p_token: token })
  ok(!k.error && k.data && "ultima_consulta" in k.data && Object.keys(k.data).length === 3, "mi_control_paciente: solo tres datos")
  const kf = await api.rpc("mi_control_paciente", { p_paciente_id: id, p_token: "inventado" })
  ok(!kf.error && kf.data === null, "con un token inventado el control no entrega nada")

  // 0124: descargar datos y pedir eliminación quedan en la actividad
  const antes = (await q("select count(*)::int n from logs_optica where optica_id = $1 and detalle = $2", [OP, P.nombre]))[0].n
  const d = await api.rpc("exportar_mis_datos_paciente", { p_paciente_id: id, p_token: token })
  ok(!d.error && d.data?.perfil?.nombre === P.nombre, "descargar datos sigue funcionando")
  const e = await api.rpc("solicitar_eliminacion_paciente", { p_paciente_id: id, p_token: token, p_motivo: "Verificación" })
  ok(!e.error && e.data === true, "pedir eliminación sigue funcionando")
  const logs = await q("select accion, usuario_id from logs_optica where optica_id = $1 and detalle = $2 order by created_at desc limit 2", [OP, P.nombre])
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and detalle = $2", [OP, P.nombre]))[0].n === antes + 2, "las dos acciones quedaron en la actividad (" + logs.map((l) => l.accion).join(" · ") + ")")
  ok(logs.every((l) => l.usuario_id === null), "a nombre del paciente, no de una persona del personal")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  if (ordenId) await c.query("delete from ordenes_laboratorio where id = $1", [ordenId])
  await c.query("delete from solicitudes_eliminacion_paciente where paciente_id = $1", [P.id])
  await c.query("delete from logs_optica where optica_id = $1 and detalle = $2 and accion in ('El paciente descargó una copia de sus datos', 'El paciente pidió eliminar su cuenta')", [OP, P.nombre])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
