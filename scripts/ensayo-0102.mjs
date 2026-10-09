// Ensayo de la migración 0102 (crear_cita_publica usa generar_codigo_cita): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0102.mjs
import pg from "pg"
import fs from "node:fs"
const sql = fs.readFileSync(new URL("../supabase/migrations/0102_crear_cita_publica_usa_generador.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
try {
  await c.query("begin")
  const sobrecargas = async () => (await c.query("select count(*)::int n from pg_proc where proname='crear_cita_publica'")).rows[0].n
  const antes = await sobrecargas()
  await c.query(sql)
  ok(true, "se aplica sin errores")
  ok((await sobrecargas()) === antes && antes === 1, "sigue habiendo una sola crear_cita_publica (sin overload duplicado)")
  const src = (await c.query("select prosrc, prosecdef, proconfig from pg_proc where proname='crear_cita_publica'")).rows[0]
  ok(/generar_codigo_cita\(v_id, p_fecha\)/.test(src.prosrc) && src.prosecdef, "crear_cita_publica usa generar_codigo_cita y sigue siendo security definer")
  const priv = (await c.query(`select has_function_privilege('anon','public.crear_cita_publica(uuid,text,date,text,text,date,text,text,text,text,jsonb)','execute') a,
    has_function_privilege('authenticated','public.crear_cita_publica(uuid,text,date,text,text,date,text,text,text,text,jsonb)','execute') u,
    has_function_privilege('anon','public.generar_codigo_cita(uuid,date)','execute') ga,
    has_function_privilege('authenticated','public.generar_codigo_cita(uuid,date)','execute') gu`)).rows[0]
  ok(priv.a && priv.u, "visitantes y personal siguen pudiendo reservar (execute de crear_cita_publica)")
  ok(!priv.ga && !priv.gu, "el generador no se puede llamar directamente desde fuera")

  const optica = (await c.query("select id from opticas where slug='v8twzq'")).rows[0].id
  const ced = (await c.query("select cedula from pacientes where optica_id=$1 and cedula is not null limit 1", [optica])).rows[0].cedula
  // Reserva web como visitante anónimo (rol anon)
  await c.query("savepoint a"); await c.query("set local role anon")
  const web = (await c.query("select * from crear_cita_publica($1,'ENSAYO WEB','2099-04-01','10:00 AM',$2,'1990-01-01','0999999999','Consulta General',null,null,null)", [optica, ced])).rows[0]
  await c.query("reset role")
  ok(web && /^CIT-2099-[0-9A-F]{6,32}$/.test(web.codigo) && web.codigo.startsWith("CIT-2099-" + web.id.replace(/-/g, "").slice(0, 6).toUpperCase()), "reserva web como visitante anónimo: devuelve su código (" + web?.codigo + ")")
  const guardada = (await c.query("select codigo, origen from citas_base where id=$1", [web.id])).rows[0]
  ok(guardada.codigo === web.codigo && guardada.origen === "paciente", "el código devuelto es el guardado y el origen es 'paciente'")
  // La web evita un código ya ocupado: se fuerza ocupando el que le tocaría a un id conocido, vía el generador directo
  await c.query("insert into citas (optica_id, paciente, fecha, hora, motivo, estado, codigo) values ($1,'ENSAYO ocupa','2099-05-01','10:00 AM','Examen','Pendiente','CIT-2099-ABCDEF')", [optica])
  const g = (await c.query("select generar_codigo_cita('abcdef00-0000-4000-8000-000000000002', '2099-05-02') c")).rows[0].c
  ok(g === "CIT-2099-ABCDEF0", "el generador evita el código ocupado (" + g + ")")
  // Unicidad global: un código de OTRA óptica también cuenta cuando inserta el personal (rol authenticated, sujeto a RLS)
  const otra = (await c.query("select id from opticas where id <> $1 limit 1", [optica])).rows[0].id
  await c.query("insert into citas_base (optica_id, paciente, fecha, hora, motivo, estado, codigo) values ($1,'AJENA','2099-06-01','10:00 AM','Examen','Pendiente','CIT-2099-FEDCBA')", [otra])
  const admin = (await c.query("select id from perfiles where optica_id=$1 and rol='admin' limit 1", [optica])).rows[0].id
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: admin, role: "authenticated", aal: "aal2" }), admin])
  const propia = (await c.query("insert into citas (id, optica_id, paciente, fecha, hora, motivo, estado) values ('fedcba00-0000-4000-8000-000000000003',$1,'ENSAYO personal','2099-06-02','10:00 AM','Examen','Pendiente') returning codigo", [optica])).rows[0]
  await c.query("reset role")
  ok(propia.codigo === "CIT-2099-FEDCBA0", "el personal ve los códigos de todas las ópticas al generar (" + propia.codigo + ")")
} catch (e) { fallos++; console.error("✘ Error:", e.message) }
finally {
  await c.query("rollback"); await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó.` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
