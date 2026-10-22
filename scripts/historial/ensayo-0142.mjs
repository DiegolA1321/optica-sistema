// Ensayo de la migración 0142 (pedidos con entrega y fecha aproximada): la aplica DENTRO de una transacción y SIEMPRE revierte. No toca ninguna fila real.
//   node --env-file=.env.local scripts/historial/ensayo-0142.mjs
import pg from "pg"
import fs from "node:fs"
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
const datos = (extra = {}) => ({ tipo_lente: "monofocal", fecha_prometida: "2026-11-05", receta_od: {}, receta_oi: {}, ...extra })
try {
  await c.query("begin")
  const antes = (await q("select count(*)::int n, count(*) filter (where estado = 'enviada')::int enviadas, count(*) filter (where laboratorio is not null)::int con_lab from ordenes_laboratorio"))[0]
  const defAntes = (await q("select pg_get_functiondef('public.crear_orden_laboratorio(uuid,jsonb)'::regprocedure) d"))[0].d
  ok(!defAntes.includes("direccion_entrega"), "antes: la función viva todavía no conoce la entrega")

  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0142_pedidos_entrega_y_fecha_aproximada.sql", import.meta.url), "utf8"))

  const despues = (await q("select count(*)::int n, count(*) filter (where estado = 'enviada')::int enviadas, count(*) filter (where laboratorio is not null)::int con_lab, count(*) filter (where entrega = 'retira')::int retira, count(*) filter (where direccion_entrega is not null)::int con_dir from ordenes_laboratorio"))[0]
  ok(despues.n === antes.n && despues.enviadas === antes.enviadas, `ningún pedido cambia de estado ni se pierde: ${despues.n} pedidos`)
  ok(despues.con_lab === antes.con_lab, `el laboratorio guardado se conserva (${despues.con_lab} pedidos lo tienen, sin mostrarse)`)
  ok(despues.retira === despues.n && despues.con_dir === 0, "todos los pedidos de antes quedan «retira», sin dirección")
  ok((await q("select count(*)::int n from pg_proc where proname in ('crear_orden_laboratorio','actualizar_orden_laboratorio','mis_ordenes_paciente')"))[0].n === 3, "no hay funciones duplicadas (misma firma): 3 funciones")
  ok((await q("select pg_get_functiondef('public.mis_ordenes_paciente(uuid,text)'::regprocedure) d"))[0].d.includes("'entrega', o.entrega"), "el portal recibe la entrega")
  ok(!(await q("select pg_get_functiondef('public.mis_ordenes_paciente(uuid,text)'::regprocedure) d"))[0].d.includes("direccion_entrega"), "…pero no la dirección ni el laboratorio")

  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id // la óptica de pruebas
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const cl = { sub: admin.id, role: "authenticated", aal: "aal2" }
  const factura = (await q("select id from facturas_venta where optica_id = $1 and estado <> 'anulada' limit 1", [OP]))[0]
  if (!factura) { console.log("(la óptica de pruebas no tiene una venta vigente: se omiten las pruebas de crear y editar)") }
  else {
    const crear = (d) => como("authenticated", cl, "select crear_orden_laboratorio($1, $2::jsonb) id", [factura.id, JSON.stringify(d)])
    const sinDir = await crear(datos({ entrega: "envio" }))
    ok(sinDir.e?.includes("Escribe la dirección de envío."), "un envío sin dirección se rechaza con su mensaje")
    ok((await crear(datos({ entrega: "volando" }))).e?.includes("Elige cómo recibirá"), "una entrega inventada se rechaza")
    ok((await crear(datos({ fecha_prometida: null }))).e?.includes("fecha aproximada"), "sin fecha aproximada se rechaza")
    const viejo = await crear(datos()) // un cliente viejo: sin `entrega`
    ok(viejo.r?.[0]?.id && (await q("select entrega, direccion_entrega from ordenes_laboratorio where id = $1", [viejo.r[0].id]))[0].entrega === "retira", "un pedido sin `entrega` en los datos se crea «retira»" + (viejo.e ? " — " + viejo.e : ""))
    const envio = await crear(datos({ entrega: "envio", direccion_entrega: "  Av. Sol 12 y Luna  " }))
    const fila = envio.r?.[0]?.id ? (await q("select entrega, direccion_entrega, estado from ordenes_laboratorio where id = $1", [envio.r[0].id]))[0] : null
    ok(fila?.entrega === "envio" && fila?.direccion_entrega === "Av. Sol 12 y Luna" && fila?.estado === "enviada", "un envío con dirección se crea (dirección sin espacios sobrantes) y nace «en proceso»" + (envio.e ? " — " + envio.e : ""))
    const id = envio.r?.[0]?.id
    ok((await q("select count(*)::int n from ordenes_laboratorio_historial where orden_id = $1", [id]))[0].n === 1, "y su historial arranca con un solo paso")
    ok((await como("authenticated", cl, "select actualizar_orden_laboratorio($1, $2::jsonb)", [id, JSON.stringify({ entrega: "retira" })])).r?.length === 1
      && (await q("select entrega, direccion_entrega from ordenes_laboratorio where id = $1", [id]))[0].direccion_entrega === null, "pasar a «retira» borra la dirección")
    ok((await como("authenticated", cl, "select actualizar_orden_laboratorio($1, $2::jsonb)", [id, JSON.stringify({ entrega: "envio" })])).e?.includes("Escribe la dirección de envío."), "pasar a envío sin dirección se rechaza")
    ok((await como("authenticated", cl, "select actualizar_orden_laboratorio($1, $2::jsonb)", [id, JSON.stringify({ entrega: "envio", direccion_entrega: "Calle 5", fecha_prometida: "2026-11-09" })])).r?.length === 1
      && (await q("select direccion_entrega, fecha_prometida::text f from ordenes_laboratorio where id = $1", [id]))[0].f === "2026-11-09", "pasar a envío con dirección y cambiar la fecha aproximada funciona")
    ok((await como("authenticated", cl, "select actualizar_orden_laboratorio($1, $2::jsonb)", [id, JSON.stringify({ observaciones: "solo esto" })])).r?.length === 1
      && (await q("select entrega, direccion_entrega from ordenes_laboratorio where id = $1", [id]))[0].direccion_entrega === "Calle 5", "corregir otro dato no toca la entrega")
    ok((await como("anon", null, "select crear_orden_laboratorio($1, '{}'::jsonb)", [factura.id])).e !== undefined, "un anónimo no puede crear pedidos")
    // El estado sigue su camino de siempre.
    ok((await como("authenticated", cl, "select cambiar_estado_orden($1, 'lista')", [id])).r?.length === 1 && (await q("select estado from ordenes_laboratorio where id = $1", [id]))[0].estado === "lista", "marcar listo sigue funcionando")
  }
  const otra = (await q("select id from opticas where id <> $1 limit 1", [OP]))[0]
  const otroAdmin = otra ? (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [otra.id]))[0] : null
  if (otroAdmin && factura) {
    const clOtra = { sub: otroAdmin.id, role: "authenticated", aal: "aal2" }
    ok((await como("authenticated", clOtra, "select crear_orden_laboratorio($1, $2::jsonb)", [factura.id, JSON.stringify(datos())])).e?.includes("La venta no existe."), "el administrador de otra óptica no puede crear un pedido en esta venta")
  }
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await c.query("rollback").catch(() => {}); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
