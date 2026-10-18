// Ensayo de las migraciones 0126 (abonos en mis_compras_paciente), 0127 (cita agregada al calendario) y 0128 (referidos para los puntos): las aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0126-0128.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const comoAnon = async (fn, ...args) => {
  await c.query("savepoint r")
  try {
    await c.query("set local role anon")
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  const clonar = async (cedula, token, nombre, extra = {}) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
    await c.query("update t_p set id = gen_random_uuid(), nombre = $3, cedula = $1, usuario = null, clave_temporal = null, sesion_token = $2, sesion_token_creado_en = now(), referido_por = $4, referido_por_id = $5, anonimizado_en = $6", [cedula, token, nombre, extra.referidoPor ?? null, extra.referidoPorId ?? null, extra.anonimizadoEn ?? null])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const A = await clonar("0900000051", "tok-A", "Paciente A 0126")
  const B = await clonar("0900000052", "tok-B", "Paciente B 0126")
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id

  // ── 0126: historial de abonos ──
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  const F = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 265, 'pendiente_pago', $3, $4) returning id`, [OP, A, admin, numero]))[0].id
  await c.query(`insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos) values ($1, $2, 100, current_date - 5, 'nota interna', $3, '[{"metodo":"efectivo","monto":100}]'::jsonb), ($1, $2, 20, current_date - 1, 'otra nota', $3, '[{"metodo":"efectivo","monto":20}]'::jsonb)`, [OP, F, admin])
  const anulado = (await q(`insert into abonos_factura (optica_id, factura_id, monto, fecha, nota, registrado_por, pagos) values ($1, $2, 7, current_date, 'x', $3, '[{"metodo":"efectivo","monto":7}]'::jsonb) returning id`, [OP, F, admin]))[0].id
  await c.query("update abonos_factura set anulado_en = now(), anulado_por = $2, anulado_motivo = 'prueba' where id = $1", [anulado, admin])
  const antes = await comoAnon("mis_compras_paciente", A, "tok-A")
  ok(antes.r?.[0] && antes.r[0].abonos === undefined, "antes de la 0126 la compra no trae `abonos`")
  await c.query(leer("0126_portal_historial_de_abonos.sql"))
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'mis_compras_paciente'"))[0].n === 1, "mis_compras_paciente: una sola versión")
  const m = await comoAnon("mis_compras_paciente", A, "tok-A")
  const compra = m.r?.find((x) => x.id === F)
  ok(compra && Number(compra.abonado) === 120 && Number(compra.saldo) === 145, "abonado y saldo siguen iguales ($120 y $145; el abono anulado no cuenta)")
  ok(Array.isArray(compra?.abonos) && compra.abonos.length === 2, "trae los dos abonos vigentes (no el anulado)")
  ok(compra?.abonos.every((a) => Object.keys(a).sort().join() === "fecha,monto"), "cada abono trae solo fecha y monto (sin nota ni quién lo registró)")
  ok(Number(compra?.abonos[0].monto) === 100 && Number(compra?.abonos[1].monto) === 20, "del más antiguo al más reciente")
  ok(Object.keys(compra).sort().join() === "abonado,abonos,estado,factura_electronica,fecha,id,lineas,numero,saldo,total", "el resto de los campos no cambió")
  ok(((await comoAnon("mis_compras_paciente", A, "falso")).r ?? []).length === 0, "con un token falso no entrega nada")
  ok(((await comoAnon("mis_compras_paciente", B, "tok-B")).r ?? []).length === 0, "otro paciente no ve las compras de A")

  // ── 0127: la cita agregada al calendario ──
  const cita = async (estado, dias, hora, quien = A) => (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado) values ($1, $2, 'x', (now() at time zone 'America/Guayaquil')::date + $3::int, $4, 'Consulta General', $5) returning id`, [OP, quien, dias, hora, estado]))[0].id
  const futura = await cita("Pendiente", 3, "10:20 AM")
  const atendida = await cita("Atendida", -3, "10:20 AM")
  const deB = await cita("Pendiente", 4, "09:00 AM", B)
  await c.query(leer("0127_portal_cita_en_calendario.sql"))
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('mis_citas_detalle_paciente', 'marcar_cita_en_calendario_paciente') group by proname having count(*) > 1")).length === 0, "una sola versión de cada función")
  const d0 = await comoAnon("mis_citas_detalle_paciente", A, "tok-A")
  ok(d0.r.find((x) => x.cita_id === futura)?.en_calendario_at === null, "el detalle trae `en_calendario_at` (vacío al principio)")
  ok(d0.r.every((x) => Object.keys(x).sort().join() === "calificacion,cita_id,confirmada_at,consulta_id,en_calendario_at,profesional"), "el detalle trae solo los seis campos, sin ids del personal")
  ok((await comoAnon("marcar_cita_en_calendario_paciente", A, "tok-A", futura)).r === true, "marca su cita pendiente")
  const primera = (await q("select agregada_calendario_at a from citas_base where id = $1", [futura]))[0].a
  ok(primera !== null, "queda guardado en la cita")
  await c.query("select pg_sleep(0.05)")
  await comoAnon("marcar_cita_en_calendario_paciente", A, "tok-A", futura)
  ok(String((await q("select agregada_calendario_at a from citas_base where id = $1", [futura]))[0].a) === String(primera), "es idempotente: conserva la primera fecha")
  ok((await comoAnon("mis_citas_detalle_paciente", A, "tok-A")).r.find((x) => x.cita_id === futura).en_calendario_at !== null, "el detalle ya lo trae (vale en todos sus aparatos)")
  ok((await comoAnon("marcar_cita_en_calendario_paciente", A, "tok-A", atendida)).r === false, "una cita atendida no se marca")
  ok((await comoAnon("marcar_cita_en_calendario_paciente", A, "tok-A", deB)).r === false, "no marca la cita de otro paciente")
  ok((await comoAnon("marcar_cita_en_calendario_paciente", A, "falso", futura)).r === false, "con un token falso no marca")
  await c.query("update citas_base set hora = '11:00 AM' where id = $1", [futura])
  ok((await q("select agregada_calendario_at a from citas_base where id = $1", [futura]))[0].a === null, "si la cita cambia de hora, la marca se borra (hay que agregarla de nuevo)")
  await comoAnon("marcar_cita_en_calendario_paciente", A, "tok-A", futura)
  await c.query("update citas_base set estado = 'Pendiente', motivo = 'Control' where id = $1", [futura])
  ok((await q("select agregada_calendario_at a from citas_base where id = $1", [futura]))[0].a !== null, "otros cambios de la cita no borran la marca")

  // ── 0128: los referidos para los puntos ──
  const R1 = await clonar("0900000053", "tok-R1", "Referido por id", { referidoPorId: A })
  await clonar("0900000054", "tok-R2", "Referido por nombre", { referidoPor: "paciente a 0126 " })
  await clonar("0900000055", "tok-R3", "Referido anonimizado", { referidoPorId: A, anonimizadoEn: new Date().toISOString() })
  await clonar("0900000056", "tok-R4", "Referido de otro", { referidoPorId: B })
  await clonar("0900000057", "tok-R5", "Referido ya resuelto a B con nombre de A", { referidoPorId: B, referidoPor: "Paciente A 0126" })
  const antes128 = await comoAnon("mis_referidos_paciente", A, "tok-A")
  ok(antes128.e !== undefined, "antes de la 0128 la función no existe")
  await c.query(leer("0128_portal_referidos_para_los_puntos.sql"))
  const r = await comoAnon("mis_referidos_paciente", A, "tok-A")
  ok(r.r === 2, "A refirió a 2 (uno por id y otro por nombre; no cuenta al anonimizado, al de B ni al ya resuelto a B)")
  ok((await comoAnon("mis_referidos_paciente", B, "tok-B")).r === 2, "B refirió a 2 (el de otro y el ya resuelto a B)")
  ok((await comoAnon("mis_referidos_paciente", A, "falso")).r === 0, "con un token falso: 0")
  ok((await comoAnon("mis_referidos_paciente", R1, "tok-R1")).r === 0, "quien no refirió a nadie: 0")
  ok(typeof r.r === "number", "devuelve solo un número")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
