// Ensayo de las migraciones 0135 (contactos de los avisos en el CRM) y 0136 (tipo de documento, citas «Presencial», dejar de atender): las aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/historial/ensayo-0135-0136.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const soltarSesion = () => c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)")
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r")
    await soltarSesion()
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); await soltarSesion(); return { e: e.message } }
}
const fn = (nombre, n) => `select ${nombre}(${Array.from({ length: n }, (_, i) => "$" + (i + 1)).join(",")}) as r`

try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const admin = (await q("select id, nombre from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const claimsAdmin = { sub: admin.id, role: "authenticated", aal: "aal2" }
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente 0136', cedula = '0900000089', usuario = null, clave_temporal = null, sesion_token = 'tok-136', sesion_token_creado_en = now(), anonimizado_en = null, medidas_solicitadas_en = null, acepta_recordatorios = true, acepta_promociones = false")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente sin permiso', cedula = '0900000097', acepta_recordatorios = false, acepta_promociones = false")
  const SIN = (await q("insert into pacientes_base select * from t_p returning id"))[0].id

  await c.query(leer("0135_crm_contactos_de_los_avisos.sql"))
  await c.query(leer("0136_ronda3a_documento_presencial_dejar_de_atender.sql"))

  // ── Una sola versión de cada función tocada ──
  for (const f of ["guardar_plantilla_crm", "registrar_contacto_de_aviso", "dejar_de_atender_cita", "citas_registrar_eventos", "pacientes_instead_insert", "pacientes_instead_update"]) {
    ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [f]))[0].n === 1, `${f}: una sola versión`)
  }

  // ═══ 0135 ═══
  const motivos = ["control_vencido", "cita_no_efectuada", "cita_reagendada", "lentes_listos", "medidas_montaje", "por_vender"]
  for (const m of motivos) {
    const r = await como("authenticated", claimsAdmin, fn("registrar_contacto_de_aviso", 3), [P, m, `Hola, mensaje de ${m}`])
    ok(r.r?.[0].r, `el administrador registra un contacto de aviso «${m}»`)
  }
  const filas = await q("select motivo, canal, mensaje, creado_por_nombre from crm_contactos where paciente_id = $1 order by creado_en", [P])
  ok(filas.length === 6 && filas.every((f) => f.canal === "whatsapp" && f.creado_por_nombre === admin.nombre), "quedan en el Seguimiento del CRM, por WhatsApp y con el nombre de quien escribió")
  ok((await como("authenticated", claimsAdmin, fn("registrar_contacto_de_aviso", 3), [P, "promocion", "x"])).e?.includes("Motivo no válido"), "un motivo que no es de un aviso se rechaza")
  ok((await como("anon", null, fn("registrar_contacto_de_aviso", 3), [P, "lentes_listos", "x"])).e !== undefined, "un anónimo no puede registrar contactos")
  ok((await como("authenticated", claimsAdmin, fn("registrar_contacto_de_aviso", 3), [SIN, "control_vencido", "x"])).e?.includes("no desea recibir mensajes"), "control vencido respeta «Recordatorios de salud»: sin permiso se rechaza")
  ok((await como("authenticated", claimsAdmin, fn("registrar_contacto_de_aviso", 3), [SIN, "lentes_listos", "Tus lentes están listos"])).r?.[0].r, "los lentes listos (un servicio ya pedido) se avisan aunque no acepte recordatorios")
  ok((await como("authenticated", claimsAdmin, fn("registrar_contacto_de_aviso", 3), ["00000000-0000-0000-0000-000000000000", "lentes_listos", "x"])).e?.includes("no existe"), "un paciente que no existe se rechaza")
  for (const m of motivos) {
    const r = await como("authenticated", claimsAdmin, fn("guardar_plantilla_crm", 2), [m, `Hola {nombre}, plantilla de ${m} de {óptica}.`])
    ok(r.e === undefined, `la plantilla «${m}» se guarda`)
  }
  ok((await q("select count(*)::int n from crm_plantillas where optica_id = $1", [OP]))[0].n >= 6, "las seis plantillas quedan guardadas")
  ok((await como("authenticated", claimsAdmin, fn("guardar_plantilla_crm", 2), ["inventado", "Hola {nombre}, esto no existe."])).e?.includes("Motivo no válido"), "un motivo inventado sigue rechazado")
  ok((await como("authenticated", claimsAdmin, fn("registrar_contacto_crm", 7), [P, "control_vencido", "whatsapp", "desde el CRM", null, null, null])).r?.[0].r, "el CRM sigue registrando sus contactos como siempre")

  // ═══ 0136: tipo de documento ═══
  const ins = await como("authenticated", claimsAdmin, `insert into pacientes (optica_id, nombre, cedula, telefono, correo, fecha_nacimiento, tipo_documento) values ($1, 'Extranjero Pasaporte', 'AB123456', '0999999999', 'x@x.com', '1990-01-01', 'pasaporte') returning id, tipo_documento, cedula`, [OP])
  ok(ins.r?.[0].tipo_documento === "pasaporte" && ins.r[0].cedula === "AB123456", "se crea un paciente con pasaporte (sin dígito verificador)")
  const idPas = ins.r?.[0].id
  const def = await como("authenticated", claimsAdmin, `insert into pacientes (optica_id, nombre, cedula, telefono, correo, fecha_nacimiento) values ($1, 'Con Cédula', '0900000105', '0999999999', 'y@y.com', '1991-01-01') returning tipo_documento`, [OP])
  ok(def.r?.[0].tipo_documento === "cedula", "sin decir el tipo, es cédula")
  ok((await como("authenticated", claimsAdmin, `update pacientes set tipo_documento = 'otro', cedula = 'RUC-9988' where id = $1 returning tipo_documento`, [idPas])).r?.[0].tipo_documento === "otro", "se edita el tipo de documento y el número")
  ok((await como("authenticated", claimsAdmin, `update pacientes set tipo_documento = 'licencia' where id = $1`, [idPas])).e !== undefined, "un tipo que no existe se rechaza")
  ok((await q("select tipo_documento from pacientes where id = $1", [P]))[0].tipo_documento === "cedula", "los pacientes anteriores quedan como cédula")
  const col = await q("select column_name from information_schema.columns where table_name = 'pacientes' and table_schema = 'public' order by ordinal_position")
  ok(col[col.length - 1].column_name === "tipo_documento", "la vista agrega la columna al final (nada cambia de lugar)")

  // ═══ 0136: citas Presencial ═══
  const cp = await como("authenticated", claimsAdmin, `insert into citas (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, motivo, origen) values ($1, $2, 'Paciente 0136', '0900000089', current_date, '09:00 AM', 'En Atención', 'Consulta general', 'presencial') returning id, origen`, [OP, P])
  ok(cp.r?.[0].origen === "presencial", "se crea una cita con origen «presencial»")
  const ev = await q("select datos from citas_eventos where cita_id = $1 and tipo = 'agendada'", [cp.r?.[0].id])
  ok(ev[0]?.datos.origen === "presencial", "el seguimiento dice «presencial»")
  ok((await como("authenticated", claimsAdmin, `insert into citas (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen) values ($1, $2, 'x', '0900000089', current_date, '10:00 AM', 'Pendiente', 'otra')`, [OP, P])).e !== undefined, "un origen que no existe se rechaza")

  // ═══ 0136: dejar de atender ═══
  const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date d"))[0].d.toISOString().slice(0, 10)
  const nueva = async (fecha, hora, estado) => (await q(`insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen, duracion_minutos, atendido_por) values ($1,$2,'Paciente 0136','0900000089',$3,$4,$5,'staff',40,$6) returning id`, [OP, P, fecha, hora, estado, estado === "En Atención" ? admin.id : null]))[0].id
  const estadoDe = async (id) => (await q("select estado, atendido_por from citas_base where id = $1", [id]))[0]
  const tipos = async (id) => (await q("select tipo, datos from citas_eventos where cita_id = $1 order by ocurrido_en, id", [id]))
  const CH = await nueva(hoy, "11:00 PM", "En Atención")
  const r1 = await como("authenticated", claimsAdmin, fn("dejar_de_atender_cita", 1), [CH])
  ok(r1.r?.[0].r === "En Espera", "el mismo día: la cita vuelve a «En espera»")
  ok((await estadoDe(CH)).estado === "En Espera" && (await estadoDe(CH)).atendido_por === null, "y deja de figurar quien atendía")
  const ev1 = (await tipos(CH)).map((e) => e.tipo)
  ok(ev1.at(-1) === "volvio_en_espera", "el seguimiento lo cuenta como «volvió a espera», no como «llegó»")
  const CA = await nueva("2020-01-07", "10:00 AM", "En Atención")
  const r2 = await como("authenticated", claimsAdmin, fn("dejar_de_atender_cita", 1), [CA])
  ok(r2.r?.[0].r === "No Asistió" && (await estadoDe(CA)).estado === "No Asistió", "si el día ya pasó: queda «No efectuada»")
  const nef = (await tipos(CA)).find((e) => e.tipo === "no_efectuada")
  ok(nef?.datos.motivo === "La atención se interrumpió", "con el motivo «La atención se interrumpió»")
  ok((await como("authenticated", claimsAdmin, fn("dejar_de_atender_cita", 1), [CA])).r?.[0].r === "No Asistió", "repetirlo no cambia nada (devuelve su estado)")
  ok((await como("anon", null, fn("dejar_de_atender_cita", 1), [CH])).e !== undefined, "un anónimo no puede")
  ok((await como("authenticated", claimsAdmin, fn("dejar_de_atender_cita", 1), ["00000000-0000-0000-0000-000000000000"])).e?.includes("no existe"), "una cita que no existe se rechaza")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
