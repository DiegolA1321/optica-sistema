// Ensayo de la migración 0116 (comunicación interna): la aplica DENTRO de una transacción y prueba, con distintos usuarios (administrador, personal, otra
// óptica, superadmin y sin sesión), quién escribe a quién, la escalada, los avisos internos y los adjuntos. SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0116.mjs
import pg from "pg"
import fs from "node:fs"
import { randomUUID } from "node:crypto"

const sql = fs.readFileSync(new URL("../supabase/migrations/0116_comunicacion_interna.sql", import.meta.url), "utf8")
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
const sobrecargas = async (n) => (await c.query("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = $1", [n])).rows[0].n

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfil = async (nombre) => (await c.query("select id from perfiles where optica_id = $1 and nombre = $2", [optica, nombre])).rows[0]?.id
  const admin = await perfil("QA Claude Tester")
  const paula = await perfil("Paula Optómetra Pruebas")
  const rosa = await perfil("Rosa Recepción Pruebas")
  const vera = await perfil("Vera Ventas Pruebas")
  const ajena = (await c.query("select id, optica_id from perfiles where optica_id <> $1 and rol = 'admin' and activo limit 1", [optica])).rows[0]
  const sup = (await c.query("select id from perfiles where rol = 'superadmin' limit 1")).rows[0]?.id
  if (!admin || !paula || !rosa || !vera || !ajena || !sup) throw new Error("Faltan perfiles para el ensayo")
  const rolOptometra = (await c.query("select id from roles where optica_id = $1 and clave = 'optometra'", [optica])).rows[0]?.id
  const rolRecepcion = (await c.query("select id from roles where optica_id = $1 and clave = 'recepcion'", [optica])).rows[0]?.id
  if (!rolOptometra || !rolRecepcion) throw new Error("Faltan los roles predefinidos")

  // ── Antes
  const antes = {
    consultas: (await c.query("select count(*)::int n, count(*) filter (where autor_id <> $1)::int de_personal from soporte_consultas", [admin])).rows[0],
    politicasMensajes: (await c.query("select polname from pg_policy where polrelid = 'public.mensajes'::regclass order by 1")).rows.map((r) => r.polname).join(","),
    rolesPredefinidos: (await c.query("select clave, permisos from roles where es_predefinido and clave in ('optometra','recepcion','ventas') order by id")).rows,
    rolesPropios: (await c.query("select id, permisos from roles where not es_predefinido order by id")).rows,
  }
  console.log(`(antes: ${antes.consultas.n} consultas en Soporte)`)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  for (const n of ["crear_consulta_soporte", "responder_consulta_soporte", "soporte_responder", "soporte_cambiar_estado", "_validar_adjuntos_soporte", "escalar_consulta_soporte",
    "publicar_aviso_interno", "retirar_aviso_interno", "marcar_avisos_internos_leidos", "lecturas_avisos_internos"]) {
    ok((await sobrecargas(n)) === 1, `${n}: una sola versión`)
  }

  // ── 1. Lo que ya existe no cambia
  ok((await c.query("select count(*)::int n from soporte_consultas where destino = 'superadmin'")).rows[0].n === antes.consultas.n, "las consultas que ya existían siguen con el soporte del sistema")
  const despuesPol = (await c.query("select polname from pg_policy where polrelid = 'public.mensajes'::regclass order by 1")).rows.map((r) => r.polname).join(",")
  ok(despuesPol === antes.politicasMensajes, "las políticas de `mensajes` (la versión publicada) siguen igual")
  const rolesDespues = (await c.query("select clave, permisos from roles where es_predefinido and clave in ('optometra','recepcion','ventas') order by id")).rows
  ok(JSON.stringify(rolesDespues) === JSON.stringify(antes.rolesPredefinidos), "los roles predefinidos no cambian de permisos (Soporte ver y crear sigue igual)")
  ok(JSON.stringify((await c.query("select id, permisos from roles where not es_predefinido order by id")).rows) === JSON.stringify(antes.rolesPropios), "los roles propios no se tocaron")

  // ── 2. Quién escribe a quién
  const crear = (uid, id, extra = {}) => comoSigue(uid, async () => (await c.query("select * from crear_consulta_soporte($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb)", [id, extra.modulo || "citas", extra.tipo || "problema", extra.urgencia || "normal", extra.asunto || "ENSAYO 0116 asunto", extra.descripcion || "No puedo agendar una cita", JSON.stringify({ pantalla: "Citas" }), JSON.stringify(extra.adjuntos || [])])).rows[0])
  const cRosa = randomUUID()
  let x = await intenta(rosa, () => crear(rosa, cRosa, { asunto: "ENSAYO 0116 de Rosa", modulo: "ventas" }))
  ok(!x.e && x.r, "Recepción escribe una consulta" + (x.e ? " — " + x.e : ""))
  let k = (await c.query("select destino, autor_id, estado from soporte_consultas where id = $1", [cRosa])).rows[0]
  ok(k.destino === "admin" && k.autor_id === rosa, "…y va a su administrador (destino 'admin'), no al soporte del sistema")
  const cAdmin = randomUUID()
  await intenta(admin, () => crear(admin, cAdmin, { asunto: "ENSAYO 0116 del admin" }))
  ok((await c.query("select destino from soporte_consultas where id = $1", [cAdmin])).rows[0].destino === "superadmin", "el administrador escribe al soporte del sistema (destino 'superadmin')")
  const cPaula = randomUUID()
  await intenta(paula, () => crear(paula, cPaula, { asunto: "ENSAYO 0116 de Paula" }))

  const ver = async (uid) => (await intenta(uid, async () => (await c.query("select id from soporte_consultas where id = any($1::uuid[])", [[cRosa, cAdmin, cPaula]])).rows.map((r) => r.id))).r || []
  let v = await ver(rosa)
  ok(v.includes(cRosa) && !v.includes(cPaula) && !v.includes(cAdmin), "Recepción ve solo la suya (no la de Paula ni la del administrador)")
  v = await ver(paula)
  ok(v.includes(cPaula) && !v.includes(cRosa), "Paula ve solo la suya")
  v = await ver(admin)
  ok(v.includes(cRosa) && v.includes(cPaula) && v.includes(cAdmin), "el administrador ve las de todo su personal y la suya")
  v = await ver(ajena.id)
  ok(v.length === 0, "el administrador de otra óptica no ve ninguna")
  v = await ver(sup)
  ok(v.includes(cAdmin) && !v.includes(cRosa) && !v.includes(cPaula), "el superadmin ve la del administrador, pero NO las que se quedan entre el personal y su administrador")
  x = await anonimo(() => c.query("select count(*)::int n from soporte_consultas"))
  ok(!!x.e && /permission denied/.test(x.e), "sin sesión no se lee nada")
  x = await intenta(sup, () => comoSigue(sup, () => c.query("select soporte_responder($1,'intento')", [cRosa])))
  ok(/No encontramos/.test(x.e || ""), "el superadmin no puede responder una consulta que no le llegó: " + x.e)
  x = await intenta(sup, () => comoSigue(sup, () => c.query("select soporte_cambiar_estado($1,'resuelta')", [cRosa])))
  ok(/No encontramos/.test(x.e || ""), "ni cambiarle el estado: " + x.e)

  // ── 3. El administrador responde a su personal
  const responder = (uid, id, cuerpo, adj = []) => comoSigue(uid, () => c.query("select responder_consulta_soporte($1,$2,$3::jsonb)", [id, cuerpo, JSON.stringify(adj)]))
  const estadoDe = async (id) => (await c.query("select estado, destino, respuesta_sin_leer, ultimo_mensaje_de, primera_respuesta_en, escalada_en from soporte_consultas where id = $1", [id])).rows[0]
  x = await intenta(paula, () => responder(paula, cRosa, "Me meto en la consulta de Rosa"))
  ok(/No encontramos/.test(x.e || ""), "una compañera no puede escribir en la consulta de otra: " + x.e)
  x = await intenta(admin, () => responder(admin, cRosa, "Prueba con otro paciente y me cuentas."))
  ok(!x.e, "el administrador responde a Recepción" + (x.e ? " — " + x.e : ""))
  let e = await estadoDe(cRosa)
  ok(e.estado === "respondida" && e.respuesta_sin_leer === true && e.ultimo_mensaje_de === "admin" && e.primera_respuesta_en === null, "…pasa a 'Respondida', con respuesta sin leer para Recepción, sin contar como respuesta del soporte del sistema")
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1 and de = 'admin'", [cRosa])).rows[0].n === 1, "…y queda en la conversación con 'admin' como remitente")
  x = await intenta(rosa, () => responder(rosa, cRosa, "Sigue igual"))
  e = await estadoDe(cRosa)
  ok(!x.e && e.estado === "en_revision" && e.ultimo_mensaje_de === "optica", "Recepción contesta: vuelve a 'En revisión' (le toca al administrador)")

  // ── 4. Escalar: solo el administrador
  const escalar = (uid, id, nota) => comoSigue(uid, () => c.query("select escalar_consulta_soporte($1,$2)", [id, nota || null]))
  x = await intenta(rosa, () => escalar(rosa, cRosa))
  ok(/Solo el administrador/.test(x.e || ""), "Recepción no puede escalar su propia consulta: " + x.e)
  x = await intenta(ajena.id, () => escalar(ajena.id, cRosa))
  ok(!!x.e, "el administrador de otra óptica tampoco: " + x.e)
  x = await intenta(sup, () => escalar(sup, cRosa))
  ok(!!x.e, "ni el superadmin (no es de la óptica): " + x.e)
  x = await intenta(admin, () => escalar(admin, cAdmin))
  ok(/ya está con el soporte/.test(x.e || ""), "no se escala lo que ya está con el soporte: " + x.e)
  x = await intenta(admin, () => escalar(admin, cRosa, "No logro reproducirlo."))
  ok(!x.e, "el administrador escala la consulta de Recepción" + (x.e ? " — " + x.e : ""))
  e = await estadoDe(cRosa)
  ok(e.destino === "superadmin" && e.estado === "recibida" && e.escalada_en !== null && e.ultimo_mensaje_de === "optica", "…ahora está con el soporte del sistema, 'Recibida', con la fecha de escalada")
  ok((await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1", [cRosa])).rows[0].n === 4, "…con toda la conversación (descripción, respuesta del administrador, mensaje de Recepción y la escalada)")
  v = await ver(sup)
  ok(v.includes(cRosa), "el superadmin ya la ve")
  const mensajesQueVe = async (uid) => (await intenta(uid, async () => (await c.query("select count(*)::int n from soporte_mensajes where consulta_id = $1", [cRosa])).rows[0].n)).r
  ok((await mensajesQueVe(sup)) === 4, "…y ve la conversación completa")
  ok((await mensajesQueVe(paula)) === 0, "una compañera sigue sin verla")
  x = await intenta(admin, () => escalar(admin, cRosa))
  ok(/ya está con el soporte/.test(x.e || ""), "no se puede escalar dos veces: " + x.e)

  const soporte = (uid, id, cuerpo, interna = false, estado = null) => comoSigue(uid, () => c.query("select soporte_responder($1,$2,$3,$4,'[]'::jsonb)", [id, cuerpo, interna, estado]))
  x = await intenta(sup, () => soporte(sup, cRosa, "Es un error de configuración; ya lo corregimos."))
  ok(!x.e, "el superadmin responde" + (x.e ? " — " + x.e : ""))
  e = await estadoDe(cRosa)
  ok(e.estado === "respondida" && e.respuesta_sin_leer === true && e.ultimo_mensaje_de === "soporte" && e.primera_respuesta_en !== null, "…'Respondida', con respuesta sin leer, para quien escribió")
  const sinLeer = async (uid) => (await intenta(uid, async () => (await c.query("select count(*)::int n from soporte_consultas where autor_id = auth.uid() and respuesta_sin_leer")).rows[0].n)).r
  ok((await sinLeer(rosa)) >= 1, "Recepción ve la respuesta en su campanita")
  ok((await mensajesQueVe(rosa)) === 5, "…y la lee en su conversación, completa")

  // ── 5. Adjuntos: PDF, Word y Excel; nada más
  const subir = async (ruta, size = 1000, mimetype = "image/png") => c.query("insert into storage.objects (bucket_id, name, metadata) values ('soporte-adjuntos', $1, $2::jsonb)", [ruta, JSON.stringify({ size, mimetype })])
  const bucket = (await c.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'soporte-adjuntos'")).rows[0]
  ok(bucket.public === false && Number(bucket.file_size_limit) === 10485760, "el bucket sigue privado y ahora admite 10 MB")
  ok(["application/pdf", DOCX, XLSX, "image/png"].every((t) => bucket.allowed_mime_types.includes(t)) && bucket.allowed_mime_types.length === 7, "…solo con imágenes, PDF, Word y Excel (sin tipos con macros)")
  ok(!bucket.allowed_mime_types.some((t) => /macro/i.test(t)), "…ningún tipo 'macroEnabled'")
  const idAdj = randomUUID()
  await subir(`${optica}/${idAdj}/informe.pdf`, 2 * 1024 * 1024, "application/pdf")
  await subir(`${optica}/${idAdj}/carta.docx`, 50000, DOCX)
  await subir(`${optica}/${idAdj}/datos.xlsx`, 50000, XLSX)
  await subir(`${optica}/${idAdj}/macro.xlsm`, 1000, "application/vnd.ms-excel.sheet.macroEnabled.12")
  await subir(`${optica}/${idAdj}/macro2.docx`, 1000, "application/vnd.ms-word.document.macroEnabled.12")
  await subir(`${optica}/${idAdj}/disfrazado.xlsx`, 1000, "application/zip")
  await subir(`${optica}/${idAdj}/script.exe`, 1000, "application/pdf")
  await subir(`${optica}/${idAdj}/grande.pdf`, 11 * 1024 * 1024, "application/pdf")
  const adj = (id, ...n) => n.map((x) => ({ ruta: `${optica}/${id}/${x}`, nombre: x }))
  x = await intenta(rosa, () => crear(rosa, idAdj, { asunto: "ENSAYO 0116 con documentos", adjuntos: adj(idAdj, "informe.pdf", "carta.docx", "datos.xlsx") }))
  ok(!x.e && x.r, "una consulta con PDF, Word y Excel se crea" + (x.e ? " — " + x.e : ""))
  const guardados = (await c.query("select adjuntos from soporte_mensajes where consulta_id = $1", [idAdj])).rows[0]?.adjuntos
  ok(guardados?.length === 3 && guardados[0].tipo === "application/pdf" && guardados[0].bytes === 2 * 1024 * 1024, "…y guarda el tipo y el tamaño reales del almacenamiento")
  for (const [nombre, texto] of [["macro.xlsm", /macros/], ["macro2.docx", /macros/], ["disfrazado.xlsx", /macros/], ["script.exe", /Solo se aceptan/], ["grande.pdf", /10 MB/]]) {
    const idx = randomUUID()
    await subir(`${optica}/${idx}/${nombre}`, nombre === "grande.pdf" ? 11 * 1024 * 1024 : 1000, nombre === "macro.xlsm" ? "application/vnd.ms-excel.sheet.macroEnabled.12" : nombre === "macro2.docx" ? "application/vnd.ms-word.document.macroEnabled.12" : nombre === "disfrazado.xlsx" ? "application/zip" : "application/pdf")
    x = await intenta(rosa, () => crear(rosa, idx, { adjuntos: adj(idx, nombre) }))
    ok(texto.test(x.e || ""), `se rechaza ${nombre}: ${x.e}`)
  }
  // Al subir (almacenamiento): la extensión se valida con la política
  x = await intenta(rosa, () => subir(`${optica}/${randomUUID()}/macro.xlsm`))
  ok(/row-level security|violates/.test(x.e || ""), "el almacenamiento rechaza subir un .xlsm: " + x.e)
  x = await intenta(rosa, () => subir(`${optica}/${randomUUID()}/programa.exe`))
  ok(/row-level security|violates/.test(x.e || ""), "…y un .exe: " + x.e)
  x = await intenta(rosa, () => subir(`${optica}/${randomUUID()}/informe.pdf`, 1000, "application/pdf"))
  ok(!x.e, "…pero sí un .pdf en la carpeta de su óptica" + (x.e ? " — " + x.e : ""))
  x = await intenta(rosa, () => subir(`${ajena.optica_id}/${randomUUID()}/informe.pdf`, 1000, "application/pdf"))
  ok(/row-level security|violates/.test(x.e || ""), "…y no en la carpeta de otra óptica: " + x.e)
  const veArchivo = async (uid, ruta) => (await intenta(uid, async () => (await c.query("select count(*)::int n from storage.objects where bucket_id = 'soporte-adjuntos' and name = $1", [ruta])).rows[0].n)).r
  ok((await veArchivo(rosa, `${optica}/${idAdj}/informe.pdf`)) === 1, "quien escribió baja su PDF")
  ok((await veArchivo(admin, `${optica}/${idAdj}/informe.pdf`)) === 1, "el administrador de su óptica también")
  ok((await veArchivo(paula, `${optica}/${idAdj}/informe.pdf`)) === 0, "una compañera NO")
  ok((await veArchivo(ajena.id, `${optica}/${idAdj}/informe.pdf`)) === 0, "otra óptica NO")
  ok((await veArchivo(sup, `${optica}/${idAdj}/informe.pdf`)) === 0, "el superadmin NO, mientras la consulta no le haya llegado")
  await c.query("reset role")
  await intenta(admin, () => escalar(admin, idAdj))
  ok((await veArchivo(sup, `${optica}/${idAdj}/informe.pdf`)) === 1, "…y sí cuando el administrador la escala (los archivos van con la conversación)")
  x = await intenta(rosa, () => responder(rosa, idAdj, "Adjunto otro", adj(idAdj, "informe.pdf", "carta.docx", "datos.xlsx", "grande.pdf")))
  ok(/hasta 3/.test(x.e || ""), "más de 3 archivos en un mensaje se rechaza: " + x.e)

  // ── 6. Avisos internos
  const publicar = (uid, titulo, cuerpo, para, rol = null, perf = null, vence = null) => comoSigue(uid, async () => (await c.query("select publicar_aviso_interno($1,$2,$3,$4,$5,$6) id", [titulo, cuerpo, para, rol, perf, vence])).rows[0].id)
  x = await intenta(rosa, () => publicar(rosa, "ENSAYO personal", "No debería", "todos"))
  ok(/Solo el administrador/.test(x.e || ""), "el personal no publica avisos: " + x.e)
  x = await intenta(ajena.id, () => publicar(ajena.id, "ENSAYO otra", "x", "rol", rolOptometra))
  ok(/no existe en tu óptica/.test(x.e || ""), "un administrador no avisa a un rol de otra óptica: " + x.e)
  x = await intenta(admin, () => publicar(admin, "ENSAYO persona ajena", "x", "persona", null, ajena.id))
  ok(/no está en tu óptica/.test(x.e || ""), "ni a una persona de otra óptica: " + x.e)
  x = await intenta(admin, () => publicar(admin, "ENSAYO vencido", "x", "todos", null, null, "2020-01-01"))
  ok(/ya pasó/.test(x.e || ""), "no se publica con un vencimiento pasado: " + x.e)
  x = await intenta(admin, () => publicar(admin, "ab", "x", "todos"))
  ok(!!x.e, "el título debe tener al menos 3 letras")
  x = await intenta(admin, () => publicar(admin, "ENSAYO a todos", "Mañana cerramos a las 5.", "todos"))
  const aTodos = x.r
  ok(!x.e && aTodos, "el administrador publica un aviso para todo el personal" + (x.e ? " — " + x.e : ""))
  x = await intenta(admin, () => publicar(admin, "ENSAYO optómetras", "Reunión de optómetras.", "rol", rolOptometra))
  const aOptometras = x.r
  ok(!x.e && aOptometras, "…y otro solo para el rol Optómetra" + (x.e ? " — " + x.e : ""))
  x = await intenta(admin, () => publicar(admin, "ENSAYO a Vera", "Pasa por caja.", "persona", null, vera, "2099-12-31"))
  const aVera = x.r
  ok(!x.e && aVera, "…y otro para una persona, con vencimiento" + (x.e ? " — " + x.e : ""))
  const avisosDe = async (uid) => (await intenta(uid, async () => (await c.query("select titulo from avisos_internos where id = any($1::uuid[]) order by titulo", [[aTodos, aOptometras, aVera]])).rows.map((r) => r.titulo))).r || []
  let a = await avisosDe(paula)
  ok(a.length === 2 && a.includes("ENSAYO a todos") && a.includes("ENSAYO optómetras"), "Paula (Optómetra) ve el de todos y el de su rol")
  a = await avisosDe(rosa)
  ok(a.length === 1 && a[0] === "ENSAYO a todos", "Recepción ve solo el de todos")
  a = await avisosDe(vera)
  ok(a.length === 2 && a.includes("ENSAYO a Vera"), "Vera ve el de todos y el suyo")
  a = await avisosDe(admin)
  ok(a.length === 3, "el administrador ve todos los de su óptica")
  a = await avisosDe(ajena.id)
  ok(a.length === 0, "otra óptica no ve ninguno")
  a = await avisosDe(sup)
  ok(a.length === 0, "el superadmin tampoco (no son suyos)")
  x = await anonimo(() => c.query("select count(*)::int n from avisos_internos"))
  ok(!!x.e, "sin sesión no se lee nada")
  x = await intenta(admin, () => c.query("insert into avisos_internos (optica_id, autor_nombre, titulo, cuerpo, para) values ($1,'x','abc','x','todos')", [optica]))
  ok(/permission denied/.test(x.e || ""), "nadie inserta avisos directamente: " + x.e)

  // Lectura
  const marcar = (uid, ids = null) => comoSigue(uid, () => c.query("select marcar_avisos_internos_leidos($1::uuid[])", [ids]))
  x = await intenta(rosa, () => marcar(rosa, [aOptometras]))
  const leidosDe = async (uid) => (await intenta(uid, async () => (await c.query("select aviso_id from avisos_internos_leidos where aviso_id = any($1::uuid[])", [[aTodos, aOptometras, aVera]])).rows.map((r) => r.aviso_id))).r || []
  ok((await leidosDe(rosa)).length === 0, "Recepción no puede marcar como leído un aviso que no es para ella")
  await intenta(paula, () => marcar(paula, [aTodos, aOptometras]))
  await intenta(vera, () => marcar(vera))
  ok((await leidosDe(paula)).length === 2 && (await leidosDe(vera)).length === 2, "Paula y Vera marcan los suyos")
  ok((await leidosDe(admin)).length === 0, "cada quien ve solo sus propias lecturas")
  const lecturas = async (uid) => (await intenta(uid, async () => (await c.query("select * from lecturas_avisos_internos()")).rows))
  x = await lecturas(rosa)
  ok(/Solo el administrador/.test(x.e || ""), "el personal no ve quién leyó: " + x.e)
  x = await lecturas(admin)
  const filas = x.r || []
  const dos = (id) => filas.filter((f) => f.aviso_id === id)
  ok(dos(aOptometras).length >= 1 && dos(aOptometras).every((f) => f.nombre) && dos(aOptometras).some((f) => f.perfil_id === paula && f.leido_en), "el administrador ve quién leyó el aviso del rol Optómetra (Paula, leído)")
  ok(!dos(aOptometras).some((f) => f.perfil_id === rosa), "…y que Recepción no era destinataria")
  const total = dos(aTodos).length
  const leidos = dos(aTodos).filter((f) => f.leido_en).length
  ok(total >= 3 && leidos === 2 && !dos(aTodos).some((f) => f.perfil_id === admin), `"Leído por ${leidos} de ${total}" en el aviso para todos (sin contar a quien lo publicó)`)
  ok(dos(aVera).length === 1 && dos(aVera)[0].perfil_id === vera, "el aviso para una persona tiene un solo destinatario")
  x = await intenta(ajena.id, () => comoSigue(ajena.id, () => c.query("select count(*)::int n from lecturas_avisos_internos() where aviso_id = $1", [aTodos])))
  ok(x.r?.rows[0].n === 0 || !!x.e, "el administrador de otra óptica no ve lecturas de esta")
  // Vencimiento: un aviso vencido deja de verse para el personal
  await c.query("update avisos_internos set vence_el = '2020-01-01' where id = $1", [aVera])
  a = await avisosDe(vera)
  ok(a.length === 1, "un aviso vencido deja de verlo el personal")
  a = await avisosDe(admin)
  ok(a.length === 3, "…pero el administrador lo sigue viendo")
  // Retirar
  x = await intenta(rosa, () => comoSigue(rosa, () => c.query("select retirar_aviso_interno($1)", [aTodos])))
  ok(/Solo el administrador/.test(x.e || ""), "el personal no retira avisos: " + x.e)
  x = await intenta(ajena.id, () => comoSigue(ajena.id, () => c.query("select retirar_aviso_interno($1)", [aTodos])))
  ok(!!x.e, "otra óptica no retira los de esta: " + x.e)
  x = await intenta(admin, () => comoSigue(admin, () => c.query("select retirar_aviso_interno($1)", [aTodos])))
  ok(!x.e && (await avisosDe(admin)).length === 2, "el administrador retira un aviso" + (x.e ? " — " + x.e : ""))

  // Los avisos internos no dependen del permiso de Soporte
  await c.query("delete from perfil_roles where perfil_id = $1", [paula])
  const rolSinSoporte = (await c.query("insert into roles (optica_id, nombre, permisos, alcance, es_predefinido) values ($1, 'Ensayo 0116 sin soporte', '{\"citas\":[\"ver\"]}'::jsonb, '{}'::jsonb, false) returning id", [optica])).rows[0].id
  await c.query("insert into perfil_roles (perfil_id, rol_id) values ($1, $2)", [paula, rolSinSoporte])
  x = await intenta(admin, () => publicar(admin, "ENSAYO sin permiso", "Para quien no tiene Soporte", "persona", null, paula))
  const aSinPermiso = x.r
  ok(!x.e && aSinPermiso, "el administrador avisa a alguien sin el permiso de Soporte" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, async () => (await c.query("select titulo from avisos_internos where id = $1", [aSinPermiso])).rows.length)
  ok(x.r === 1, "…y esa persona lo ve (los avisos son comunicación de la óptica, no dependen de Soporte)")
  x = await intenta(paula, () => marcar(paula, [aSinPermiso]))
  ok(!x.e, "…y lo marca como leído" + (x.e ? " — " + x.e : ""))
  x = await intenta(paula, async () => (await c.query("select count(*)::int n from soporte_consultas")).rows[0].n)
  ok(x.r === 0, "…sin que eso le abra las consultas de Soporte")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select * from crear_consulta_soporte($1,'citas','problema','normal','abc','x','{}'::jsonb,'[]'::jsonb)", [randomUUID()])))
  ok(/No tienes permiso/.test(x.e || ""), "…ni le deja escribir consultas: " + x.e)
  // Sin verificación en dos pasos: el segundo factor solo se exige a quien ya lo tiene activado (la regla de `mfa_satisfecho`, como el resto del sistema)
  const conFactor = async (uid) => (await c.query("select exists (select 1 from auth.mfa_factors where user_id = $1 and status = 'verified') f", [uid])).rows[0].f
  ok(!(await conFactor(paula)), "(Paula no tiene verificación en dos pasos activada)")
  await c.query("savepoint aal1")
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: paula, role: "authenticated", aal: "aal1" }), paula])
  let lecturaAal1 = null
  try { lecturaAal1 = (await c.query("select (select count(*)::int from avisos_internos where id = $1) vistos", [aSinPermiso])).rows[0]; await c.query("select marcar_avisos_internos_leidos($1::uuid[])", [[aSinPermiso]]) } catch (e) { lecturaAal1 = { e: e.message } }
  await c.query("rollback to savepoint aal1")
  await c.query("reset role")
  ok(lecturaAal1 && !lecturaAal1.e && lecturaAal1.vistos === 1, "una persona sin verificación en dos pasos (sesión aal1) lee y marca sus avisos" + (lecturaAal1?.e ? " — " + lecturaAal1.e : ""))
  x = await lecturas(admin)
  ok((x.r || []).some((f) => f.aviso_id === aSinPermiso && f.perfil_id === paula && f.leido_en), "el administrador ve que lo leyó")

  // ── 7. Los avisos del sistema (superadmin → ópticas) siguen igual
  ok((await sobrecargas("marcar_avisos_leidos")) === 1, "marcar_avisos_leidos (avisos del sistema) no cambió")
  x = await intenta(paula, () => comoSigue(paula, () => c.query("select marcar_avisos_leidos(null)")))
  ok(!x.e, "…y sigue funcionando" + (x.e ? " — " + x.e : ""))
} catch (e) {
  console.error("✘ ERROR:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó (y se revirtió, no queda nada)." : `\n${fallos} comprobaciones fallaron (se revirtió todo).`)
process.exit(fallos === 0 ? 0 : 1)
