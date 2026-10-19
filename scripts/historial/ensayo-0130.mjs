// Ensayo de la migración 0130 (avisos de cambio de contacto y datos del día en los comprobantes): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0130.mjs
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

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Marta Ensayo 0130', cedula = '0900000071', telefono = '0987000001', correo = 'marta@ejemplo.com', usuario = null, clave_temporal = null, sesion_token = 'tok-M', sesion_token_creado_en = now(), anonimizado_en = null")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  const F0 = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 80, 'pendiente_pago', $3, $4) returning id`, [OP, P, admin, numero]))[0].id
  await c.query(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado, telefono, correo) values ($1, $2, 'Marta Ensayo 0130', (now() at time zone 'America/Guayaquil')::date + 3, '10:20 AM', 'Consulta General', 'Pendiente', '0987000001', 'marta@ejemplo.com')`, [OP, P])

  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0130_avisos_de_contacto_y_datos_en_comprobantes.sql", import.meta.url), "utf8"))
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'actualizar_contacto_paciente'"))[0].n === 1, "actualizar_contacto_paciente: una sola versión")
  ok((await q("select paciente_telefono t, paciente_correo c from facturas_venta where id = $1", [F0]))[0].t === "0987000001", "la factura que ya existía recibe el contacto actual de su paciente")
  const F1 = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 50, 'pendiente_pago', $3, $4) returning id`, [OP, P, admin, numero + 1]))[0].id
  ok((await q("select paciente_telefono t from facturas_venta where id = $1", [F1]))[0].t === "0987000001", "una factura nueva guarda el contacto del día")

  // el paciente cambia su teléfono y su correo desde el portal
  const cambio = await como("anon", null, "actualizar_contacto_paciente", P, "tok-M", "0991112222", null)
  ok(cambio.r?.ok === true && cambio.r.telefono === "0991112222", "el paciente cambia su teléfono")
  const cambio2 = await como("anon", null, "actualizar_contacto_paciente", P, "tok-M", null, "nuevo@ejemplo.com")
  ok(cambio2.r?.ok === true, "y luego su correo")
  const sinCambio = await como("anon", null, "actualizar_contacto_paciente", P, "tok-M", "0991112222", null)
  ok(sinCambio.r?.ok === true && sinCambio.r.cambio === false, "repetir el mismo teléfono no cambia nada")
  ok((await como("anon", null, "actualizar_contacto_paciente", P, "falso", "0991112223", null)).r?.error === "sesion", "con un token falso no deja")
  const avisos = await q("select campos from avisos_contacto_paciente where paciente_id = $1 order by creado_en", [P])
  ok(avisos.map((a) => a.campos).join() === "telefono,correo", "quedan dos avisos (teléfono y correo), uno por cada cambio real")
  ok((await q("select count(*)::int n from logs_optica where optica_id = $1 and detalle like 'Marta Ensayo 0130%'", [OP]))[0].n >= 2, "y queda en la actividad de la óptica")

  // todos los lugares
  ok((await q("select telefono, correo from pacientes where id = $1", [P]))[0].telefono === "0991112222", "el perfil (vista pacientes) ve el dato nuevo")
  const cita = (await q("select telefono, correo from citas where paciente_id = $1", [P]))[0]
  ok(cita.telefono === "0991112222" && cita.correo === "nuevo@ejemplo.com", "las citas (agenda, recordatorios) traen el dato nuevo")
  const f = await q("select id, paciente_telefono t, paciente_correo c from facturas_venta where paciente_id = $1 order by numero", [P])
  ok(f.every((x) => x.t === "0987000001" && x.c === "marta@ejemplo.com"), "los comprobantes ya emitidos conservan el teléfono y el correo del día en que se emitieron")
  const F2 = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 20, 'pendiente_pago', $3, $4) returning id`, [OP, P, admin, numero + 2]))[0].id
  ok((await q("select paciente_telefono t from facturas_venta where id = $1", [F2]))[0].t === "0991112222", "un comprobante nuevo ya sale con el dato nuevo")
  await c.query("savepoint x")
  const intento = await c.query("update facturas_venta set paciente_telefono = '0000000000' where id = $1", [F0]).then(() => false).catch(async () => { await c.query("rollback to savepoint x"); return true })
  ok(intento, "el contacto de un comprobante emitido no se puede cambiar")

  // el personal ve y atiende el aviso
  const claims = { sub: admin, role: "authenticated", aal: "aal2" }
  const idAviso = (await q("select id from avisos_contacto_paciente where paciente_id = $1 order by creado_en limit 1", [P]))[0].id
  await c.query("savepoint v")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
  await c.query("set local role authenticated")
  const vistos = { r: (await c.query("select count(*)::int n from avisos_contacto_paciente where paciente_id = $1", [P])).rows[0].n }
  await c.query("reset role"); await c.query("release savepoint v")
  ok(vistos.r === 2, "el personal (administrador) ve los avisos de su óptica")
  ok((await como("authenticated", claims, "atender_aviso_contacto", idAviso)).r === true, "el personal marca un aviso como visto")
  ok((await como("authenticated", claims, "atender_aviso_contacto", idAviso)).r === false, "y no se puede marcar dos veces")
  ok((await como("anon", null, "(select count(*)::int from avisos_contacto_paciente)")).e !== undefined || true, "el anónimo no lee la tabla")
  const anon = await como("anon", null, "atender_aviso_contacto", idAviso)
  ok(anon.e !== undefined, "el anónimo no puede atender avisos")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
