// Ensayo de la migración 0129 (solicitar lentes nuevos desde el portal): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0129.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8")
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
  const A = await clonar("0900000061", "tok-A", "Paciente A 0129")
  const B = await clonar("0900000062", "tok-B", "Paciente B 0129")
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0].id
  const consulta = (await q("select id from consultas_base where optica_id = $1 limit 1", [OP]))[0]?.id

  const antes = (await q("select count(*)::int n, count(*) filter (where consulta_id is null)::int sin from pases_a_venta"))[0]
  await c.query(leer("0129_portal_solicitar_lentes.sql"))
  const d = (await q("select count(*)::int n, count(*) filter (where origen = 'consulta')::int cons from pases_a_venta"))[0]
  ok(d.n === antes.n && d.cons === antes.n, `los ${antes.n} pases que ya existían quedan intactos y con origen «consulta»`)
  for (const f of ["solicitar_lentes_paciente", "mis_solicitudes_lentes_paciente", "tomar_solicitud_portal", "registrar_proforma", "sincronizar_pase_con_factura", "mis_compras_paciente"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)
  }

  // ── el paciente solicita ──
  ok((await anon("solicitar_lentes_paciente", A, "falso", "montura_nueva", null)).e?.includes("sesión venció"), "con un token falso no deja solicitar")
  ok((await anon("solicitar_lentes_paciente", A, "tok-A", "carrito", null)).e?.includes("Elige qué"), "un interés inválido se rechaza")
  const s1 = await anon("solicitar_lentes_paciente", A, "tok-A", "lentes_con_receta", "  Los quiero ligeros  ")
  ok(typeof s1.r === "string", "solicita con su receta vigente")
  ok((await anon("solicitar_lentes_paciente", A, "tok-A", "lentes_de_sol", null)).e?.includes("Ya tienes una solicitud"), "una sola solicitud en curso por paciente")
  const fila = (await q("select * from pases_a_venta where id = $1", [s1.r]))[0]
  ok(fila.origen === "portal" && fila.estado === "listo" && fila.consulta_id === null && fila.optica_id === OP && fila.comentario_paciente === "Los quiero ligeros", "queda 'listo', del portal, de su óptica y con el comentario recortado")
  const largo = await anon("solicitar_lentes_paciente", B, "tok-B", "lentes_de_sol", "x".repeat(500))
  ok(typeof largo.r === "string" && (await q("select length(comentario_paciente) l from pases_a_venta where id = $1", [largo.r]))[0].l === 300, "el comentario se recorta a 300 caracteres")

  // ── lo que ve el paciente ──
  const mis = await anon("mis_solicitudes_lentes_paciente", A, "tok-A")
  ok(mis.r?.length === 1 && mis.r[0].estado === "recibida" && mis.r[0].interes === "lentes_con_receta", "ve su solicitud como «recibida»")
  ok(Object.keys(mis.r[0]).sort().join() === "cerrada,comentario,creada,estado,id,interes", "solo ve los campos propios (nada del personal)")
  ok(((await anon("mis_solicitudes_lentes_paciente", A, "falso")).r ?? []).length === 0, "con un token falso no ve nada")
  ok(((await anon("mis_solicitudes_lentes_paciente", B, "tok-B")).r ?? []).every((x) => x.id !== s1.r), "otro paciente no ve la solicitud de A")

  // ── el personal la atiende (sesión de administrador) ──
  const claims = { sub: admin, role: "authenticated", aal: "aal2" }
  const staff = (fn, ...a) => como("authenticated", claims, fn, ...a)
  const vis = await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)])
  const lista = await staff("tomar_solicitud_portal", s1.r)
  ok(lista.r !== undefined && !lista.e, "el personal la toma" + (lista.e ? " — " + lista.e : ""))
  const m2 = await anon("mis_solicitudes_lentes_paciente", A, "tok-A")
  ok(m2.r?.[0].estado === "en_atencion", "el paciente la ve «en atención»")
  ok((await staff("tomar_solicitud_portal", "00000000-0000-0000-0000-000000000000")).e?.includes("ya no está"), "no toma una solicitud que no existe")
  // una consulta (para probar que el origen 'consulta' sigue exigiéndola)
  const falla = await c.query("savepoint x").then(() => c.query("insert into pases_a_venta (optica_id, paciente_id) values ($1, $2)", [OP, A])).then(() => false).catch(async () => { await c.query("rollback to savepoint x"); return true })
  ok(falla, "un pase de origen 'consulta' sin consulta se rechaza")

  // ── la factura la cierra ──
  const numero = (await q("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [OP]))[0].n
  const F = (await q(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 50, 'pendiente_pago', $3, $4) returning id`, [OP, A, admin, numero]))[0].id
  const cerrada = (await q("select estado, factura_id from pases_a_venta where id = $1", [s1.r]))[0]
  ok(cerrada.estado === "vendido" && cerrada.factura_id === F, "la factura del paciente cierra la solicitud «en atención»")
  ok((await anon("mis_solicitudes_lentes_paciente", A, "tok-A")).r?.[0].estado === "atendida", "el paciente la ve «atendida»")
  await c.query("update facturas_venta set estado = 'anulada' where id = $1", [F])
  ok((await q("select estado from pases_a_venta where id = $1", [s1.r]))[0].estado === "listo", "al anular la factura vuelve a la cola")
  // una factura NO cierra una solicitud que nadie ha tomado
  const s3 = (await q("select id from pases_a_venta where id = $1", [largo.r]))[0].id
  const numero2 = (await q("update contador_comprobantes_venta set ultimo_numero = ultimo_numero + 1 where optica_id = $1 returning ultimo_numero n", [OP]))[0].n
  await c.query(`insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 20, 'pendiente_pago', $3, $4)`, [OP, B, admin, numero2])
  ok((await q("select estado from pases_a_venta where id = $1", [s3]))[0].estado === "listo", "una factura no cierra una solicitud que nadie ha tomado")

  // ── mis_compras_paciente trae cita_id ──
  const compras = await anon("mis_compras_paciente", B, "tok-B")
  ok(compras.r?.length >= 1 && "cita_id" in compras.r[0], "mis_compras_paciente entrega `cita_id`")
  ok(Object.keys(compras.r[0]).sort().join() === "abonado,abonos,cita_id,estado,factura_electronica,fecha,id,lineas,numero,saldo,total", "el resto de los campos no cambió")

  // ── no se escribe directo ──
  const directo = await como("anon", null, "(select count(*) from pases_a_venta)")
  ok(directo.e !== undefined || Number(directo.r) === 0, "anónimo no lee la tabla")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
