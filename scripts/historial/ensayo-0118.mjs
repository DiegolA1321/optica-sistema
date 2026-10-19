// Ensayo de la migración 0118 (compras por paciente y comprobantes solo con Ventas "ver"): la aplica DENTRO de una transacción y prueba con sesiones
// reales de la óptica de pruebas (Optómetra sin Ventas, Ventas, Recepción, administrador), el administrador de otra óptica, el superadmin y sin sesión.
// SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0118.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0118_compras_por_paciente_y_ventas_en_el_servidor.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]
const como = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  try { return await fn() } finally { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
}
const cuenta = async (t) => (await c.query(`select count(*)::int n from ${t}`)).rows[0].n

try {
  await c.query("begin")
  const optica = (await uno("select id from opticas where slug = 'v8twzq'")).id
  const perfil = async (n) => (await uno("select id from perfiles where optica_id = $1 and nombre = $2", [optica, n])).id
  const admin = await perfil("QA Claude Tester"), paula = await perfil("Paula Optómetra Pruebas"), vera = await perfil("Vera Ventas Pruebas"), rosa = await perfil("Rosa Recepción Pruebas")
  const ajena = (await uno("select id from perfiles where optica_id <> $1 and rol = 'admin' and activo limit 1", [optica])).id
  const sup = (await uno("select id from perfiles where rol = 'superadmin' limit 1")).id
  const paciente = (await uno("select p.id from pacientes p where p.optica_id = $1 and exists (select 1 from facturas_venta f where f.paciente_id = p.id and f.estado <> 'anulada') order by p.created_at desc limit 1", [optica])).id

  const total = { f: await cuenta("facturas_venta"), l: await cuenta("facturas_venta_lineas"), a: await cuenta("abonos_factura") }
  const antes = {}
  for (const [n, id] of [["Vera", vera], ["Rosa", rosa], ["admin", admin]]) antes[n] = await como(id, async () => ({ f: await cuenta("facturas_venta"), l: await cuenta("facturas_venta_lineas"), a: await cuenta("abonos_factura") }))
  antes.Paula = await como(paula, async () => ({ f: await cuenta("facturas_venta"), l: await cuenta("facturas_venta_lineas"), a: await cuenta("abonos_factura") }))
  console.log("(antes) Paula leía:", JSON.stringify(antes.Paula), "· Vera:", JSON.stringify(antes.Vera))

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  ok((await uno("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'compras_de_paciente'")).n === 1, "compras_de_paciente: una sola versión")

  // Quien tiene Ventas "ver" sigue leyendo lo mismo
  for (const [n, id] of [["Vera", vera], ["Rosa", rosa], ["admin", admin]]) {
    const d = await como(id, async () => ({ f: await cuenta("facturas_venta"), l: await cuenta("facturas_venta_lineas"), a: await cuenta("abonos_factura") }))
    ok(JSON.stringify(d) === JSON.stringify(antes[n]) && d.f > 0, `${n} sigue leyendo los comprobantes, sus líneas y sus abonos (${JSON.stringify(d)})`)
  }
  // El Optómetra de pruebas todavía conserva Ventas "ver" en esta base si la 0117 no se aplicó: se compara con lo que mis_permisos dice
  const conVentas = await como(paula, async () => (await uno("select (mis_permisos() -> 'permisos' -> 'ventas') is not null v")).v)
  const despues = await como(paula, async () => ({ f: await cuenta("facturas_venta"), l: await cuenta("facturas_venta_lineas"), a: await cuenta("abonos_factura"), v: await cuenta("ventas") }))
  if (!conVentas) ok(despues.f === 0 && despues.l === 0 && despues.a === 0 && despues.v === 0, `Paula (sin Ventas) ya no recibe comprobantes, líneas, abonos ni ventas: ${JSON.stringify(despues)}`)
  else ok(true, "(Paula aún tiene Ventas en esta base: la 0117 no está aplicada)")

  // La función por paciente: solo producto y fecha
  const r = await como(paula, async () => (await uno("select compras_de_paciente($1) r", [paciente])).r)
  ok(Array.isArray(r) && r.length >= 1, `Paula recibe las compras del paciente (${r.length})`)
  const claves = new Set(r.flatMap((x) => Object.keys(x))), clavesP = new Set(r.flatMap((x) => x.productos.flatMap((p) => Object.keys(p))))
  ok([...claves].sort().join() === "fecha,id,productos", `solo id, fecha y productos: ${[...claves].join(",")}`)
  ok([...clavesP].sort().join() === "cantidad,descripcion", `de cada producto, solo descripción y cantidad: ${[...clavesP].join(",")}`)
  ok(!/monto|precio|saldo|abon|pago|numero|factura_electronica/i.test(JSON.stringify(r)), "ni montos, ni precios, ni pagos, ni saldos, ni números")
  for (const [n, id] of [["Vera", vera], ["Rosa", rosa], ["admin", admin]]) ok((await como(id, async () => (await uno("select jsonb_array_length(compras_de_paciente($1)) n", [paciente])).n)) >= 1, `${n} también la puede llamar`)
  ok((await como(ajena, async () => (await uno("select jsonb_array_length(compras_de_paciente($1)) n", [paciente])).n)) === 0, "el administrador de OTRA óptica no recibe nada")
  ok((await como(sup, async () => (await uno("select jsonb_array_length(compras_de_paciente($1)) n", [paciente])).n)) >= 1, "el superadmin sí")
  ok((await uno("select jsonb_array_length(compras_de_paciente($1)) n", [paciente])).n === 0, "sin sesión no recibe nada")
  await c.query("savepoint a")
  try { await c.query("set local role anon"); await c.query("select compras_de_paciente($1)", [paciente]); ok(false, "anon no debería poder ejecutarla"); await c.query("reset role") }
  catch (e) { ok(/permission denied/.test(e.message), "anon no puede ejecutarla (permission denied)"); await c.query("rollback to savepoint a") }
  ok((await como(paula, async () => (await uno("select jsonb_array_length(compras_de_paciente('00000000-0000-0000-0000-000000000000')) n")).n)) === 0, "un paciente que no existe no devuelve nada")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
