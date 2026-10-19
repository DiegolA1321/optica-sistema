// Verificación con sesión REAL de paciente de la migración 0130, en la óptica de pruebas: cambia el teléfono y el correo por la API con el token del inicio de sesión, comprueba el aviso, la
// propagación y que los comprobantes conserven el dato del día; y deja todo como estaba.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0130.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"

const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const P = (await q("select id, telefono, correo from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0]
const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
let factura = null
try {
  const { data: sesion, error } = await api.rpc("verificar_login_paciente", { p_usuario: process.env.E2E_PORTAL_CEDULA, p_clave: process.env.E2E_PORTAL_CLAVE, p_optica_id: OP })
  const token = sesion?.[0]?.sesion_token
  ok(!error && !!token, "el paciente inicia sesión de verdad")
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  factura = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 10, 'pendiente_pago', $3, $4) returning id`, [OP, P.id, admin, numero]))[0].id
  const guardado = (await q("select paciente_telefono t, paciente_correo c from facturas_venta where id = $1", [factura]))[0]
  ok(guardado.t === P.telefono, "el comprobante guardó el teléfono del día de su emisión")
  const r = await api.rpc("actualizar_contacto_paciente", { p_paciente_id: P.id, p_token: token, p_telefono: "0955443322", p_correo: null })
  ok(!r.error && r.data?.ok === true, "cambia su teléfono por la API con su token")
  const aviso = (await q("select campos, atendido_en from avisos_contacto_paciente where paciente_id = $1 order by creado_en desc limit 1", [P.id]))[0]
  ok(aviso?.campos === "telefono" && aviso.atendido_en === null, "queda el aviso para la óptica")
  ok((await q("select telefono from pacientes where id = $1", [P.id]))[0].telefono === "0955443322", "la ficha del paciente tiene el dato nuevo")
  ok((await q("select paciente_telefono t from facturas_venta where id = $1", [factura]))[0].t === P.telefono, "el comprobante ya emitido conserva el teléfono anterior")
  const directo = await api.from("avisos_contacto_paciente").select("id")
  ok((directo.data ?? []).length === 0, "sin sesión del personal los avisos no se leen")
} catch (e) {
  console.log("✘ ERROR: " + e.message); fallos++
} finally {
  await c.query("update pacientes_base set telefono = $2, correo = $3 where id = $1", [P.id, P.telefono, P.correo])
  await c.query("delete from avisos_contacto_paciente where paciente_id = $1", [P.id])
  if (factura) await c.query("delete from facturas_venta where id = $1", [factura])
  await c.end()
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó y se limpió." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
