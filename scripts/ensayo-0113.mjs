// Ensayo de la migración 0113 (costos aparte y actas de conteo): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0113.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0113_costos_y_actas_de_conteo.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  let bien = false
  try { const r = await fn(); bien = true; return r } finally { if (bien) await c.query("reset role") }
}
const intenta = async (uid, fn) => { await c.query("savepoint i"); try { const r = await comoSigue(uid, fn); await c.query("release savepoint i"); return { r } } catch (e) { await c.query("rollback to savepoint i"); await c.query("reset role"); return { e: e.message } } }
const anonimo = async (fn) => { await c.query("savepoint a"); try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); await c.query("release savepoint a"); return { r } } catch (e) { await c.query("rollback to savepoint a"); await c.query("reset role"); return { e: e.message } } }
const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const paula = await perfil("Paula Optómetra Pruebas")
  const ajena = (await c.query("select id from perfiles where optica_id <> $1 and rol = 'admin' limit 1", [optica])).rows[0]?.id
  if (!admin || !paula) throw new Error("Faltan perfiles de la óptica de pruebas")

  // Antes de aplicar: un producto con costo (como lo guarda la 0111) para comprobar que se copia.
  const a = (await c.query("insert into inventario (optica_id, nombre, categoria, stock, precio, costo) values ($1, 'ENSAYO 0113 A', 'Monturas', 10, 100, 40) returning id", [optica])).rows[0].id
  const b = (await c.query("insert into inventario (optica_id, nombre, categoria, stock, precio) values ($1, 'ENSAYO 0113 B', 'Monturas', 5, 20) returning id", [optica])).rows[0].id
  const conCosto = (await c.query("select count(*)::int n from inventario where costo is not null")).rows[0].n
  const sumaCosto = Number((await c.query("select coalesce(sum(costo),0) s from inventario")).rows[0].s)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  ok(await sobrecargas("registrar_conteo_inventario") === 1, "registrar_conteo_inventario: una sola versión")
  ok((await c.query("select count(*)::int n from information_schema.columns where table_name='inventario' and column_name='costo'")).rows[0].n === 0, "la columna costo ya no está en inventario")
  ok((await c.query("select count(*)::int n from inventario_costos")).rows[0].n === conCosto && Number((await c.query("select coalesce(sum(costo),0) s from inventario_costos")).rows[0].s) === sumaCosto, `los ${conCosto} costos existentes se copiaron sin cambiar su suma`)

  // ── El costo, en el servidor
  let x = await intenta(admin, async () => (await c.query("select costo from inventario_costos where producto_id = $1", [a])).rows)
  ok(x.r?.length === 1 && Number(x.r[0].costo) === 40, "el administrador lee el costo")
  x = await intenta(admin, async () => (await c.query("select * from inventario where id = $1", [a])).rows[0])
  ok(x.r && !("costo" in x.r), "`select *` de inventario sigue funcionando y ya no trae el costo")
  x = await intenta(admin, () => c.query("insert into inventario_costos (producto_id, optica_id, costo) values ($1, $2, 12.5)", [b, optica]))
  ok(!x.e, "con Inventario 'editar' se registra un costo")
  x = await intenta(admin, () => c.query("update inventario_costos set costo = 13 where producto_id = $1", [b]))
  ok(!x.e, "…se cambia")
  x = await intenta(admin, () => c.query("insert into inventario_costos (producto_id, optica_id, costo) values ($1, $2, -1)", [b, optica]))
  ok(!!x.e, "un costo negativo no se acepta")

  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rol = async (nombre, permisos) => { const r = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1,$2,$3::jsonb,'{}'::jsonb,false) returning id", [optica, nombre, JSON.stringify(permisos)])).rows[0].id; await c.query("delete from perfil_roles where perfil_id = $1", [paula]); await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1,$2)", [paula, r]) }
  await rol("Ensayo 0113 ver", { inventario: ["ver"], reportes: ["ver"], ventas: ["ver", "crear"] })
  x = await intenta(paula, async () => (await c.query("select costo from inventario_costos")).rows.length)
  ok(x.r === 0, "quien solo puede ver el inventario (también Reportes y Ventas) recibe 0 costos, no un error")
  x = await intenta(paula, async () => (await c.query("select id, nombre, precio from inventario where id = $1", [a])).rows.length)
  ok(x.r === 1, "…pero sigue viendo el producto")
  x = await intenta(paula, () => c.query("update inventario_costos set costo = 1 where producto_id = $1", [a]))
  ok(!x.e && (await c.query("select costo from inventario_costos where producto_id = $1", [a])).rows[0].costo === "40.00", "…y no puede cambiar un costo (no afecta ninguna fila)")
  x = await intenta(paula, () => c.query("insert into inventario_costos (producto_id, optica_id, costo) values ($1, $2, 1) on conflict do nothing", [a, optica]))
  ok(true, "…ni escribir uno nuevo")
  const cc = (await c.query("insert into inventario (optica_id, nombre, categoria, stock, precio) values ($1,'ENSAYO 0113 C','Monturas',1,1) returning id", [optica])).rows[0].id
  x = await intenta(paula, () => c.query("insert into inventario_costos (producto_id, optica_id, costo) values ($1, $2, 3)", [cc, optica]))
  ok(/row-level security|permission/.test(x.e || ""), "…el intento de insertar es rechazado: " + x.e)
  await rol("Ensayo 0113 editar", { inventario: ["ver", "editar"] })
  x = await intenta(paula, async () => (await c.query("select costo from inventario_costos where producto_id = $1", [a])).rows.length)
  ok(x.r === 1, "con Inventario 'editar' (otro rol) sí lo lee")
  if (ajena) {
    x = await intenta(ajena, async () => (await c.query("select costo from inventario_costos where optica_id = $1", [optica])).rows.length)
    ok(x.r === 0, "el administrador de otra óptica no lee los costos de esta")
    x = await intenta(ajena, () => c.query("update inventario_costos set costo = 1 where producto_id = $1", [a]))
    ok((await c.query("select costo from inventario_costos where producto_id = $1", [a])).rows[0].costo === "40.00", "…ni los cambia")
  }
  x = await anonimo(() => c.query("select costo from inventario_costos"))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se lee nada: " + x.e)

  // ── Actas de conteo
  x = await intenta(admin, async () => (await c.query("select registrar_conteo_inventario($1::jsonb) r", [JSON.stringify([{ producto_id: a, contado: 8 }, { producto_id: b, contado: 5 }])])).rows[0].r)
  ok(x.r && x.r.conteo_id && x.r.ajustes.length === 1 && x.r.ajustes[0].diferencia === -2, "conteo: devuelve el acta y solo el ajuste que difiere")
  const acta = (await c.query("select * from conteos_inventario where id = $1", [x.r?.conteo_id])).rows[0]
  ok(acta.productos_contados === 2 && acta.productos_iguales === 1 && acta.unidades_faltantes === 2 && acta.unidades_sobrantes === 0, "…el acta cuenta 2 contados, 1 igual y 2 unidades que faltan")
  ok(Number(acta.valor_precio) === -200 && Number(acta.valor_costo) === -80, "…y el valor de la diferencia: −$200 a precio y −$80 a costo")
  ok(acta.usuario_id === admin && !!acta.usuario_nombre, "…con quién contó: " + acta.usuario_nombre)
  ok(acta.detalle.length === 1 && acta.detalle[0].nombre === "ENSAYO 0113 A" && acta.detalle[0].antes === 10 && acta.detalle[0].contado === 8, "…y el detalle de lo que difería, con lo que decía el sistema y lo contado")
  const mov = (await c.query("select tipo, cantidad, motivo from movimientos_inventario where producto_id = $1 order by seq desc limit 1", [a])).rows[0]
  ok(mov.tipo === "ajuste_conteo" && mov.cantidad === -2 && mov.motivo === "Conteo físico", "…y el ajuste por conteo queda en el kárdex")
  x = await intenta(admin, async () => (await c.query("select registrar_conteo_inventario($1::jsonb) r", [JSON.stringify([{ producto_id: a, contado: 8 }])])).rows[0].r)
  ok(x.r && x.r.ajustes.length === 0 && x.r.conteo_id, "un conteo sin diferencias también deja su acta")
  x = await intenta(admin, () => c.query("select registrar_conteo_inventario($1::jsonb)", [JSON.stringify([{ producto_id: a, contado: 1 }, { producto_id: a, contado: 2 }])]))
  ok(/repetido/.test(x.e || ""), "un producto repetido en el conteo: " + x.e)
  x = await intenta(admin, () => c.query("select registrar_conteo_inventario($1::jsonb)", [JSON.stringify([{ producto_id: a, contado: -1 }])]))
  ok(/0 o más/.test(x.e || ""), "una cantidad negativa: " + x.e)
  x = await intenta(admin, async () => (await c.query("select count(*)::int n from conteos_inventario")).rows[0].n)
  ok(x.r === 2, "el administrador lee sus actas (2)")
  await rol("Ensayo 0113 ver2", { inventario: ["ver"] })
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from conteos_inventario")).rows[0].n)
  ok(x.r === 0, "quien solo ve el inventario no lee las actas")
  x = await intenta(paula, () => c.query("select registrar_conteo_inventario($1::jsonb)", [JSON.stringify([{ producto_id: a, contado: 1 }])]))
  ok(/No tienes permiso/.test(x.e || ""), "…ni cuenta: " + x.e)
  if (ajena) {
    x = await intenta(ajena, async () => (await c.query("select count(*)::int n from conteos_inventario where optica_id = $1", [optica])).rows[0].n)
    ok(x.r === 0, "otra óptica no lee las actas de esta")
    x = await intenta(ajena, () => c.query("select registrar_conteo_inventario($1::jsonb)", [JSON.stringify([{ producto_id: a, contado: 1 }])]))
    ok(/no existe/.test(x.e || ""), "…ni cuenta sus productos: " + x.e)
  }
  x = await intenta(admin, () => c.query("update conteos_inventario set unidades_faltantes = 0"))
  ok(/permission denied/.test(x.e || ""), "nadie edita un acta: " + x.e)
  x = await intenta(admin, () => c.query("delete from conteos_inventario"))
  ok(/permission denied/.test(x.e || ""), "…ni la borra: " + x.e)
  await c.query("savepoint s")
  try { await c.query("update conteos_inventario set unidades_faltantes = 0"); ok(false, "ni con el servicio") } catch (e) { ok(/no se pueden modificar/.test(e.message), "ni con acceso directo a la base"); await c.query("rollback to savepoint s") }
  await c.query("savepoint s2")
  try { await c.query("delete from conteos_inventario"); ok(false, "ni borrarla con el servicio") } catch (e) { ok(/no se pueden borrar/.test(e.message), "…ni borrarla con acceso directo a la base: " + e.message); await c.query("rollback to savepoint s2") }
  x = await anonimo(() => c.query("select registrar_conteo_inventario('[]'::jsonb)"))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se cuenta: " + x.e)
} catch (e) {
  console.error("ERROR del ensayo:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos === 0 ? "\nTodo bien. Se revirtió todo (no queda ningún cambio)." : `\n${fallos} comprobaciones fallaron. Se revirtió todo.`)
  process.exitCode = fallos === 0 ? 0 : 1
}
