// Ensayo de las migraciones 0137 (plantillas para todo el personal) y 0138 (borrador de la ficha en la base): las aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/historial/ensayo-0137-0138.mjs
import pg from "pg"
import fs from "node:fs"
const leer = (f) => fs.readFileSync(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const soltar = () => c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)")
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r"); await soltar()
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); await soltar(); return { e: e.message } }
}
try {
  await c.query("begin")
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const opto = (await q("select id from perfiles where optica_id = $1 and nombre ilike '%Paula%' limit 1", [OP]))[0]
  const ventas = (await q("select id from perfiles where optica_id = $1 and nombre ilike '%Ventas%' limit 1", [OP]))[0]
  const claims = (p) => ({ sub: p.id, role: "authenticated", aal: "aal2" })
  const [base] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [base.id])
  await c.query("update t_p set id = gen_random_uuid(), nombre = 'Paciente 0138', cedula = '0900000089', usuario = null, clave_temporal = null, sesion_token = 'tok-138', anonimizado_en = null")
  const P = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
  await c.query("insert into crm_plantillas (optica_id, motivo, texto, actualizada_por_nombre) values ($1, 'lentes_listos', 'Hola {nombre}, plantilla propia de ensayo.', 'x') on conflict do nothing", [OP])
  await c.query(leer("0137_plantillas_de_avisos_para_todo_el_personal.sql"))
  await c.query(leer("0138_borrador_de_la_ficha_en_la_base.sql"))

  // 0137
  ok((await como("authenticated", claims(admin), "select * from plantillas_de_avisos()")).r?.some((x) => x.motivo === "lentes_listos"), "el administrador lee las plantillas")
  if (ventas) ok((await como("authenticated", claims(ventas), "select * from plantillas_de_avisos()")).r?.length >= 1, "ventas (sin «CRM: ver») también las lee")
  ok((await como("anon", null, "select * from plantillas_de_avisos()")).e !== undefined, "un anónimo no")

  // 0138
  const datos = { motivo: "Dolor de cabeza", odEsfera: "-1.50" }
  const g = await como("authenticated", claims(opto), "select guardar_borrador_ficha($1, null, $2::jsonb) r", [P, JSON.stringify(datos)])
  ok(!g.e && g.r?.[0].r, "se guarda un borrador sin cita" + (g.e ? " — " + g.e : ""))
  const l = await como("authenticated", claims(opto), "select datos, guardado_en from leer_borrador_ficha($1, null)", [P]); if (l.e) console.log(l.e)
  ok(l.r?.[0]?.datos?.odEsfera === "-1.50", "se lee igual (descifrado)")
  const enc = (await q("select datos_enc from fichas_borradores where paciente_id = $1", [P]))[0].datos_enc
  ok(!Buffer.from(enc).toString("latin1").includes("Dolor de cabeza"), "en la tabla está cifrado")
  await como("authenticated", claims(opto), "select guardar_borrador_ficha($1, null, $2::jsonb)", [P, JSON.stringify({ ...datos, odEsfera: "-2.00" })])
  ok((await q("select count(*)::int n from fichas_borradores where paciente_id = $1", [P]))[0].n === 1, "guardar otra vez reemplaza (uno solo)")
  ok((await como("authenticated", claims(opto), "select * from fichas_borradores")).e !== undefined, "la tabla no se lee directo")
  ok((await como("anon", null, "select leer_borrador_ficha($1, null)", [P])).e !== undefined, "un anónimo no lo lee")
  const cita = (await q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen) values ($1,$2,'Paciente 0138','0900000089','2099-03-10','09:00 AM','No Asistió','staff') returning id", [OP, P]))[0].id
  const nueva = (await q("insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen) values ($1,$2,'Paciente 0138','0900000089','2099-03-11','09:00 AM','Pendiente','staff') returning id", [OP, P]))[0].id
  await como("authenticated", claims(opto), "select guardar_borrador_ficha($1, $2, $3::jsonb)", [P, cita, JSON.stringify(datos)])
  ok((await como("authenticated", claims(opto), "select heredar_borrador_ficha($1, $2) r", [cita, nueva])).r?.[0].r === true, "la cita nueva hereda el borrador")
  ok((await como("authenticated", claims(opto), "select datos from leer_borrador_ficha($1, $2)", [P, nueva])).r?.[0]?.datos?.motivo === "Dolor de cabeza", "y lo lee")
  await como("authenticated", claims(opto), "select borrar_borrador_ficha($1, $2)", [P, nueva])
  ok((await como("authenticated", claims(opto), "select * from leer_borrador_ficha($1, $2)", [P, nueva])).r?.length === 0, "al terminar o descartar se borra")
  await c.query("update fichas_borradores set guardado_en = now() - interval '8 days' where paciente_id = $1 and cita_id = $2", [P, cita])
  ok((await como("authenticated", claims(opto), "select * from leer_borrador_ficha($1, $2)", [P, cita])).r?.length === 0, "uno de más de 7 días ya no se ofrece")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await c.query("rollback").catch(() => {}); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito.` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
