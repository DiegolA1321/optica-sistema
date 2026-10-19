// Ensayo de la migración 0122 («Ofrecer ayuda» como conversación de soporte): la aplica DENTRO de una transacción y prueba con sesiones reales de la base
// (superadmin, administrador y personal de un entorno de prueba, administrador de la óptica real y sin sesión) que:
//   - solo el superadmin ofrece ayuda, y crea una consulta «Iniciada por el soporte» con su número, su módulo (como dato) y su mensaje;
//   - el administrador de esa óptica la ve y la lee (baja la campanita); el personal y el administrador de otra óptica no;
//   - no se repite la oferta del mismo módulo hasta 30 días después (lo valida el servidor), y sí con otro módulo;
//   - el administrador responde en la misma conversación;
//   - «No usamos este módulo» lo marca solo el administrador de esa óptica: resuelve la consulta, deja el módulo como no usado y el soporte ya no puede ofrecerle ayuda;
//   - el administrador lo deshace con «volver_a_usar_modulo»;
//   - el mismo límite de 2000 caracteres en todo mensaje (consulta, respuestas, aviso del administrador y aviso del superadmin), validado en el servidor;
//   - las tablas nuevas no se escriben desde la aplicación; las consultas de las ópticas siguen funcionando como antes.
// SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0122.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0122_ofrecer_ayuda.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]
const sesion = async (uid) => {
  await c.query("set local role " + (uid ? "authenticated" : "anon"))
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
}
const finSesion = async () => { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
const como = async (uid, fn) => { await sesion(uid); try { return await fn() } finally { await finSesion() } }
const falla = async (uid, q, p = []) => {
  await c.query("savepoint s")
  try { await sesion(uid); await c.query(q, p); await finSesion(); await c.query("release savepoint s"); return null }
  catch (e) { await c.query("rollback to savepoint s"); return e.message }
}

try {
  await c.query("begin")
  const sup = (await uno("select id from perfiles where rol = 'superadmin' limit 1")).id
  const qa = (await uno("select id from opticas where slug = 'v8twzq'")).id
  const solna = (await uno("select id from opticas where slug = 'optica-solna'")).id
  const adminQa = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [qa])).id
  const asistQa = (await uno("select id from perfiles where optica_id = $1 and rol = 'asistente' and coalesce(activo, true) limit 1", [qa]))?.id
  const adminSolna = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [solna])).id

  await c.query(sql)
  ok(true, "la migración se aplica sin errores")
  const antes = (await uno("select count(*)::int n from soporte_consultas where iniciada_por = 'optica'")).n
  ok(antes >= 0, `las consultas de siempre quedan como «iniciada por la óptica» (${antes})`)

  // 1. Solo el superadmin ofrece ayuda
  for (const [nombre, uid] of [["el administrador de una óptica", adminQa], ["el administrador de otra óptica", adminSolna], ["sin sesión", null]]) {
    ok(!!(await falla(uid, "select * from ofrecer_ayuda($1, 'ventas', 'Hola')", [qa])), `${nombre} NO puede ofrecer ayuda`)
  }
  if (asistQa) ok(!!(await falla(asistQa, "select * from ofrecer_ayuda($1, 'ventas', 'Hola')", [qa])), "el personal NO puede ofrecer ayuda")
  ok(/Módulo desconocido/.test(await falla(sup, "select * from ofrecer_ayuda($1, 'inventado', 'Hola')", [qa])), "un módulo desconocido se rechaza")
  ok(/Escribe el mensaje/.test(await falla(sup, "select * from ofrecer_ayuda($1, 'ventas', '   ')", [qa])), "un mensaje vacío se rechaza")

  // 2. Ofrecer ayuda crea una consulta iniciada por el soporte
  const MENSAJE = "Vimos que en los últimos 30 días no usaron Ventas. Te dejamos una guía paso a paso."
  const r = await como(sup, async () => await uno("select * from ofrecer_ayuda($1, 'ventas', $2)", [qa, MENSAJE]))
  ok(r?.numero > 0, `ofrecer ayuda devuelve el número de la consulta (SOP-${String(r?.numero).padStart(4, "0")})`)
  const k = await uno("select * from soporte_consultas where id = $1", [r.id])
  ok(k.iniciada_por === "soporte" && k.ayuda_modulo === "ventas" && k.tipo === "ayuda", "la consulta queda «iniciada por el soporte», con el módulo como dato y tipo «ayuda»")
  ok(k.estado === "respondida" && k.ultimo_mensaje_de === "soporte" && k.respuesta_sin_leer === true && k.destino === "superadmin", "queda «Respondida», con el soporte como último y sin leer para la óptica")
  ok(k.primera_respuesta_en === null, "no cuenta como una «primera respuesta» (no altera los tiempos de atención)")
  ok(k.modulo === "ventas" && k.asunto === "Ayuda con Ventas" && !/http|localhost|\.app|\.com/i.test(k.descripcion), "el asunto lo dice y el mensaje no lleva direcciones")
  const m = await uno("select count(*)::int n, min(de) de from soporte_mensajes where consulta_id = $1", [r.id])
  ok(m.n === 1 && m.de === "soporte", "el mensaje del soporte abre la conversación")
  ok((await uno("select count(*)::int n from ayudas_ofrecidas where consulta_id = $1 and modulo = 'ventas' and optica_id = $2", [r.id, qa])).n === 1, "queda registrada la ayuda ofrecida")

  // La ficha clínica se explica en Pacientes (el módulo de la consulta), pero el dato conserva el módulo de uso
  const f = await como(sup, async () => await uno("select * from ofrecer_ayuda($1, 'consultas', 'Hola')", [qa]))
  const kf = await uno("select modulo, ayuda_modulo from soporte_consultas where id = $1", [f.id])
  ok(kf.modulo === "pacientes" && kf.ayuda_modulo === "consultas", "«Ficha clínica» guarda su módulo de uso y se atiende como Pacientes")

  // 3. Quién la ve
  const ve = async (uid) => como(uid, async () => (await uno("select count(*)::int n from soporte_consultas where id = $1", [r.id])).n)
  ok((await ve(adminQa)) === 1, "el administrador de esa óptica la ve")
  ok((await ve(sup)) === 1, "el superadmin la ve")
  if (asistQa) ok((await ve(asistQa)) === 0, "el personal que no es administrador no la ve")
  ok((await ve(adminSolna)) === 0, "el administrador de otra óptica no la ve")
  ok(!!(await falla(null, "select id from soporte_consultas where id = $1", [r.id])), "sin sesión no se ve (la tabla no se lee)")
  const campanita = await como(adminQa, async () => (await c.query("select id, numero, asunto, ayuda_modulo from soporte_consultas where iniciada_por = 'soporte' and respuesta_sin_leer and estado <> 'resuelta'")).rows)
  ok(campanita.some((x) => x.id === r.id && x.ayuda_modulo === "ventas"), "le llega a la campanita del administrador")
  await como(adminQa, async () => { await c.query("select marcar_consulta_soporte_leida($1)", [r.id]) })
  ok((await uno("select respuesta_sin_leer from soporte_consultas where id = $1", [r.id])).respuesta_sin_leer === false, "al abrirla, el administrador la marca como leída (baja la campanita)")
  if (asistQa) {
    await c.query("update soporte_consultas set respuesta_sin_leer = true where id = $1", [r.id])
    await como(asistQa, async () => { await c.query("select marcar_consulta_soporte_leida($1)", [r.id]).catch(() => {}) })
    ok((await uno("select respuesta_sin_leer from soporte_consultas where id = $1", [r.id])).respuesta_sin_leer === true, "el personal no puede marcarla como leída")
    await c.query("update soporte_consultas set respuesta_sin_leer = false where id = $1", [r.id])
  }

  // 4. El administrador responde en la misma conversación
  await como(adminQa, async () => { await c.query("select responder_consulta_soporte($1, 'Gracias, la miramos hoy.')", [r.id]) })
  const k2 = await uno("select estado, ultimo_mensaje_de from soporte_consultas where id = $1", [r.id])
  ok(k2.ultimo_mensaje_de === "optica", "el administrador responde y la conversación sigue en Soporte (ahora le toca al soporte)")
  ok((await uno("select count(*)::int n from soporte_mensajes where consulta_id = $1", [r.id])).n === 2, "la respuesta queda en la misma conversación")

  // 5. No se repite hasta 30 días después
  const rep = await falla(sup, "select * from ofrecer_ayuda($1, 'ventas', 'Otra vez')", [qa])
  ok(/Ya se ofreció ayuda con este módulo el \d\d\/\d\d\/\d{4}\. Podrás volver a ofrecerla el \d\d\/\d\d\/\d{4}/.test(rep || ""), `repetir la oferta del mismo módulo se rechaza («${rep?.slice(0, 70)}…»)`)
  const otro = await como(sup, async () => await uno("select * from ofrecer_ayuda($1, 'inventario', 'Hola')", [qa]))
  ok(otro?.numero > 0, "con otro módulo sí se puede")
  await c.query("update ayudas_ofrecidas set ofrecida_en = now() - interval '31 days' where optica_id = $1 and modulo = 'inventario'", [qa])
  const pasado = await como(sup, async () => await uno("select * from ofrecer_ayuda($1, 'inventario', 'Hola de nuevo')", [qa]))
  ok(pasado?.numero > 0, "pasados 30 días se puede volver a ofrecer")

  // 6. «No usamos este módulo»
  const adminDeOtra = await falla(adminSolna, "select no_usamos_modulo($1)", [r.id])
  ok(/No encontramos esa consulta/.test(adminDeOtra || ""), "el administrador de otra óptica no puede marcar un módulo de esta")
  if (asistQa) ok(!!(await falla(asistQa, "select no_usamos_modulo($1)", [r.id])), "el personal no puede marcar «no usamos este módulo»")
  ok(!!(await falla(sup, "select no_usamos_modulo($1)", [r.id])), "el superadmin tampoco decide por la óptica")
  const propia = await uno("select id from soporte_consultas where optica_id = $1 and iniciada_por = 'optica' limit 1", [qa])
  if (propia) ok(/no es una oferta/.test((await falla(adminQa, "select no_usamos_modulo($1)", [propia.id])) || ""), "solo aplica a una oferta de ayuda")
  await como(adminQa, async () => { await c.query("select no_usamos_modulo($1)", [r.id]) })
  const k3 = await uno("select estado, respuesta_sin_leer from soporte_consultas where id = $1", [r.id])
  ok(k3.estado === "resuelta" && k3.respuesta_sin_leer === false, "la consulta queda resuelta")
  ok((await uno("select count(*)::int n from modulos_no_usados where optica_id = $1 and modulo = 'ventas'", [qa])).n === 1, "el módulo queda como «no usado por decisión de la óptica»")
  ok(/no usa este módulo/.test((await falla(sup, "select * from ofrecer_ayuda($1, 'ventas', 'Hola')", [qa])) || ""), "el soporte ya no puede ofrecerle ayuda con ese módulo")
  const veAdmin = await como(adminQa, async () => (await c.query("select modulo from modulos_no_usados")).rows.map((x) => x.modulo))
  const veSolna = await como(adminSolna, async () => (await c.query("select modulo from modulos_no_usados where optica_id = $1", [qa])).rows.length)
  ok(veAdmin.includes("ventas") && veSolna === 0, "el administrador ve los módulos que marcó; otra óptica no")
  if (asistQa) ok((await como(asistQa, async () => (await c.query("select 1 from modulos_no_usados")).rows.length)) === 0, "el personal no ve esa decisión")

  // 7. Deshacer
  if (asistQa) ok(!!(await falla(asistQa, "select volver_a_usar_modulo('ventas')")), "el personal no puede deshacerla")
  await como(adminQa, async () => { await c.query("select volver_a_usar_modulo('ventas')") })
  ok((await uno("select count(*)::int n from modulos_no_usados where optica_id = $1", [qa])).n === 0, "el administrador la deshace desde Configuración")
  ok(/Ya se ofreció/.test((await falla(sup, "select * from ofrecer_ayuda($1, 'ventas', 'Hola')", [qa])) || ""), "deshacerla no salta el límite de 30 días")

  // 8. Las tablas nuevas no se escriben desde la aplicación
  for (const [nombre, uid] of [["el superadmin", sup], ["el administrador", adminQa]]) {
    ok(!!(await falla(uid, "insert into ayudas_ofrecidas (optica_id, modulo) values ($1, 'citas')", [qa])), `${nombre} NO escribe en ayudas_ofrecidas`)
    ok(!!(await falla(uid, "insert into modulos_no_usados (optica_id, modulo) values ($1, 'citas')", [qa])), `${nombre} NO escribe en modulos_no_usados`)
  }
  ok((await como(sup, async () => (await uno("select count(*)::int n from ayudas_ofrecidas where optica_id = $1", [qa])).n)) >= 3, "el superadmin lee el registro de ayudas ofrecidas")
  ok((await como(adminQa, async () => (await uno("select count(*)::int n from ayudas_ofrecidas")).n)) === 0, "el administrador no lee ese registro")

  // 9. Lo de siempre
  ok(!!(await falla(adminQa, "insert into soporte_consultas (optica_id, autor_nombre, autor_rol, modulo, tipo, asunto, descripcion) values ($1, 'x', 'x', 'otro', 'ayuda', 'abc', 'x')", [qa])), "nadie escribe consultas directo en la tabla")
  ok(!!(await falla(adminQa, "select * from crear_consulta_soporte(gen_random_uuid(), 'otro', 'ayuda', 'normal', 'Probando', 'Probando')")), "el tipo «ayuda» no se puede elegir al escribir una consulta")

  // 10. El mismo límite de 2000 caracteres, validado en el servidor, en todo mensaje
  const de = (n) => "x".repeat(n)
  const largo = /máximo 2000 caracteres/
  ok(largo.test((await falla(adminQa, "select * from crear_consulta_soporte(gen_random_uuid(), 'otro', 'problema', 'normal', 'Prueba del límite', $1)", [de(2001)])) || ""), "una consulta de más de 2000 caracteres se rechaza")
  const abierta = await como(adminQa, async () => await uno("select * from crear_consulta_soporte(gen_random_uuid(), 'otro', 'problema', 'normal', 'Prueba del límite', $1)", [de(2000)]))
  ok(abierta?.numero > 0, "una consulta de exactamente 2000 caracteres pasa")
  ok(largo.test((await falla(adminQa, "select responder_consulta_soporte($1, $2)", [abierta.id, de(2001)])) || ""), "una respuesta de la óptica de más de 2000 caracteres se rechaza")
  ok(!(await falla(adminQa, "select responder_consulta_soporte($1, $2)", [abierta.id, de(2000)])), "una respuesta de exactamente 2000 caracteres pasa")
  ok(largo.test((await falla(sup, "select soporte_responder($1, $2)", [abierta.id, de(2001)])) || ""), "una respuesta del soporte de más de 2000 caracteres se rechaza")
  ok(!(await falla(sup, "select soporte_responder($1, $2)", [abierta.id, de(2000)])), "una respuesta del soporte de exactamente 2000 caracteres pasa")
  ok(largo.test((await falla(sup, "select * from ofrecer_ayuda($1, 'reportes', $2)", [qa, de(2001)])) || ""), "ofrecer ayuda con más de 2000 caracteres se rechaza")
  ok(largo.test((await falla(adminQa, "select publicar_aviso_interno('Aviso de prueba', $1, 'todos')", [de(2001)])) || ""), "un aviso del administrador de más de 2000 caracteres se rechaza")
  ok(!(await falla(adminQa, "select publicar_aviso_interno('Aviso de prueba', $1, 'todos')", [de(2000)])), "un aviso del administrador de exactamente 2000 caracteres pasa")
  ok(largo.test((await falla(sup, "insert into mensajes (tipo, optica_id, remitente_id, remitente_nombre, asunto, cuerpo, estado) values ('anuncio', $1, $2, 'Soporte', 'Aviso de prueba', $3, 'resuelto')", [qa, sup, de(2001)])) || ""), "un aviso del superadmin de más de 2000 caracteres se rechaza")
  ok(!(await falla(sup, "insert into mensajes (tipo, optica_id, remitente_id, remitente_nombre, asunto, cuerpo, estado) values ('anuncio', $1, $2, 'Soporte', 'Aviso de prueba', $3, 'resuelto')", [qa, sup, de(2000)])), "un aviso del superadmin de exactamente 2000 caracteres pasa")
  const reabrible = await uno("select id from soporte_consultas where optica_id = $1 and iniciada_por = 'optica' and estado = 'resuelta' limit 1", [qa])
  if (reabrible) ok(largo.test((await falla(adminQa, "select reabrir_consulta_soporte($1, $2)", [reabrible.id, de(2001)])) || ""), "el motivo de reabrir una consulta (también es un mensaje) de más de 2000 caracteres se rechaza")
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTodo pasó (se revirtió: no quedó ningún cambio)." : `\n${fallos} comprobación(es) fallaron (se revirtió).`)
process.exit(fallos === 0 ? 0 : 1)
