// Ensayo de la migración 0111 (Inventario v2: "Montura", datos de la montura y kárdex): la aplica DENTRO de una transacción,
// repite lo que hace la pantalla PUBLICADA (vender, anular, editar el stock a mano, crear un producto) y prueba lo nuevo con
// distintos usuarios. SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/ensayo-0111.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0111_inventario_v2.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

// Ejecuta como `uid` (sesión real de la base: rol authenticated con sus claims) SIN deshacer, para encadenar pasos.
const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  let ok = false
  try { const r = await fn(); ok = true; return r } finally { if (ok) await c.query("reset role") }
}
const intenta = async (uid, fn) => { await c.query("savepoint i"); try { const r = await comoSigue(uid, fn); await c.query("release savepoint i"); return { r } } catch (e) { await c.query("rollback to savepoint i"); await c.query("reset role"); return { e: e.message } } }
const anonimo = async (fn) => {
  await c.query("savepoint a")
  try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); await c.query("release savepoint a"); return { r } } catch (e) { await c.query("rollback to savepoint a"); await c.query("reset role"); return { e: e.message } }
}

const nombresDeFunciones = ["crear_factura_venta", "anular_factura_venta", "registrar_movimiento_inventario", "registrar_conteo_inventario", "optica_de_inventario"]
const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const vera = await perfil("Vera Ventas Pruebas")
  const paula = await perfil("Paula Optómetra Pruebas")
  if (!admin || !vera || !paula) throw new Error("Faltan perfiles de la óptica de pruebas")
  let paciente = (await c.query("select id from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [optica])).rows[0]?.id
  if (!paciente) paciente = (await c.query("insert into pacientes_base (optica_id, nombre) values ($1, 'ENSAYO 0111') returning id", [optica])).rows[0].id
  const ajena = (await c.query("select id from perfiles where optica_id <> $1 and rol = 'admin' limit 1", [optica])).rows[0]?.id

  // ── Antes de aplicar: lo que hay, para comparar
  const antes = {
    productos: (await c.query("select count(*)::int n from inventario")).rows[0].n,
    armazones: (await c.query("select count(*)::int n from inventario where categoria = 'Armazones'")).rows[0].n,
    opticasConArmazones: (await c.query("select count(*)::int n from opticas where 'Armazones' = any(categorias_inventario)")).rows[0].n,
    stock: (await c.query("select coalesce(sum(stock),0)::int n from inventario")).rows[0].n,
  }
  const sobrecargasAntes = {}
  for (const n of nombresDeFunciones) sobrecargasAntes[n] = await sobrecargas(n)
  console.log(`(antes: ${antes.productos} productos, ${antes.armazones} en "Armazones", ${antes.opticasConArmazones} ópticas con la categoría "Armazones", existencia total ${antes.stock})`)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const n of ["crear_factura_venta", "anular_factura_venta"]) ok((await sobrecargas(n)) === sobrecargasAntes[n] && sobrecargasAntes[n] === 1, `sigue habiendo una sola ${n} (no se tocó)`)
  for (const n of ["registrar_movimiento_inventario", "registrar_conteo_inventario", "optica_de_inventario"]) ok((await sobrecargas(n)) === 1, `${n}: una sola versión`)

  // ── 1. Montura
  ok((await c.query("select count(*)::int n from inventario where categoria = 'Armazones'")).rows[0].n === 0, '"Armazones" ya no existe en los productos')
  ok((await c.query("select count(*)::int n from inventario where categoria = 'Montura'")).rows[0].n >= antes.armazones, `…los ${antes.armazones} productos pasaron a "Montura"`)
  ok((await c.query("select count(*)::int n from opticas where 'Armazones' = any(categorias_inventario)")).rows[0].n === 0, '…y "Armazones" ya no está en el catálogo de ninguna óptica')
  const dup = (await c.query("select count(*)::int n from opticas o where (select count(*) from unnest(o.categorias_inventario) c) <> (select count(distinct c) from unnest(o.categorias_inventario) c)")).rows[0].n
  ok(dup === 0, "…sin categorías repetidas en ninguna óptica")
  ok((await c.query("select count(*)::int n from inventario")).rows[0].n === antes.productos && (await c.query("select coalesce(sum(stock),0)::int n from inventario")).rows[0].n === antes.stock, "no se perdió ni cambió ningún producto ni existencia")

  // ── 2. Saldo inicial de lo que ya existía
  const sinSaldo = (await c.query("select count(*)::int n from inventario i where not exists (select 1 from movimientos_inventario m where m.producto_id = i.id and m.tipo = 'saldo_inicial')")).rows[0].n
  ok(sinSaldo === 0, "cada producto existente tiene su saldo inicial en el kárdex")
  const distinto = (await c.query("select count(*)::int n from inventario i join movimientos_inventario m on m.producto_id = i.id and m.tipo = 'saldo_inicial' where m.cantidad <> i.stock or m.stock_resultante <> i.stock")).rows[0].n
  ok(distinto === 0, "…y es exactamente su existencia de hoy")
  const sinKardexConsistente = (await c.query(`select count(*)::int n from inventario i where i.stock <> (select coalesce(sum(cantidad),0) from movimientos_inventario m where m.producto_id = i.id)`)).rows[0].n
  ok(sinKardexConsistente === 0, "…la suma de los movimientos de cada producto da su existencia")

  // Un producto de la óptica de pruebas para trabajar
  const producto = (await c.query("insert into inventario (optica_id, nombre, categoria, stock, precio) values ($1, 'ENSAYO 0111 montura', 'Montura', 10, 50) returning id", [optica])).rows[0].id
  let movs = async () => (await c.query("select tipo, cantidad, stock_resultante, motivo, referencia, usuario_id, usuario_nombre from movimientos_inventario where producto_id = $1 order by created_at, seq", [producto])).rows
  let m = await movs()
  ok(m.length === 1 && m[0].tipo === "saldo_inicial" && m[0].cantidad === 10 && m[0].stock_resultante === 10, "un producto nuevo (como lo crea la pantalla publicada) nace con su saldo inicial")

  // ── 3. Lo que hace la pantalla publicada: vender y anular
  const vender = (uid, cantidad) => comoSigue(uid, async () => (await c.query("select * from crear_factura_venta($1,$2,'directo',$3::jsonb,null,null,null,null,null)", [optica, paciente, JSON.stringify([{ producto_id: producto, tipo: "producto", descripcion: "ENSAYO 0111 montura", cantidad, precio_unitario: 50 }])])).rows[0])
  let x = await intenta(admin, () => vender(admin, 3))
  ok(x.r && Number(x.r.monto_total) === 150, "vender 3 unidades con la función publicada: sigue funcionando (total 150)")
  const factura = x.r?.id
  ok(Number((await c.query("select stock from inventario where id = $1", [producto])).rows[0].stock) === 7, "…y descuenta la existencia (10 → 7)")
  m = await movs()
  const venta = m[m.length - 1]
  ok(venta.tipo === "venta" && venta.cantidad === -3 && venta.stock_resultante === 7 && venta.referencia === factura, "…y anota el movimiento: venta, −3, queda 7, ligado al comprobante")
  ok(venta.usuario_id === admin && !!venta.usuario_nombre, "…con quién lo hizo")
  x = await intenta(admin, () => vender(admin, 99))
  ok(/No hay suficiente stock/.test(x.e || ""), "vender más de lo que hay: " + x.e)
  ok((await movs()).length === 2, "…y el intento fallido no deja movimiento")
  x = await intenta(admin, () => c.query("select anular_factura_venta($1, 'Ensayo de anulación', null)", [factura]))
  ok(!x.e, "anular la venta con la función publicada: funciona" + (x.e ? " — " + x.e : ""))
  m = await movs()
  const anul = m[m.length - 1]
  ok(anul.tipo === "anulacion_venta" && anul.cantidad === 3 && anul.stock_resultante === 10 && anul.referencia === factura, "…y anota la anulación: +3, queda 10, ligada al mismo comprobante")

  // ── 4. Edición directa del stock (lo que todavía hace la pantalla publicada)
  // Cada petición real es su propia transacción; aquí todo es una sola, así que se limpia lo que dejó la anulación.
  await c.query("select set_config('app.mov_tipo', '', true), set_config('app.mov_ref', '', true)")
  x = await intenta(admin, () => c.query("update inventario set stock = 12 where id = $1", [producto]))
  m = await movs()
  ok(m[m.length - 1].tipo === "ajuste_directo" && m[m.length - 1].cantidad === 2 && m[m.length - 1].stock_resultante === 12, "editar el stock a mano (pantalla publicada): se anota como 'ajuste directo' +2")
  await c.query("update inventario set precio = 60 where id = $1", [producto])
  ok((await movs()).length === m.length, "cambiar solo el precio no deja movimiento")

  // ── 5. Registrar ingreso / merma / devolución / ajuste (pantalla nueva)
  const mover = (uid, tipo, cant, motivo) => comoSigue(uid, async () => (await c.query("select registrar_movimiento_inventario($1,$2,$3,$4) s", [producto, tipo, cant, motivo])).rows[0].s)
  x = await intenta(admin, () => mover(admin, "ingreso_compra", 5, "Factura de compra 001-123"))
  ok(x.r === 17, "ingreso por compra de 5: existencia 17")
  m = await movs()
  ok(m[m.length - 1].tipo === "ingreso_compra" && m[m.length - 1].motivo === "Factura de compra 001-123" && m[m.length - 1].usuario_id === admin, "…con su motivo y quién lo hizo")
  x = await intenta(admin, () => mover(admin, "merma", -2, "Se rompió una"))
  ok(x.r === 15, "merma de 2: existencia 15")
  x = await intenta(admin, () => mover(admin, "devolucion_proveedor", -1, "Venía con defecto"))
  ok(x.r === 14, "devolución al proveedor de 1: existencia 14")
  x = await intenta(admin, () => mover(admin, "ajuste_conteo", -4, "Faltaban en el estante"))
  ok(x.r === 10, "ajuste por conteo de −4: existencia 10")
  x = await intenta(admin, () => mover(admin, "ingreso_compra", 5, ""))
  ok(/motivo/.test(x.e || ""), "sin motivo no se registra: " + x.e)
  x = await intenta(admin, () => mover(admin, "ingreso_compra", -5, "Mal signo"))
  ok(/suma unidades/.test(x.e || ""), "un ingreso con cantidad negativa: " + x.e)
  x = await intenta(admin, () => mover(admin, "merma", 3, "Mal signo"))
  ok(/restan unidades/.test(x.e || ""), "una merma con cantidad positiva: " + x.e)
  x = await intenta(admin, () => mover(admin, "ajuste_conteo", 0, "Nada"))
  ok(/distinta de cero/.test(x.e || ""), "cantidad cero: " + x.e)
  x = await intenta(admin, () => mover(admin, "merma", -50, "Más de lo que hay"))
  ok(/No hay tantas unidades/.test(x.e || ""), "dejar la existencia en negativo: " + x.e)
  x = await intenta(admin, () => mover(admin, "venta", -1, "Disfrazado de venta"))
  ok(/no válido/.test(x.e || ""), "no se puede inventar una 'venta' desde la función: " + x.e)
  ok(Number((await c.query("select stock from inventario where id = $1", [producto])).rows[0].stock) === 10, "los intentos fallidos no cambiaron la existencia")

  // ── 6. Conteo físico
  const otro = (await c.query("insert into inventario (optica_id, nombre, categoria, stock, precio) values ($1, 'ENSAYO 0111 accesorio', 'Accesorios', 20, 5) returning id", [optica])).rows[0].id
  const contar = (uid, lista) => comoSigue(uid, async () => (await c.query("select * from registrar_conteo_inventario($1::jsonb)", [JSON.stringify(lista)])).rows)
  x = await intenta(admin, () => contar(admin, [{ producto_id: producto, contado: 8 }, { producto_id: otro, contado: 20 }]))
  ok(x.r && x.r.length === 1 && x.r[0].producto_id === producto && x.r[0].antes === 10 && x.r[0].despues === 8 && x.r[0].diferencia === -2, "conteo: solo registra lo que difiere (el accesorio coincide y no deja movimiento)")
  m = await movs()
  ok(m[m.length - 1].tipo === "ajuste_conteo" && m[m.length - 1].motivo === "Conteo físico" && m[m.length - 1].cantidad === -2 && m[m.length - 1].stock_resultante === 8, "…como ajuste por conteo con el motivo 'Conteo físico'")
  ok((await c.query("select count(*)::int n from movimientos_inventario where producto_id = $1", [otro])).rows[0].n === 1, "…el producto que coincide solo conserva su saldo inicial")
  x = await intenta(admin, () => contar(admin, [{ producto_id: producto, contado: 5 }, { producto_id: otro, contado: -1 }]))
  ok(/0 o más/.test(x.e || ""), "una cantidad negativa en el conteo: " + x.e)
  ok(Number((await c.query("select stock from inventario where id = $1", [producto])).rows[0].stock) === 8, "…y el conteo es todo o nada: nada cambió")
  x = await intenta(admin, () => contar(admin, []))
  ok(/No hay productos contados/.test(x.e || ""), "conteo vacío: " + x.e)

  // ── 7. Permisos
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolVer = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo 0111 ver', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ inventario: ["ver"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolVer])
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from movimientos_inventario where producto_id = $1", [producto])).rows[0].n)
  ok(x.r >= 6, "con Inventario 'ver' se lee el kárdex (" + x.r + " movimientos)")
  x = await intenta(paula, () => mover(paula, "ingreso_compra", 1, "Sin permiso"))
  ok(/No tienes permiso/.test(x.e || ""), "…pero no se registra un ingreso: " + x.e)
  x = await intenta(paula, () => contar(paula, [{ producto_id: producto, contado: 1 }]))
  ok(/No tienes permiso/.test(x.e || ""), "…ni un conteo: " + x.e)
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolNada = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo 0111 nada', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ citas: ["ver"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolNada])
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from movimientos_inventario")).rows[0].n)
  ok(x.r === 0, "sin Inventario ni Reportes no se lee ningún movimiento")
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolRep = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo 0111 reportes', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ reportes: ["ver"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolRep])
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from movimientos_inventario")).rows[0].n)
  ok(x.r > 0, "con Reportes 'ver' sí se leen (para la pestaña Inventario de Reportes)")

  // ── 8. Los movimientos no se tocan; otra óptica y anónimos no entran
  x = await intenta(admin, () => c.query("update movimientos_inventario set cantidad = 99 where producto_id = $1", [producto]))
  ok(/permission denied/.test(x.e || ""), "el administrador no puede editar un movimiento: " + x.e)
  x = await intenta(admin, () => c.query("delete from movimientos_inventario where producto_id = $1", [producto]))
  ok(/permission denied/.test(x.e || ""), "…ni borrarlo: " + x.e)
  x = await intenta(admin, () => c.query("insert into movimientos_inventario (optica_id, producto_id, tipo, cantidad, stock_resultante) values ($1,$2,'venta',1,1)", [optica, producto]))
  ok(/permission denied/.test(x.e || ""), "…ni escribir uno a mano: " + x.e)
  await c.query("savepoint s")
  try { await c.query("update movimientos_inventario set cantidad = 99 where producto_id = $1", [producto]); ok(false, "ni siquiera con acceso directo a la base (servicio)") } catch (e) { ok(/no se pueden modificar/.test(e.message), "ni siquiera con acceso directo a la base (servicio): " + e.message); await c.query("rollback to savepoint s") }
  await c.query("savepoint s")
  try { await c.query("delete from movimientos_inventario where producto_id = $1", [producto]); ok(false, "…ni borrarlo") } catch (e) { ok(/no se pueden borrar/.test(e.message), "…ni borrarlo: " + e.message); await c.query("rollback to savepoint s") }
  await c.query("savepoint s")
  try { await c.query("delete from inventario where id = $1", [producto]); ok(false, "un producto con movimientos no se elimina") } catch (e) { ok(/foreign key|violates/.test(e.message), "un producto con movimientos no se puede eliminar (solo descontinuar)"); await c.query("rollback to savepoint s") }
  x = await anonimo(() => c.query("select count(*)::int n from movimientos_inventario"))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se lee nada: " + x.e)
  x = await anonimo(() => c.query("select registrar_movimiento_inventario($1,'ingreso_compra',1,'anon')", [producto]))
  ok(/permission denied/.test(x.e || ""), "sin sesión no se registra nada: " + x.e)
  if (ajena) {
    x = await intenta(ajena, async () => (await c.query("select count(*)::int n from movimientos_inventario where optica_id = $1", [optica])).rows[0].n)
    ok(x.r === 0, "el administrador de otra óptica no lee el kárdex de esta")
    x = await intenta(ajena, () => mover(ajena, "ingreso_compra", 1, "Ajeno"))
    ok(/no existe/.test(x.e || ""), "…ni ajusta un producto de esta óptica: " + x.e)
    x = await intenta(ajena, () => contar(ajena, [{ producto_id: producto, contado: 1 }]))
    ok(/no existe/.test(x.e || ""), "…ni lo cuenta: " + x.e)
  }

  // ── 9. Campos nuevos
  x = await intenta(admin, () => c.query("update inventario set codigo='M-001', marca='Ray', modelo='RB1', color='Negro', calibre=52, puente=18, varilla=140, proveedor='Distribuidora X', costo=22.5 where id = $1", [producto]))
  ok(!x.e, "los campos nuevos se guardan" + (x.e ? " — " + x.e : ""))
  x = await intenta(admin, () => c.query("update inventario set codigo='m-001 ' where id = $1", [otro]))
  ok(/inventario_codigo_unico_idx|duplicate/.test(x.e || ""), "un código repetido en la óptica no se acepta: " + x.e)
  x = await intenta(admin, () => c.query("update inventario set costo = -1 where id = $1", [producto]))
  ok(/inventario_costo_valido/.test(x.e || ""), "un costo negativo no se acepta")
  x = await intenta(admin, () => c.query("update inventario set calibre = 0 where id = $1", [producto]))
  ok(/inventario_medidas_validas/.test(x.e || ""), "una medida en cero no se acepta")
  x = await intenta(admin, () => c.query("update inventario set stock = stock where id = $1", [producto]))
  ok(!x.e, "una edición sin cambio de existencia sigue funcionando")
} catch (e) {
  console.error("ERROR del ensayo:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos === 0 ? "\nTodo bien. Se revirtió todo (no queda ningún cambio)." : `\n${fallos} comprobaciones fallaron. Se revirtió todo.`)
  process.exitCode = fallos === 0 ? 0 : 1
}
