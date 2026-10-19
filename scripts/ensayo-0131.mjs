// Ensayo de la migración 0131 (pagar por transferencia): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0131.mjs
import pg from "pg"
import fs from "node:fs"

const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, fn, ...args) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
const anon = (fn, ...a) => como("anon", null, fn, ...a)
const FOTO = Buffer.from("x".repeat(300)).toString("base64")

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  const clonar = async (cedula, token, nombre) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
    await c.query("update t_p set id = gen_random_uuid(), nombre = $3, cedula = $1, usuario = null, clave_temporal = null, sesion_token = $2, sesion_token_creado_en = now(), anonimizado_en = null", [cedula, token, nombre])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const A = await clonar("0900000081", "tok-A", "Paciente A 0131")
  const B = await clonar("0900000082", "tok-B", "Paciente B 0131")
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  const F = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 100, 'pendiente_pago', $3, $4) returning id`, [OP, A, admin, numero]))[0].id
  await c.query(`insert into abonos_factura (optica_id, factura_id, monto, fecha, registrado_por, pagos) values ($1, $2, 40, current_date, $3, '[{"metodo":"efectivo","monto":40}]'::jsonb)`, [OP, F, admin])

  await c.query(fs.readFileSync(new URL("../supabase/migrations/0131_pago_por_transferencia.sql", import.meta.url), "utf8"))
  for (const f of ["datos_transferencia_paciente", "reportar_pago_transferencia", "archivo_pago_transferencia", "confirmar_pago_transferencia", "rechazar_pago_transferencia"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)
  }

  // sin datos bancarios no se puede reportar
  const sinBanco = await anon("reportar_pago_transferencia", A, "tok-A", F, 20, "c.jpg", "image/jpeg", FOTO)
  ok(sinBanco.e?.includes("todavía no recibe pagos"), "sin datos bancarios de la óptica no deja reportar")
  ok((await anon("datos_transferencia_paciente", A, "tok-A")).r?.datos_bancarios === null, "y el paciente ve que no hay datos bancarios")
  await c.query("update opticas set datos_bancarios = $2 where id = $1", [OP, JSON.stringify({ banco: "Banco Pruebas", tipo_cuenta: "Ahorros", numero: "1234567890", titular: "Óptica de pruebas", documento: "0999999999" })])
  const datos = await anon("datos_transferencia_paciente", A, "tok-A")
  ok(datos.r?.datos_bancarios?.banco === "Banco Pruebas" && Array.isArray(datos.r.pagos), "con los datos configurados, el paciente los ve")
  ok((await anon("datos_transferencia_paciente", A, "falso")).r === null, "con un token falso no ve nada")

  // reportar
  ok((await anon("reportar_pago_transferencia", A, "falso", F, 20, "c.jpg", "image/jpeg", FOTO)).e?.includes("sesión venció"), "token falso: se rechaza")
  ok((await anon("reportar_pago_transferencia", A, "tok-A", F, 20, "c.exe", "application/x-msdownload", FOTO)).e?.includes("foto"), "un tipo de archivo que no es foto ni PDF se rechaza")
  ok((await anon("reportar_pago_transferencia", A, "tok-A", F, 0, "c.jpg", "image/jpeg", FOTO)).e?.includes("monto"), "monto cero se rechaza")
  ok((await anon("reportar_pago_transferencia", A, "tok-A", F, 61, "c.jpg", "image/jpeg", FOTO)).e?.includes("supera lo que debes"), "más de lo que debe ($60) se rechaza")
  ok((await anon("reportar_pago_transferencia", B, "tok-B", F, 20, "c.jpg", "image/jpeg", FOTO)).e?.includes("No encontramos esa compra"), "la compra de otro paciente no se puede pagar")
  const p1 = await anon("reportar_pago_transferencia", A, "tok-A", F, 35, "comprobante.jpg", "image/jpeg", FOTO)
  ok(typeof p1.r === "string", "reporta un pago de $35 con su comprobante")
  ok((await anon("reportar_pago_transferencia", A, "tok-A", F, 30, "c2.jpg", "image/jpeg", FOTO)).e?.includes("supera lo que debes"), "lo ya reportado cuenta: 35 + 30 pasa de 60")
  ok((await q("select estado from facturas_venta where id = $1", [F]))[0].estado === "pendiente_pago", "reportar no cambia lo que debe")
  const vista = (await anon("datos_transferencia_paciente", A, "tok-A")).r.pagos
  ok(vista.length === 1 && vista[0].estado === "por_verificar" && Object.keys(vista[0]).sort().join() === "creado_en,estado,factura_id,id,monto,motivo_rechazo,revisado_en", "el paciente ve «por verificar» y solo sus campos")
  ok((await anon("archivo_pago_transferencia", p1.r)).e !== undefined, "el anónimo no puede bajar el comprobante")

  // el personal
  const claims = { sub: admin, role: "authenticated", aal: "aal2" }
  const staff = (fn, ...a) => como("authenticated", claims, fn, ...a)
  const arch = await staff("archivo_pago_transferencia", p1.r)
  ok(arch.r?.tipo === "image/jpeg" && arch.r.base64 === FOTO && arch.r.nombre === "comprobante.jpg", "el personal ve el comprobante")
  ok((await staff("rechazar_pago_transferencia", p1.r, "ab")).e?.includes("motivo"), "rechazar pide un motivo")
  const conf = await staff("confirmar_pago_transferencia", p1.r)
  ok(typeof conf.r === "string", "el personal confirma el pago" + (conf.e ? " — " + conf.e : ""))
  const abono = (await q("select monto, pagos from abonos_factura where id = $1", [conf.r]))[0]
  ok(Number(abono.monto) === 35 && abono.pagos[0].metodo === "transferencia", "queda un abono de $35 con el método «transferencia»")
  ok((await q("select estado from pagos_transferencia where id = $1", [p1.r]))[0].estado === "confirmado", "el pago queda «confirmado»")
  ok((await staff("confirmar_pago_transferencia", p1.r)).e?.includes("ya fue revisado"), "no se confirma dos veces")
  const p2 = await anon("reportar_pago_transferencia", A, "tok-A", F, 25, "c3.png", "image/png", FOTO)
  ok(typeof p2.r === "string", "reporta otro pago por el resto ($25)")
  ok((await staff("rechazar_pago_transferencia", p2.r, "El monto no coincide con tu banco")).r === true, "el personal lo rechaza con motivo")
  const final = (await anon("datos_transferencia_paciente", A, "tok-A")).r.pagos
  ok(final.some((x) => x.estado === "rechazado" && x.motivo_rechazo === "El monto no coincide con tu banco") && final.some((x) => x.estado === "confirmado"), "el paciente ve «confirmado» y el motivo del rechazo")
  ok((await q("select estado from facturas_venta where id = $1", [F]))[0].estado === "pendiente_pago", "con $25 por pagar sigue pendiente (el rechazo no cobra nada)")

  // sin permiso de Ventas no se confirma: un usuario cualquiera (sin perfil de la óptica)
  const intruso = await como("authenticated", { sub: "00000000-0000-0000-0000-000000000000", role: "authenticated", aal: "aal2" }, "confirmar_pago_transferencia", p2.r)
  ok(intruso.e !== undefined, "quien no es de la óptica no puede confirmar")
  // tablas cerradas
  await c.query("savepoint t")
  await c.query("set local role anon")
  const leer = await c.query("select count(*)::int n from pagos_transferencia_archivos").then((r) => (r.rows[0].n === 0 ? "denegado" : "leyó")).catch(() => "denegado")
  await c.query("rollback to savepoint t"); await c.query("reset role")
  ok(leer === "denegado", "el anónimo no lee los archivos de los comprobantes")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
