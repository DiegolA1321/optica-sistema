// Ensayo de la migración 0123 (el portal ve el estado de sus lentes y su próximo control): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0123.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0123_portal_ordenes_y_control.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
// Ejecuta una función como la API (rol anon) y deshace lo que haga.
const comoAnon = async (fn, ...args) => {
  await c.query("savepoint r")
  try {
    await c.query("set local role anon")
    const r = (await c.query(`select ${fn}(${args.map((_, i) => "$" + (i + 1)).join(",")}) as r`, args)).rows[0].r
    await c.query("reset role"); await c.query("rollback to savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}

try {
  await c.query("begin")
  const [op] = await q("select id from opticas where slug = 'v8twzq'")
  const OP = op.id
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  const clonar = async (cedula, token) => {
    await c.query("drop table if exists t_p")
    await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
    await c.query("update t_p set id = gen_random_uuid(), cedula = $1, usuario = null, clave_temporal = null, sesion_token = $2, sesion_token_creado_en = now()", [cedula, token])
    return (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  }
  const A = await clonar("0900000021", "tok-A")
  const B = await clonar("0900000022", "tok-B")
  const [fac] = await q("select id from facturas_venta where optica_id = $1 limit 1", [OP])

  // Datos: A con dos órdenes (una enviada y una cancelada) y una consulta con control a 90 días; B sin nada.
  for (const [n, e] of [[990001, "enviada"], [990002, "cancelada"]]) {
    await c.query(
      `insert into ordenes_laboratorio (optica_id, numero, factura_id, paciente_id, tipo_lente, montura, laboratorio, fecha_prometida, observaciones, receta_od, estado)
       values ($1, $2, $3, $4, 'progresivo', 'Montura ensayo', 'Laboratorio Secreto', date '2031-02-01', 'Nota interna', '{"esfera":"-1"}'::jsonb, $5)`,
      [OP, n, fac.id, A, e],
    )
  }
  await c.query(
    `insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, proximo_control_dias, datos_clinicos)
     values ($1, $2, 'Paciente A', date '2031-01-10', 'Control', true, 90, '{}'::jsonb)`,
    [OP, A],
  )

  // Antes de la migración las funciones no existen.
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname in ('mis_ordenes_paciente','mi_control_paciente')"))[0].n === 0, "ANTES: el portal no tenía ninguna función para órdenes ni control")

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'mis_ordenes_paciente'"))[0].n === 1, "mis_ordenes_paciente: una sola versión")
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'mi_control_paciente'"))[0].n === 1, "mi_control_paciente: una sola versión")

  // Órdenes
  const a = await comoAnon("mis_ordenes_paciente", A, "tok-A")
  ok(!a.e && Array.isArray(a.r) && a.r.length === 1, `A recibe su orden y no la cancelada (${a.r?.length ?? a.e})`)
  const claves = Object.keys(a.r?.[0] || {}).sort().join()
  ok(claves === "creada_en,entregada_el,estado,factura_id,fecha_prometida,id,lista_el,montura,numero,tipo_lente", `solo lo que el paciente entiende: ${claves}`)
  ok(!/laboratorio|secreto|nota interna|observaciones|receta|esfera|creada_por|costo|precio|monto/i.test(JSON.stringify(a.r)), "ni laboratorio, ni observaciones, ni receta, ni costos")
  ok(a.r?.[0]?.estado === "enviada" && a.r?.[0]?.fecha_prometida === "2031-02-01", "estado y fecha estimada correctos")
  const b = await comoAnon("mis_ordenes_paciente", B, "tok-B")
  ok(!b.e && b.r.length === 0, "B (otro paciente de la misma óptica) no recibe nada de A")
  const cruzado = await comoAnon("mis_ordenes_paciente", A, "tok-B")
  ok(!cruzado.e && cruzado.r.length === 0, "el token de B no abre los datos de A")
  const sinToken = await comoAnon("mis_ordenes_paciente", A, null)
  ok(!sinToken.e && sinToken.r.length === 0, "sin token no entrega nada")
  const falso = await comoAnon("mis_ordenes_paciente", A, "inventado")
  ok(!falso.e && falso.r.length === 0, "con un token inventado no entrega nada")

  // Control
  const ca = await comoAnon("mi_control_paciente", A, "tok-A")
  ok(!ca.e && ca.r?.ultima_consulta === "2031-01-10" && ca.r?.proximo_control_dias === 90 && ca.r?.de_alta === false, `A: última consulta, 90 días, no está de alta (${JSON.stringify(ca.r)})`)
  ok(Object.keys(ca.r || {}).sort().join() === "de_alta,proximo_control_dias,ultima_consulta", "solo esos tres datos, ningún dato clínico")
  const cb = await comoAnon("mi_control_paciente", B, "tok-B")
  ok(!cb.e && cb.r?.ultima_consulta === null && cb.r?.proximo_control_dias === null, "B (sin consultas): sin fecha ni días")
  const cc = await comoAnon("mi_control_paciente", A, "tok-B")
  ok(!cc.e && cc.r === null, "el token de B no abre el control de A")
  const cs = await comoAnon("mi_control_paciente", A, null)
  ok(!cs.e && cs.r === null, "sin token no entrega nada")
  await c.query("update pacientes_base set estado_clinico_enc = cifrar_clinico('De alta') where id = $1", [A])
  const cd = await comoAnon("mi_control_paciente", A, "tok-A")
  ok(cd.r?.de_alta === true, "un paciente «De alta» lo dice (no tiene próximo control)")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
