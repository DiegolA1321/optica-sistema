// Ensayo de la migración 0115 (Soporte v2): la aplica DENTRO de una transacción, repite lo que hace la pantalla PUBLICADA con `mensajes` y prueba lo nuevo
// con distintos usuarios (administrador, personal con permiso parcial, otra óptica, superadmin y sin sesión). SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0115.mjs
import pg from "pg"
import fs from "node:fs"
import { randomUUID } from "node:crypto"

const sql = fs.readFileSync(new URL("../supabase/migrations/0115_soporte_v2.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  let hecho = false
  try { const r = await fn(); hecho = true; return r } finally { if (hecho) await c.query("reset role") }
}
const intenta = async (uid, fn) => { await c.query("savepoint i"); try { const r = await comoSigue(uid, fn); await c.query("release savepoint i"); return { r } } catch (e) { await c.query("rollback to savepoint i"); await c.query("reset role"); return { e: e.message } } }
const anonimo = async (fn) => {
  await c.query("savepoint a")
  try { await c.query("set local role anon"); const r = await fn(); await c.query("reset role"); await c.query("release savepoint a"); return { r } } catch (e) { await c.query("rollback to savepoint a"); await c.query("reset role"); return { e: e.message } }
}
const directo = async (fn) => { await c.query("savepoint d"); try { const r = await fn(); await c.query("release savepoint d"); return { r } } catch (e) { await c.query("rollback to savepoint d"); return { e: e.message } } }
const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const paula = await perfil("Paula Optómetra Pruebas")
  const ajena = (await c.query("select id, optica_id from perfiles where optica_id <> $1 and rol = 'admin' and activo limit 1", [optica])).rows[0]
  const sup = (await c.query("select id from perfiles where rol = 'superadmin' limit 1")).rows[0]?.id
  if (!admin || !paula || !ajena || !sup) throw new Error("Faltan perfiles para el ensayo")

  let nRol = 0
  const darRol = async (uid, permisos, nombre0) => {
    const nombre = `${nombre0} ${++nRol}`
    await c.query("delete from perfil_roles where perfil_id = $1", [uid])
    const rol = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, $2, $3::jsonb, '{}'::jsonb, false) returning id", [optica, nombre, JSON.stringify(permisos)])).rows[0].id
    await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [uid, rol])
  }

  // ── Antes: lo que ya existe
  const antes = {
    consultas: (await c.query("select count(*)::int n from mensajes where tipo = 'consulta' and optica_id is not null")).rows[0].n,
    mensajes: (await c.query("select count(*)::int n from mensajes")).rows[0].n,
    politicasMensajes: (await c.query("select polname from pg_policy where polrelid = 'public.mensajes'::regclass order by 1")).rows.map((r) => r.polname).join(","),
    propiosConSoporte: (await c.query("select count(*)::int n from roles where not es_predefinido and permisos ? 'mensajes'")).rows[0].n,
    predefinidos: (await c.query("select count(*)::int n from roles where es_predefinido and clave in ('optometra','recepcion','ventas')")).rows[0].n,
    plantillaOptometra: (await c.query("select _plantilla_rol('optometra') p")).rows[0].p,
  }
  console.log(`(antes: ${antes.consultas} consultas y ${antes.mensajes} mensajes en total)`)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const n of ["crear_consulta_soporte", "responder_consulta_soporte", "cerrar_consulta_soporte", "reabrir_consulta_soporte", "calificar_consulta_soporte", "marcar_consulta_soporte_leida",
    "marcar_avisos_leidos", "soporte_responder", "soporte_cambiar_estado", "anonimizar_paciente", "_plantilla_rol"]) {
    ok((await sobrecargas(n)) === 1, `${n}: una sola versión`)
  }

  // ── 1. Lo publicado no cambia
  const despuesPol = (await c.query("select polname from pg_policy where polrelid = 'public.mensajes'::regclass order by 1")).rows.map((r) => r.polname).join(",")
  ok(despuesPol === antes.politicasMensajes, "las políticas de `mensajes` siguen igual (la pantalla publicada lee y escribe como antes)")
  ok((await c.query("select count(*)::int n from mensajes")).rows[0].n === antes.mensajes, "`mensajes` conserva todas sus filas")
  const copiadas = (await c.query("select count(*)::int n from soporte_consultas where mensaje_origen is not null")).rows[0].n
  ok(copiadas === antes.consultas, `las ${antes.consultas} consultas de hoy se copiaron a las tablas nuevas (${copiadas})`)
  const sinConversacion = (await c.query("select count(*)::int n from soporte_consultas c where not exists (select 1 from soporte_mensajes m where m.consulta_id = c.id)")).rows[0].n
  ok(sinConversacion === 0, "cada consulta copiada tiene su conversación")
  const nums = (await c.query("select count(distinct numero)::int d, count(*)::int n from soporte_consultas")).rows[0]
  ok(nums.d === nums.n, "cada consulta tiene su número único")

  // Lo que hace la versión publicada: la óptica inserta en `mensajes` y el superadmin publicado responde editando esa fila.
  let x = await intenta(admin, async () => (await c.query("insert into mensajes (tipo, optica_id, remitente_id, remitente_nombre, asunto, cuerpo) values ('consulta', $1, $2, 'QA Claude Tester', 'ENSAYO 0115 publicado', 'Hola desde la versión publicada') returning id", [optica, admin])).rows[0].id)
  ok(!x.e && x.r, "la versión publicada sigue pudiendo escribir una consulta" + (x.e ? " — " + x.e : ""))
  const msg = x.r
  let k = (await c.query("select * from soporte_consultas where mensaje_origen = $1", [msg])).rows[0]
  ok(k && k.estado === "recibida" && k.optica_id === optica && k.autor_id === admin && k.modulo === "otro", "…y aparece sola en las tablas nuevas, como 'Recibida'")
  x = await intenta(sup, () => c.query("update mensajes set respuesta = 'Respuesta del soporte publicado', respondido_at = now() where id = $1", [msg]))
  k = (await c.query("select * from soporte_consultas where mensaje_origen = $1", [msg])).rows[0]
  ok(!x.e && k.estado === "respondida" && k.respuesta_sin_leer === true && k.primera_respuesta_en !== null, "el superadmin publicado responde en `mensajes`: la consulta pasa a 'Respondida', con respuesta sin leer" + (x.e ? " — " + x.e : ""))
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1", [k.id])).rows[0].n === 2, "…y la respuesta queda en la conversación")
  const legacyId = k.id

  // ── 2. Permisos de la óptica
  await darRol(paula, { citas: ["ver"] }, "Ensayo 0115 sin soporte")
  const crear = (uid, id, extra = {}) => comoSigue(uid, async () => (await c.query("select * from crear_consulta_soporte($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)", [id, extra.modulo || "citas", extra.tipo || "problema", extra.urgencia || "normal", extra.asunto || "ENSAYO 0115 asunto", extra.descripcion || "No puedo agendar una cita", JSON.stringify(extra.contexto || { pantalla: "Citas", navegador: "Ensayo" }), JSON.stringify(extra.adjuntos || [])])).rows[0])
  x = await intenta(paula, () => crear(paula, randomUUID()))
  ok(/No tienes permiso/.test(x.e || ""), "sin el permiso de Soporte no se crea una consulta: " + x.e)
  await darRol(paula, { mensajes: ["ver"] }, "Ensayo 0115 soporte ver")
  x = await intenta(paula, () => crear(paula, randomUUID()))
  ok(/No tienes permiso/.test(x.e || ""), "con Soporte 'ver' solo se miran las suyas: " + x.e)
  await darRol(paula, { mensajes: ["ver", "crear"] }, "Ensayo 0115 soporte crear")

  const cPaula = randomUUID()
  x = await intenta(paula, () => crear(paula, cPaula, { asunto: "ENSAYO 0115 de Paula", urgencia: "urgente", modulo: "ventas", tipo: "problema" }))
  ok(!x.e && x.r && Number.isInteger(x.r.numero), "Paula crea una consulta urgente y recibe su número (SOP-" + String(x.r?.numero || 0).padStart(4, "0") + ")" + (x.e ? " — " + x.e : ""))
  const numPaula = x.r?.numero
  k = (await c.query("select * from soporte_consultas where id = $1", [cPaula])).rows[0]
  ok(k.autor_id === paula && k.urgencia === "urgente" && k.modulo === "ventas" && k.estado === "recibida" && k.autor_rol.length > 0 && k.contexto.pantalla === "Citas", "…con su autor, su rol, módulo, urgencia y el contexto que envió el sistema")
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1 and de = 'optica' and not interna", [cPaula])).rows[0].n === 1, "…y su descripción abre la conversación")

  x = await intenta(paula, () => crear(paula, randomUUID(), { modulo: "no_existe" }))
  ok(!!x.e, "un módulo que no existe se rechaza")
  x = await intenta(paula, () => crear(paula, randomUUID(), { urgencia: "urgentisimo" }))
  ok(!!x.e, "una urgencia que no existe se rechaza")
  x = await intenta(paula, () => crear(paula, randomUUID(), { asunto: "  " }))
  ok(/asunto/.test(x.e || ""), "sin asunto se rechaza: " + x.e)

  const cAdmin = randomUUID()
  await intenta(admin, () => crear(admin, cAdmin, { asunto: "ENSAYO 0115 del admin", modulo: "inventario" }))
  const ver = async (uid) => (await intenta(uid, async () => (await c.query("select id from soporte_consultas where id = any($1::uuid[])", [[cPaula, cAdmin, legacyId]])).rows.map((r) => r.id))).r || []
  let vistas = await ver(paula)
  ok(vistas.includes(cPaula) && !vistas.includes(cAdmin), "Paula ve solo la suya, no la del administrador")
  vistas = await ver(admin)
  ok(vistas.includes(cPaula) && vistas.includes(cAdmin), "el administrador ve las de todo su personal y la suya")
  vistas = await ver(ajena.id)
  ok(vistas.length === 0, "el administrador de OTRA óptica no ve ninguna")
  vistas = await ver(sup)
  ok(vistas.includes(cPaula) && vistas.includes(cAdmin), "el superadmin las ve todas")
  x = await anonimo(() => c.query("select count(*)::int n from soporte_consultas"))
  ok(!!x.e && /permission denied/.test(x.e), "sin sesión no se lee nada: " + x.e)

  // Nadie escribe las tablas directamente
  x = await intenta(admin, () => c.query("insert into soporte_consultas (optica_id, autor_nombre, autor_rol, modulo, tipo, asunto, descripcion) values ($1, 'x', 'x', 'citas', 'problema', 'abc', 'x')", [optica]))
  ok(/permission denied/.test(x.e || ""), "el administrador no puede insertar directamente: " + x.e)
  x = await intenta(admin, () => c.query("update soporte_consultas set estado = 'resuelta', calificacion = 5 where id = $1", [cPaula]))
  ok(/permission denied/.test(x.e || ""), "…ni cambiar el estado ni la calificación a mano: " + x.e)
  x = await intenta(sup, () => c.query("update soporte_consultas set estado = 'resuelta' where id = $1", [cPaula]))
  ok(/permission denied/.test(x.e || ""), "…ni siquiera el superadmin por la tabla (lo hace con sus funciones): " + x.e)
  x = await intenta(admin, () => c.query("insert into soporte_mensajes (consulta_id, optica_id, autor_nombre, de, cuerpo) values ($1, $2, 'x', 'soporte', 'x')", [cPaula, optica]))
  ok(/permission denied/.test(x.e || ""), "nadie se hace pasar por el soporte escribiendo la conversación a mano: " + x.e)

  // ── 3. Capturas (el almacenamiento)
  const subir = async (ruta, size = 1000, mimetype = "image/png") => c.query("insert into storage.objects (bucket_id, name, metadata) values ('soporte-adjuntos', $1, $2::jsonb)", [ruta, JSON.stringify({ size, mimetype })])
  const idCaptura = randomUUID()
  await subir(`${optica}/${idCaptura}/a.png`)
  await subir(`${optica}/${idCaptura}/b.png`)
  await subir(`${optica}/${idCaptura}/c.png`)
  await subir(`${optica}/${idCaptura}/d.png`)
  await subir(`${optica}/${idCaptura}/grande.png`, 6 * 1024 * 1024)
  const adj = (...nombres) => nombres.map((n) => ({ ruta: `${optica}/${idCaptura}/${n}`, nombre: n }))
  x = await intenta(paula, () => crear(paula, idCaptura, { asunto: "ENSAYO 0115 con capturas", urgencia: "urgente", adjuntos: adj("a.png", "b.png") }))
  ok(!x.e && x.r, "una consulta con 2 capturas ya subidas se crea" + (x.e ? " — " + x.e : ""))
  const adjGuardados = (await c.query("select adjuntos from soporte_mensajes where consulta_id = $1", [idCaptura])).rows[0]?.adjuntos
  ok(adjGuardados?.length === 2 && adjGuardados[0].bytes === 1000 && adjGuardados[0].tipo === "image/png", "…y guarda el tamaño y el tipo reales del almacenamiento")
  x = await intenta(paula, () => crear(paula, randomUUID(), { adjuntos: adj("a.png", "b.png", "c.png", "d.png") }))
  ok(/hasta 3/.test(x.e || ""), "más de 3 capturas se rechaza: " + x.e)
  x = await intenta(paula, () => crear(paula, idCaptura + "", { adjuntos: adj("a.png") }))
  ok(!!x.e, "no se puede crear dos veces la misma consulta")
  const otra = randomUUID()
  x = await intenta(paula, () => crear(paula, otra, { adjuntos: adj("a.png") }))
  ok(/lugar correcto/.test(x.e || ""), "una captura de la carpeta de otra consulta se rechaza: " + x.e)
  const otra2 = randomUUID()
  x = await intenta(paula, () => crear(paula, otra2, { adjuntos: [{ ruta: `${optica}/${otra2}/no-existe.png`, nombre: "x" }] }))
  ok(/no se subió/.test(x.e || ""), "una captura que no se subió se rechaza: " + x.e)
  await subir(`${optica}/${otra2}/grande.png`, 6 * 1024 * 1024)
  x = await intenta(paula, () => crear(paula, otra2, { adjuntos: [{ ruta: `${optica}/${otra2}/grande.png`, nombre: "g" }] }))
  ok(/5 MB/.test(x.e || ""), "una captura de más de 5 MB se rechaza: " + x.e)
  const bucket = (await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'soporte-adjuntos'")).rows[0]
  ok(bucket && bucket.public === false && Number(bucket.file_size_limit) === 5242880 && bucket.allowed_mime_types.every((t) => t.startsWith("image/")), "el bucket es privado, de 5 MB y solo admite imágenes")

  // Quién baja las capturas
  const veArchivo = async (uid, ruta) => (await intenta(uid, async () => (await c.query("select count(*)::int n from storage.objects where bucket_id = 'soporte-adjuntos' and name = $1", [ruta])).rows[0].n)).r
  ok((await veArchivo(paula, `${optica}/${idCaptura}/a.png`)) === 1, "el autor baja sus capturas")
  ok((await veArchivo(admin, `${optica}/${idCaptura}/a.png`)) === 1, "el administrador de la óptica también")
  ok((await veArchivo(ajena.id, `${optica}/${idCaptura}/a.png`)) === 0, "el administrador de otra óptica NO")
  ok((await veArchivo(sup, `${optica}/${idCaptura}/a.png`)) === 1, "el superadmin sí")
  await darRol(paula, { mensajes: ["ver", "crear"], citas: ["ver"] }, "Ensayo 0115 soporte crear")
  const compa = ajena // otra persona de OTRA óptica no sirve para "compañera": se prueba con el rol sin autoría más abajo
  x = await intenta(paula, () => subir(`${ajena.optica_id}/${randomUUID()}/x.png`))
  ok(/row-level security|violates/.test(x.e || ""), "no se puede subir a la carpeta de otra óptica: " + x.e)
  x = await intenta(paula, () => subir(`${optica}/${randomUUID()}/x.png`))
  ok(!x.e, "sí se puede subir a la carpeta de la propia" + (x.e ? " — " + x.e : ""))
  await darRol(paula, { mensajes: ["ver"] }, "Ensayo 0115 soporte ver")
  x = await intenta(paula, () => subir(`${optica}/${randomUUID()}/y.png`))
  ok(/row-level security|violates/.test(x.e || ""), "sin Soporte 'crear' no se sube nada: " + x.e)
  await darRol(paula, { mensajes: ["ver", "crear"] }, "Ensayo 0115 soporte crear")

  // ── 4. La conversación
  const responder = (uid, id, cuerpo, adjuntos = []) => comoSigue(uid, () => c.query("select responder_consulta_soporte($1,$2,$3::jsonb)", [id, cuerpo, JSON.stringify(adjuntos)]))
  const soporte = (uid, id, cuerpo, interna = false, estado = null, adjuntos = []) => comoSigue(uid, () => c.query("select soporte_responder($1,$2,$3,$4,$5::jsonb)", [id, cuerpo, interna, estado, JSON.stringify(adjuntos)]))
  const estadoDe = async (id) => (await c.query("select estado, respuesta_sin_leer, primera_respuesta_en, resuelta_en, calificacion, ultimo_mensaje_de, reabierta_veces from soporte_consultas where id = $1", [id])).rows[0]

  x = await intenta(paula, () => soporte(paula, cPaula, "Soy el soporte"))
  ok(/Solo el soporte/.test(x.e || ""), "una persona de la óptica no puede responder como soporte: " + x.e)
  x = await intenta(admin, () => soporte(admin, cPaula, "Soy el soporte"))
  ok(/Solo el soporte/.test(x.e || ""), "ni siquiera el administrador de la óptica: " + x.e)
  x = await intenta(sup, () => soporte(sup, cPaula, "Nota solo nuestra: parece un error de horario", true))
  ok(!x.e, "el superadmin agrega una nota interna" + (x.e ? " — " + x.e : ""))
  let e = await estadoDe(cPaula)
  ok(e.estado === "recibida" && e.respuesta_sin_leer === false && e.primera_respuesta_en === null, "…que no cambia el estado, no cuenta como primera respuesta y no avisa a nadie")
  const internas = async (uid) => (await intenta(uid, async () => (await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1 and interna", [cPaula])).rows[0].n)).r
  ok((await internas(sup)) === 1, "el superadmin ve la nota interna")
  ok((await internas(paula)) === 0 && (await internas(admin)) === 0, "ni la autora ni el administrador de la óptica la ven")
  ok((await internas(ajena.id)) === 0, "ni nadie de otra óptica")

  x = await intenta(sup, () => soporte(sup, cPaula, "Revisa en Citas > Nueva cita y vuelve a intentarlo."))
  ok(!x.e, "el superadmin responde" + (x.e ? " — " + x.e : ""))
  e = await estadoDe(cPaula)
  ok(e.estado === "respondida" && e.respuesta_sin_leer === true && e.primera_respuesta_en !== null && e.ultimo_mensaje_de === "soporte", "…pasa a 'Respondida', con respuesta sin leer y registra la primera respuesta")
  const primera = e.primera_respuesta_en
  const pendientesDe = async (uid) => (await intenta(uid, async () => (await c.query("select count(*)::int n from soporte_consultas where autor_id = auth.uid() and respuesta_sin_leer")).rows[0].n)).r
  ok((await pendientesDe(paula)) >= 1, "Paula la ve en su campanita (respuesta sin leer)")
  x = await intenta(admin, () => comoSigue(admin, () => c.query("select marcar_consulta_soporte_leida($1)", [cPaula])))
  e = await estadoDe(cPaula)
  ok(e.respuesta_sin_leer === true, "el administrador abrirla NO apaga el aviso de Paula (es de la autora)")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select marcar_consulta_soporte_leida($1)", [cPaula])))
  e = await estadoDe(cPaula)
  ok(!x.e && e.respuesta_sin_leer === false, "Paula la abre y el aviso baja")

  x = await intenta(paula, () => responder(paula, cPaula, "Ya probé y sigue igual", adj("a.png").map((a) => ({ ...a, ruta: `${optica}/${cPaula}/zz.png` }))))
  ok(!!x.e, "una captura que no se subió se rechaza al responder")
  await subir(`${optica}/${cPaula}/ok.png`)
  x = await intenta(paula, () => responder(paula, cPaula, "Ya probé y sigue igual", [{ ruta: `${optica}/${cPaula}/ok.png`, nombre: "ok.png" }]))
  e = await estadoDe(cPaula)
  ok(!x.e && e.estado === "en_revision" && e.ultimo_mensaje_de === "optica", "Paula responde con una captura: vuelve a 'En revisión'" + (x.e ? " — " + x.e : ""))
  x = await intenta(admin, () => responder(admin, cPaula, "El administrador también escribe"))
  ok(!x.e, "el administrador de la óptica también puede escribir en la conversación")
  x = await intenta(ajena.id, () => responder(ajena.id, cPaula, "Intruso"))
  ok(/No tienes acceso|No encontramos/.test(x.e || ""), "una persona de OTRA óptica no puede escribir: " + x.e)
  await darRol(paula, { mensajes: ["ver"] }, "Ensayo 0115 soporte ver")
  x = await intenta(paula, () => responder(paula, cPaula, "Sin permiso de crear"))
  ok(/No tienes permiso/.test(x.e || ""), "con Soporte 'ver' no se escribe: " + x.e)
  await darRol(paula, { mensajes: ["ver", "crear"] }, "Ensayo 0115 soporte crear")
  e = await estadoDe(cPaula)
  ok(e.primera_respuesta_en?.getTime() === primera.getTime(), "la primera respuesta no se mueve con las siguientes")

  // ── 5. Resolver, calificar y reabrir
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select calificar_consulta_soporte($1, 5, 'Muy bien')", [cPaula])))
  ok(/esté resuelta/.test(x.e || ""), "no se califica antes de resolver: " + x.e)
  x = await intenta(sup, () => comoSigue(sup, () => c.query("select soporte_cambiar_estado($1, 'resuelta')", [cPaula])))
  e = await estadoDe(cPaula)
  ok(!x.e && e.estado === "resuelta" && e.resuelta_en !== null && e.respuesta_sin_leer === true, "el superadmin la resuelve: queda la hora de resolución y Paula recibe el aviso")
  x = await intenta(paula, () => responder(paula, cPaula, "Gracias"))
  ok(/ya está resuelta/.test(x.e || ""), "una consulta resuelta no recibe más mensajes sin reabrirla: " + x.e)
  x = await intenta(admin, () => comoSigue(admin, () => c.query("select calificar_consulta_soporte($1, 1, null)", [cPaula])))
  ok(/No encontramos/.test(x.e || ""), "el administrador no puede calificar la consulta de otra persona: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select calificar_consulta_soporte($1, 7, null)", [cPaula])))
  ok(/1 a 5/.test(x.e || ""), "la calificación va de 1 a 5: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select calificar_consulta_soporte($1, 4, 'Me ayudaron rápido')", [cPaula])))
  e = await estadoDe(cPaula)
  ok(!x.e && e.calificacion === 4, "Paula la califica con 4")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select calificar_consulta_soporte($1, 5, null)", [cPaula])))
  ok(/Ya calificaste/.test(x.e || ""), "no se califica dos veces: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select reabrir_consulta_soporte($1, '  ')", [cPaula])))
  ok(/qué sigue pasando/.test(x.e || ""), "reabrir pide el motivo: " + x.e)
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select reabrir_consulta_soporte($1, 'Sigue sin dejarme agendar')", [cPaula])))
  e = await estadoDe(cPaula)
  ok(!x.e && e.estado === "en_revision" && e.resuelta_en === null && e.calificacion === null && e.reabierta_veces === 1, "Paula la reabre: vuelve a 'En revisión', se cuenta la reapertura y se pedirá calificar de nuevo")
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1 and cuerpo = 'Sigue sin dejarme agendar'", [cPaula])).rows[0].n === 1, "…y el motivo queda en la conversación")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select cerrar_consulta_soporte($1)", [cPaula])))
  e = await estadoDe(cPaula)
  ok(!x.e && e.estado === "resuelta", "Paula también puede marcarla como resuelta ('ya está resuelto')")

  // ── 6. Lo que el superadmin hace por una consulta que vino de la versión publicada vuelve a `mensajes`
  x = await intenta(sup, () => soporte(sup, legacyId, "Respuesta desde el soporte nuevo", false, "resuelta"))
  const m = (await c.query("select respuesta, estado from mensajes where id = $1", [msg])).rows[0]
  ok(!x.e && m.respuesta === "Respuesta desde el soporte nuevo" && m.estado === "resuelto", "la respuesta y el estado vuelven a `mensajes`, para quien aún usa la versión publicada" + (x.e ? " — " + x.e : ""))
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1 and cuerpo = 'Respuesta desde el soporte nuevo'", [legacyId])).rows[0].n === 1, "…sin duplicar la respuesta en la conversación")

  // ── 7. Respuestas guardadas
  x = await intenta(admin, () => c.query("insert into soporte_respuestas_guardadas (titulo, texto) values ('ENSAYO', 'Texto de ensayo')"))
  ok(/permission denied|row-level security/.test(x.e || ""), "el administrador de una óptica no crea respuestas guardadas: " + x.e)
  x = await intenta(sup, () => c.query("insert into soporte_respuestas_guardadas (titulo, texto) values ('ENSAYO 0115', 'Texto de ensayo') returning id"))
  ok(!x.e, "el superadmin sí" + (x.e ? " — " + x.e : ""))
  x = await intenta(admin, async () => (await c.query("select count(*)::int n from soporte_respuestas_guardadas")).rows[0].n)
  ok(x.r === 0, "y la óptica no las ve")

  // ── 8. Avisos del sistema: leído / no leído
  const aviso = (await c.query("insert into mensajes (tipo, optica_id, remitente_nombre, asunto, cuerpo, estado) values ('anuncio', null, 'Superadmin', 'ENSAYO 0115 aviso', 'Hola a todos', 'resuelto') returning id")).rows[0].id
  const avisoAjeno = (await c.query("insert into mensajes (tipo, optica_id, remitente_nombre, asunto, cuerpo, estado) values ('anuncio', $1, 'Superadmin', 'ENSAYO 0115 aviso ajeno', 'Solo para otra', 'resuelto') returning id", [ajena.optica_id])).rows[0].id
  x = await intenta(admin, () => comoSigue(admin, () => c.query("select marcar_avisos_leidos(array[$1::uuid, $2::uuid])", [aviso, avisoAjeno])))
  const leidos = (await c.query("select mensaje_id from avisos_leidos where perfil_id = $1", [admin])).rows.map((r) => r.mensaje_id)
  ok(!x.e && leidos.includes(aviso) && !leidos.includes(avisoAjeno), "marcar un aviso como leído funciona, y el aviso de otra óptica no se puede marcar")
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from avisos_leidos")).rows[0].n)
  ok(x.r === 0, "cada persona ve solo sus lecturas")

  // ── 9. Anonimizar a un paciente limpia también Soporte
  const pac = (await c.query("insert into pacientes_base (optica_id, nombre, cedula, telefono, correo) values ($1, 'Zoilo Ensayo Quince', '0900000015', '0993334444', 'zoilo15@x.com') returning id", [optica])).rows[0].id
  const cPac = randomUUID()
  await intenta(admin, () => crear(admin, cPac, { asunto: "No puedo cobrar a Zoilo Ensayo Quince", descripcion: "El paciente Zoilo Ensayo Quince, cédula 0900000015, no aparece" }))
  x = await intenta(admin, () => comoSigue(admin, () => c.query("select anonimizar_paciente($1)", [pac])))
  ok(!x.e, "anonimizar un paciente sigue funcionando" + (x.e ? " — " + x.e : ""))
  const t = (await c.query("select c.asunto, c.descripcion, (select string_agg(m.cuerpo, ' ') from soporte_mensajes m where m.consulta_id = c.id) conv from soporte_consultas c where c.id = $1", [cPac])).rows[0]
  ok(!/Zoilo|0900000015/.test(`${t.asunto} ${t.descripcion} ${t.conv}`), "…y su nombre y cédula desaparecen de las consultas de Soporte: " + t.asunto)

  // ── 11. Ajustes y roles existentes
  const aj = (await c.query("select clave, valor from soporte_ajustes order by clave")).rows
  ok(aj.length === 2 && aj.find((a) => a.clave === "tiempo_urgente").valor === "el mismo día hábil" && aj.find((a) => a.clave === "tiempo_normal").valor === "en un máximo de 1 día hábil", "los tiempos de respuesta nacen con los textos acordados")
  x = await intenta(admin, () => c.query("update soporte_ajustes set valor = 'en 5 minutos' where clave = 'tiempo_urgente'"))
  ok(/permission|row-level/.test(x.e || "") || (await c.query("select valor from soporte_ajustes where clave = 'tiempo_urgente'")).rows[0].valor === "el mismo día hábil", "el administrador de una óptica no cambia los tiempos")
  x = await intenta(admin, async () => (await c.query("select count(*)::int n from soporte_ajustes")).rows[0].n)
  ok(x.r === 2, "…pero sí los lee")
  x = await intenta(sup, () => c.query("update soporte_ajustes set valor = 'en unas 4 horas hábiles' where clave = 'tiempo_urgente' returning valor"))
  ok(!x.e && x.r.rows[0]?.valor === "en unas 4 horas hábiles", "el superadmin sí los cambia")
  const rolesFaltan = (await c.query("select count(*)::int n from roles where es_predefinido and clave in ('optometra','recepcion','ventas') and not (permisos -> 'mensajes' @> '[\"ver\",\"crear\"]'::jsonb)")).rows[0].n
  ok(rolesFaltan === 0, "todos los roles predefinidos de las ópticas que ya existen tienen Soporte (ver y crear)")
  ok((await c.query("select count(*)::int n from roles where not es_predefinido and permisos ? 'mensajes' and nombre not like 'Ensayo 0115%'")).rows[0].n === antes.propiosConSoporte, "los roles propios no se tocaron")
  ok((await c.query("select count(*)::int n from roles where es_predefinido and clave in ('optometra','recepcion','ventas')")).rows[0].n === antes.predefinidos, "no se creó ni se borró ningún rol")

  // ── 10. Roles de una óptica nueva
  const plantillas = (await c.query("select _plantilla_rol('optometra') o, _plantilla_rol('recepcion') r, _plantilla_rol('ventas') v")).rows[0]
  ok([plantillas.o, plantillas.r, plantillas.v].every((p) => JSON.stringify(p.permisos.mensajes) === '["ver","crear"]'), "Optómetra, Recepción y Ventas de una óptica nueva reciben Soporte (ver y crear)")
  const sinMensajes = JSON.parse(JSON.stringify(plantillas.o.permisos)); delete sinMensajes.mensajes
  const viejo = JSON.parse(JSON.stringify(antes.plantillaOptometra.permisos))
  ok(JSON.stringify(sinMensajes) === JSON.stringify(viejo), "el resto de los permisos de la plantilla no cambió")

  console.log(fallos === 0 ? "\nTODO BIEN: la migración 0115 pasa el ensayo (se revierte, no deja nada)." : `\n${fallos} PRUEBA(S) FALLARON.`)
} catch (e) {
  console.error("ERROR EN EL ENSAYO:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
  console.log("(rollback: la base queda exactamente como estaba)")
  process.exit(fallos ? 1 : 0)
}
