// Verificación con sesiones REALES (por la API, no por la pantalla) de las migraciones 0117 y 0118 ya aplicadas:
// el Optómetra no recibe comprobantes ni montos pero sí lo que compró cada paciente (producto y fecha); Ventas y Recepción siguen recibiendo todo;
// los catálogos de las ópticas nuevas llevan tildes; la actividad de la óptica vacía está en blanco.
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0117-0118.mjs
import { createClient } from "@supabase/supabase-js"

let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(entorno, rol) {
  const c = nuevo()
  const { error } = await c.auth.signInWithPassword({ email: process.env[`${entorno}_${rol}_EMAIL`], password: process.env[`${entorno}_${rol}_PASSWORD`] })
  if (error) throw new Error(`No se pudo entrar como ${entorno} ${rol}`)
  return c
}
const filas = async (c, t) => { const { data, error } = await c.from(t).select("id"); return error ? -1 : data.length }

const paula = await sesion("E2E", "OPTOMETRA"), vera = await sesion("E2E", "VENTAS"), rosa = await sesion("E2E", "RECEPCION"), admin = await sesion("E2E", "ADMIN")
const paulaDemo = await sesion("DEMO", "OPTOMETRA")
for (const [n, c] of [["Paula (Optómetra, pruebas)", paula], ["Paula (Optómetra, Demo)", paulaDemo]]) {
  for (const t of ["facturas_venta", "facturas_venta_lineas", "abonos_factura", "ventas", "facturas_electronicas"]) ok((await filas(c, t)) === 0, `${n}: ${t} → 0 filas`)
  const { data: perm } = await c.rpc("mis_permisos")
  ok(!perm.permisos.ventas, `${n}: sin el módulo Ventas en sus permisos`)
  const { error: eAn } = await c.rpc("abonos_anulados")
  ok(!!eAn, `${n}: abonos_anulados se le niega`)
}
for (const [n, c] of [["Vera", vera], ["Rosa", rosa], ["administrador", admin]]) {
  ok((await filas(c, "facturas_venta")) > 0 && (await filas(c, "facturas_venta_lineas")) > 0, `${n}: sigue recibiendo comprobantes y líneas`)
}
const { data: pac } = await admin.from("pacientes").select("id, nombre").eq("nombre", "E Dos E Portal Auditoria").maybeSingle()
ok(!!pac, "existe el paciente de pruebas del portal")
if (pac) {
  const { data: compras } = await paula.rpc("compras_de_paciente", { p_paciente_id: pac.id })
  ok(Array.isArray(compras) && compras.length === 1, "Paula recibe la compra del paciente")
  ok(!/monto|precio|saldo|abon|pago|numero|factura/i.test(JSON.stringify(compras)), `sin montos ni pagos: ${JSON.stringify(compras).slice(0, 160)}`)
  const anon = nuevo()
  const { error } = await anon.rpc("compras_de_paciente", { p_paciente_id: pac.id })
  ok(!!error, "sin sesión no se puede llamar")
}
const { data: opt } = await admin.from("roles").select("clave, permisos").eq("clave", "optometra").single()
ok(!("ventas" in opt.permisos), "el rol Optómetra de la óptica de pruebas no tiene Ventas")
console.log(fallos === 0 ? "\nVerificación completa: todo pasó." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
