// Ensayo de la migración 0109 (Ventas v2: pagos divididos, descuentos y corregir o anular un abono): la aplica DENTRO de una
// transacción, repite las llamadas que hace la pantalla PUBLICADA (mismos nombres de parámetros, sin los nuevos) y prueba lo
// nuevo con distintos usuarios. SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/ensayo-0109.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0109_ventas_v2.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

const como = async (uid, fn) => {
  await c.query("savepoint s")
  try {
    await c.query("set local role authenticated")
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
    return await fn()
  } finally {
    await c.query("rollback to savepoint s")
    await c.query("reset role")
  }
}
// Ejecuta como `uid` SIN deshacer (para encadenar pasos dentro de una misma prueba); el rollback general lo revierte todo.
const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  const r = await fn()
  await c.query("reset role")
  return r
}
const intenta = async (uid, fn) => { await c.query("savepoint i"); try { const r = await comoSigue(uid, fn); await c.query("release savepoint i"); return { r } } catch (e) { await c.query("rollback to savepoint i"); await c.query("reset role"); return { e: e.message } } }

const nombresTocados = ["registrar_abono", "registrar_pago_cuota_venta", "crear_factura_venta"]
const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const vera = await perfil("Vera Ventas Pruebas")
  const paula = await perfil("Paula Optómetra Pruebas")
  const paciente = (await c.query("select id from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [optica])).rows[0]?.id
  if (!admin || !vera || !paula || !paciente) throw new Error("Faltan datos de la óptica de pruebas")
  const antes = {}
  for (const n of nombresTocados) antes[n] = await sobrecargas(n)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const n of nombresTocados) ok((await sobrecargas(n)) === antes[n] && antes[n] === 1, `sigue habiendo una sola ${n}`)

  const lineas = (extra = {}) => JSON.stringify([{ producto_id: null, tipo: "servicio", descripcion: "Servicio de ensayo", cantidad: 2, precio_unitario: 50, ...extra }])
  const vender = (uid, metodo, lin, { cuotas = null, pagos = undefined } = {}) => comoSigue(uid, async () => {
    const args = [optica, paciente, metodo, lin, null, null, cuotas, null, null]
    if (pagos === undefined) return (await c.query("select * from crear_factura_venta($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9)", args)).rows[0]
    return (await c.query("select * from crear_factura_venta($1,$2,$3,$4::jsonb,$5,$6,$7,$8,$9,$10::jsonb)", [...args, JSON.stringify(pagos)])).rows[0]
  })

  // ── Lo que hace la pantalla publicada: mismas llamadas, sin los parámetros nuevos
  let f = await vender(admin, "directo", lineas())
  ok(f.monto_total === "100" || Number(f.monto_total) === 100, "venta de la pantalla publicada (9 argumentos): total 100")
  ok(f.estado === "pagada", "…nace pagada")
  let fa = await vender(admin, "abonos", lineas())
  ok(fa.estado === "pendiente_pago", "venta con abonos de la pantalla publicada: nace con saldo")
  let r = (await comoSigue(admin, () => c.query("select * from registrar_abono($1, 30, null, 'viejo')", [fa.id]))).rows[0]
  ok(Number(r.saldo) === 70 && r.estado === "pendiente_pago", "registrar_abono con 4 argumentos: saldo 70")
  let linea = (await c.query("select pagos from abonos_factura where id = $1", [r.abono_id])).rows[0]
  ok(linea.pagos === null, "…y el abono queda sin forma de pago (sin indicar)")
  const fc = await vender(admin, "cuotas", lineas(), { cuotas: 4 })
  const cu = (await comoSigue(admin, () => c.query("select * from registrar_pago_cuota_venta($1)", [fc.id]))).rows[0]
  ok(cu.cuotas_pagadas === 1 && cu.estado === "pendiente_pago", "registrar_pago_cuota_venta con 1 argumento: cuota 1 de 4")

  // ── Pagos divididos al contado
  let x = await intenta(admin, () => vender(admin, "directo", lineas(), { pagos: [{ metodo: "efectivo", monto: 60 }, { metodo: "tarjeta", monto: 40 }] }))
  ok(x.r && x.r.estado === "pagada", "venta al contado con pago dividido (60 efectivo + 40 tarjeta): se guarda")
  const guardada = (await c.query("select pagos from facturas_venta where id = $1", [x.r.id])).rows[0]
  ok(Array.isArray(guardada.pagos) && guardada.pagos.length === 2, "…con sus dos formas de pago guardadas")
  x = await intenta(admin, () => vender(admin, "directo", lineas(), { pagos: [{ metodo: "efectivo", monto: 60 }, { metodo: "tarjeta", monto: 30 }] }))
  ok(/suman \$90/.test(x.e || ""), "pagos que no suman el total: " + x.e)
  x = await intenta(admin, () => vender(admin, "directo", lineas(), { pagos: [{ metodo: "cheque", monto: 100 }] }))
  ok(/no válida/.test(x.e || ""), "método que no existe: " + x.e)
  x = await intenta(admin, () => vender(admin, "directo", lineas(), { pagos: [{ metodo: "efectivo", monto: 0 }, { metodo: "tarjeta", monto: 100 }] }))
  ok(/mayor que cero/.test(x.e || ""), "una forma de pago en cero: " + x.e)
  x = await intenta(admin, () => vender(admin, "abonos", lineas(), { pagos: [{ metodo: "efectivo", monto: 100 }] }))
  ok(/no lleva pago al contado/.test(x.e || ""), "venta con abonos con pago al contado: " + x.e)

  // ── Descuentos
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "porcentaje", descuento_valor: 10, descuento_motivo: "Cliente frecuente" })))
  ok(x.r && Number(x.r.monto_total) === 90, "10 % de descuento a una línea de 100: total 90")
  const l1 = (await c.query("select subtotal, descuento_tipo, descuento_valor, descuento_monto, descuento_motivo from facturas_venta_lineas where factura_id = $1", [x.r.id])).rows[0]
  ok(Number(l1.subtotal) === 90 && Number(l1.descuento_monto) === 10 && l1.descuento_motivo === "Cliente frecuente", "…la línea guarda subtotal 90, descuento 10 y su motivo")
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 15.5, descuento_motivo: "Promoción" })))
  ok(x.r && Number(x.r.monto_total) === 84.5, "descuento de $15.50: total 84.50")
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 20 })))
  ok(/motivo del descuento/.test(x.e || ""), "descuento sin motivo: " + x.e)
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 101, descuento_motivo: "Error" })))
  ok(/no puede ser mayor/.test(x.e || ""), "descuento mayor que la línea: " + x.e)
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "porcentaje", descuento_valor: 120, descuento_motivo: "Error" })))
  ok(/100/.test(x.e || ""), "descuento de más del 100 %: " + x.e)
  x = await intenta(admin, () => vender(admin, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 5, descuento_motivo: "Total" }), { pagos: [{ metodo: "efectivo", monto: 95 }] }))
  ok(x.r && Number(x.r.monto_total) === 95, "descuento y pago que suma el total con descuento: se guarda")

  // ── Permisos: quien vende pero no puede "editar" no puede descontar ni corregir abonos
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolSolo = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo 0109', $2::jsonb, '{}'::jsonb, false) returning id", [optica, JSON.stringify({ ventas: ["ver", "crear"] })])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolSolo])
  x = await intenta(paula, () => vender(paula, "directo", lineas()))
  ok(x.r && x.r.estado === "pagada", "quien tiene Ventas: crear vende sin descuento")
  x = await intenta(paula, () => vender(paula, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 5, descuento_motivo: "Prueba" })))
  ok(/permiso para aplicar descuentos/.test(x.e || ""), "…pero no puede aplicar un descuento: " + x.e)
  x = await intenta(vera, () => vender(vera, "directo", lineas({ descuento_tipo: "monto", descuento_valor: 5, descuento_motivo: "Prueba" })))
  ok(x.r && Number(x.r.monto_total) === 95, "Ventas con nivel editar (Vera) sí puede descontar")

  // ── Abonos con pagos divididos
  fa = await vender(admin, "abonos", lineas())
  x = await intenta(admin, async () => (await c.query("select * from registrar_abono($1, 40, null, null, $2::jsonb)", [fa.id, JSON.stringify([{ metodo: "efectivo", monto: 25 }, { metodo: "transferencia", monto: 15 }])])).rows[0])
  ok(x.r && Number(x.r.saldo) === 60, "abono de 40 dividido (25 efectivo + 15 transferencia): saldo 60")
  const abono1 = x.r.abono_id
  x = await intenta(admin, () => c.query("select * from registrar_abono($1, 10, null, null, $2::jsonb)", [fa.id, JSON.stringify([{ metodo: "efectivo", monto: 9 }])]))
  ok(/suman \$9/.test(x.e || ""), "abono con pagos que no suman: " + x.e)
  x = await intenta(admin, async () => (await c.query("select * from registrar_abono($1, 60)", [fa.id])).rows[0])
  ok(x.r && x.r.estado === "pagada" && Number(x.r.saldo) === 0, "abono que completa el total: la venta queda pagada")
  const abono2 = x.r.abono_id

  // ── Anular un abono
  x = await intenta(paula, () => c.query("select * from anular_abono($1, 'Se registró dos veces')", [abono2]))
  ok(/No tienes permiso/.test(x.e || ""), "quien no tiene Ventas: editar no puede anular un abono: " + x.e)
  x = await intenta(vera, () => c.query("select * from anular_abono($1, '')", [abono2]))
  ok(/motivo/.test(x.e || ""), "sin motivo no se anula: " + x.e)
  x = await intenta(vera, async () => (await c.query("select * from anular_abono($1, 'Se registró dos veces')", [abono2])).rows[0])
  ok(x.r && Number(x.r.saldo) === 60 && x.r.estado === "pendiente_pago", "anular el abono que completaba la venta: saldo 60 y vuelve a 'pendiente_pago'")
  ok((await c.query("select count(*)::int n from abonos_factura where id = $1", [abono2])).rows[0].n === 0, "…el abono ya no está en la lista de abonos (la pantalla publicada ve el saldo correcto)")
  let corr = (await c.query("select accion, motivo, monto_anterior, realizado_por from abonos_correcciones where abono_id = $1", [abono2])).rows[0]
  ok(corr && corr.accion === "anulado" && Number(corr.monto_anterior) === 60 && corr.realizado_por === vera, "…y queda registrado quién lo anuló, cuándo y por qué")
  x = await intenta(admin, () => c.query("select * from anular_abono($1, 'Otra vez')", [abono2]))
  ok(/no existe/.test(x.e || ""), "anular un abono ya anulado: " + x.e)

  // ── Corregir un abono
  x = await intenta(vera, async () => (await c.query("select * from corregir_abono($1, 'Eran 30, no 40', 30, null, 'corregido', $2::jsonb)", [abono1, JSON.stringify([{ metodo: "efectivo", monto: 30 }])])).rows[0])
  ok(x.r && Number(x.r.saldo) === 70 && x.r.estado === "pendiente_pago", "corregir el abono de 40 a 30 en efectivo: saldo 70")
  const hoy = (await c.query("select (now() at time zone 'America/Guayaquil')::date d")).rows[0].d
  x = await intenta(vera, () => c.query("select * from corregir_abono($1, 'Mal', 500, $2, null, $3::jsonb)", [abono1, hoy, JSON.stringify([{ metodo: "efectivo", monto: 500 }])]))
  ok(/supera el saldo/.test(x.e || ""), "corregir con un monto que pasa el total de la venta: " + x.e)
  x = await intenta(vera, () => c.query("select * from corregir_abono($1, 'Mal', 30, $2, null, null)", [abono1, hoy]))
  ok(/cómo se pagó/.test(x.e || ""), "corregir un abono que tenía forma de pago sin indicarla: " + x.e)
  x = await intenta(vera, () => c.query("select * from corregir_abono($1, 'Mal', 30, '2099-01-01', null, $2::jsonb)", [abono1, JSON.stringify([{ metodo: "efectivo", monto: 30 }])]))
  ok(/futura/.test(x.e || ""), "corregir con fecha futura: " + x.e)
  corr = (await c.query("select accion, monto_anterior, monto_nuevo from abonos_correcciones where abono_id = $1", [abono1])).rows[0]
  ok(corr && corr.accion === "corregido" && Number(corr.monto_anterior) === 40 && Number(corr.monto_nuevo) === 30, "la corrección guarda el monto anterior (40) y el nuevo (30)")

  // ── Cuotas: anular un abono recalcula las cuotas pagadas
  const cuAntes = (await c.query("select cuotas_pagadas, estado from facturas_venta where id = $1", [fc.id])).rows[0]
  const abonoCuota = (await c.query("select id from abonos_factura where factura_id = $1", [fc.id])).rows[0].id
  x = await intenta(admin, async () => (await c.query("select * from anular_abono($1, 'Cuota mal puesta')", [abonoCuota])).rows[0])
  const cuDespues = (await c.query("select cuotas_pagadas, estado from facturas_venta where id = $1", [fc.id])).rows[0]
  ok(cuAntes.cuotas_pagadas === 1 && cuDespues.cuotas_pagadas === 0 && cuDespues.estado === "pendiente_pago", "anular la única cuota pagada: cuotas pagadas 1 → 0")

  // ── Otra óptica no puede tocar el abono
  const ajena = (await c.query("select id from perfiles where optica_id <> $1 and rol = 'admin' limit 1", [optica])).rows[0]?.id
  if (ajena) {
    x = await intenta(ajena, () => c.query("select * from anular_abono($1, 'Intento ajeno')", [abono1]))
    ok(/no existe/.test(x.e || ""), "el administrador de otra óptica no encuentra el abono: " + x.e)
    x = await intenta(ajena, () => c.query("select * from abonos_correcciones"))
    ok(x.r && x.r.rows.length === 0, "…ni lee las correcciones de esta óptica")
  }
  x = await intenta(admin, () => c.query("insert into abonos_correcciones (optica_id, factura_id, abono_id, accion, motivo, monto_anterior, fecha_anterior) values ($1,$2,$2,'anulado','xxx',1,current_date)", [optica, fa.id]))
  ok(/permission denied|row-level security/.test(x.e || ""), "nadie escribe en abonos_correcciones directamente: " + x.e)
  x = await intenta(admin, () => c.query("select * from abonos_correcciones where factura_id = $1", [fa.id]))
  ok(x.r && x.r.rows.length === 2, "el administrador lee las dos correcciones de la venta")
} catch (e) {
  console.error("ERROR del ensayo:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos === 0 ? "\nTodo bien. Se revirtió todo (no queda ningún cambio)." : `\n${fallos} comprobaciones fallaron. Se revirtió todo.`)
  process.exitCode = fallos === 0 ? 0 : 1
}
