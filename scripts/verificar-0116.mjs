// Verificación de la migración 0116 YA APLICADA, con sesiones reales a través de la API (lo que ve el navegador): el administrador, Recepción, Optómetra y Ventas de la
// óptica de pruebas, el administrador de la Demo (otra óptica), el superadmin y sin sesión. Escribe solo en la óptica de pruebas ("E2E ..."; los limpia
// e2e/limpiar-soporte.js al empezar o terminar la próxima corrida de Playwright).
//
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0116.mjs
import { createClient } from "@supabase/supabase-js"
import { randomUUID } from "node:crypto"

let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(correo, clave, etiqueta) {
  const c = nuevo()
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error(`No se pudo iniciar sesión (${etiqueta}): ${error.message}`)
  const { data: perfil } = await c.from("perfiles").select("optica_id, nombre, rol").eq("id", data.user.id).single()
  return { c, id: data.user.id, optica: perfil?.optica_id, nombre: perfil?.nombre, rol: perfil?.rol }
}
const de = (entorno, rol) => sesion(process.env[`${entorno}_${rol}_EMAIL`], process.env[`${entorno}_${rol}_PASSWORD`], `${entorno} ${rol}`)
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n")
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const admin = await de("E2E", "ADMIN")
const demo = await de("DEMO", "ADMIN")
const recepcion = await de("E2E", "RECEPCION")
const optometra = await de("E2E", "OPTOMETRA")
const ventas = await de("E2E", "VENTAS")
const sup = process.env.SUPERADMIN_EMAIL ? await sesion(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin") : null
const anon = nuevo()
if (!sup) console.log("(sin SUPERADMIN_EMAIL: se omiten las comprobaciones del superadmin)")

const bucket = (s) => s.c.storage.from("soporte-adjuntos")
const crear = (s, id, extra = {}) => s.c.rpc("crear_consulta_soporte", { p_id: id, p_modulo: "ventas", p_tipo: "problema", p_urgencia: "normal", p_asunto: "E2E verificar 0116", p_descripcion: "Prueba de verificación", p_contexto: { pantalla: "Ventas" }, p_adjuntos: [], ...extra })
const ve = async (s, id) => (await s.c.from("soporte_consultas").select("id, destino, estado").eq("id", id)).data?.[0] || null

// ── 1. Recepción escribe con un PDF: va a su administrador
const id = randomUUID()
const ruta = `${recepcion.optica}/${id}/informe.pdf`
let r = await bucket(recepcion).upload(ruta, PDF, { contentType: "application/pdf" })
ok(!r.error, "Recepción sube un PDF a la carpeta de su óptica" + (r.error ? " — " + r.error.message : ""))
r = await bucket(recepcion).upload(`${recepcion.optica}/${randomUUID()}/macro.xlsm`, Buffer.from("x"), { contentType: "application/vnd.ms-excel.sheet.macroEnabled.12" })
ok(!!r.error, "el servidor rechaza un .xlsm (con macros)")
r = await bucket(recepcion).upload(`${recepcion.optica}/${randomUUID()}/programa.exe`, Buffer.from("x"), { contentType: "application/octet-stream" })
ok(!!r.error, "…y un .exe")
r = await bucket(recepcion).upload(`${recepcion.optica}/${randomUUID()}/disfrazado.xlsx`, Buffer.from("x"), { contentType: "application/zip" })
ok(!!r.error, "…y un .xlsx que dice ser otro tipo")
r = await bucket(recepcion).upload(`${recepcion.optica}/${randomUUID()}/carta.docx`, Buffer.from("x"), { contentType: DOCX })
ok(!r.error, "…pero acepta un .docx")
r = await bucket(demo).upload(`${recepcion.optica}/${randomUUID()}/x.pdf`, PDF, { contentType: "application/pdf" })
ok(!!r.error, "otra óptica NO puede subir a la carpeta de esta")
r = await crear(recepcion, id, { p_adjuntos: [{ ruta, nombre: "informe.pdf" }] })
const fila = Array.isArray(r.data) ? r.data[0] : r.data
ok(!r.error && fila?.numero > 0, `Recepción crea la consulta (SOP-${String(fila?.numero || 0).padStart(4, "0")})` + (r.error ? " — " + r.error.message : ""))
ok((await ve(recepcion, id))?.destino === "admin", "…y va a su administrador (destino 'admin')")
const idAdmin = randomUUID()
r = await crear(admin, idAdmin)
ok((await ve(admin, idAdmin))?.destino === "superadmin", "la consulta del administrador va al soporte del sistema")

// ── 2. Quién la ve
ok(!!(await ve(admin, id)), "el administrador de la óptica la ve")
ok(!(await ve(demo, id)), "el administrador de OTRA óptica (Demo) no la ve")
ok(!(await ve(optometra, id)) && !(await ve(ventas, id)), "el resto del personal (Optómetra, Ventas) no ve la consulta de su compañera")
r = await anon.from("soporte_consultas").select("id").limit(1)
ok(!!r.error || (r.data || []).length === 0, "sin sesión no se lee nada")
if (sup) {
  ok(!(await ve(sup, id)), "el superadmin NO la ve mientras no se escale")
  ok(!!(await ve(sup, idAdmin)), "…pero sí la del administrador")
  r = await sup.c.rpc("soporte_responder", { p_consulta: id, p_cuerpo: "Intento", p_interna: false, p_estado: null, p_adjuntos: [] })
  ok(!!r.error, "el superadmin no puede responder lo que no le llegó: " + (r.error?.message || ""))
}

// ── 3. El PDF: quién lo baja
r = await bucket(recepcion).createSignedUrl(ruta, 60)
ok(!r.error && r.data?.signedUrl, "quien escribió baja su PDF")
r = await bucket(admin).createSignedUrl(ruta, 60)
ok(!r.error && r.data?.signedUrl, "el administrador de su óptica también")
r = await bucket(optometra).createSignedUrl(ruta, 60)
ok(!!r.error || !r.data?.signedUrl, "una compañera NO")
r = await bucket(demo).createSignedUrl(ruta, 60)
ok(!!r.error || !r.data?.signedUrl, "otra óptica NO")
r = await bucket({ c: anon }).createSignedUrl(ruta, 60)
ok(!!r.error || !r.data?.signedUrl, "sin sesión NO")
if (sup) {
  r = await bucket(sup).createSignedUrl(ruta, 60)
  ok(!!r.error || !r.data?.signedUrl, "el superadmin NO, mientras no se escale")
}

// ── 4. El administrador responde y escala; el personal no puede
r = await admin.c.rpc("responder_consulta_soporte", { p_consulta: id, p_cuerpo: "E2E Prueba de nuevo y me cuentas.", p_adjuntos: [] })
ok(!r.error, "el administrador responde a Recepción" + (r.error ? " — " + r.error.message : ""))
const estado = (await recepcion.c.from("soporte_consultas").select("estado, respuesta_sin_leer").eq("id", id)).data?.[0]
ok(estado?.estado === "respondida" && estado?.respuesta_sin_leer === true, "Recepción la ve 'Respondida' con respuesta sin leer (campanita)")
r = await optometra.c.rpc("responder_consulta_soporte", { p_consulta: id, p_cuerpo: "Me meto", p_adjuntos: [] })
ok(!!r.error, "una compañera no puede escribir en la consulta de otra")
r = await recepcion.c.rpc("escalar_consulta_soporte", { p_consulta: id, p_nota: null })
ok(!!r.error, "Recepción no puede escalar: " + (r.error?.message || ""))
r = await demo.c.rpc("escalar_consulta_soporte", { p_consulta: id, p_nota: null })
ok(!!r.error, "el administrador de otra óptica no puede escalarla")
r = await admin.c.rpc("escalar_consulta_soporte", { p_consulta: id, p_nota: "E2E no logro reproducirlo" })
ok(!r.error, "el administrador la escala" + (r.error ? " — " + r.error.message : ""))
r = await admin.c.rpc("escalar_consulta_soporte", { p_consulta: id, p_nota: null })
ok(!!r.error, "no se puede escalar dos veces")

// ── 5. El superadmin la recibe completa y responde
if (sup) {
  ok((await ve(sup, id))?.destino === "superadmin", "el superadmin ya la ve")
  const msgs = (await sup.c.from("soporte_mensajes").select("cuerpo, de, adjuntos").eq("consulta_id", id)).data || []
  ok(msgs.length === 4 && msgs.some((m) => m.de === "admin") && msgs.some((m) => (m.adjuntos || []).length === 1), "…con toda la conversación y el PDF adjunto")
  r = await bucket(sup).createSignedUrl(ruta, 60)
  ok(!r.error && r.data?.signedUrl, "…y puede bajar el PDF")
  r = await sup.c.rpc("soporte_responder", { p_consulta: id, p_cuerpo: "E2E respuesta del soporte", p_interna: false, p_estado: null, p_adjuntos: [] })
  ok(!r.error, "el superadmin responde")
  const alFinal = (await recepcion.c.from("soporte_consultas").select("estado, respuesta_sin_leer").eq("id", id)).data?.[0]
  const mensajesRecepcion = (await recepcion.c.from("soporte_mensajes").select("cuerpo").eq("consulta_id", id)).data || []
  ok(alFinal?.respuesta_sin_leer === true && mensajesRecepcion.some((m) => m.cuerpo === "E2E respuesta del soporte"), "Recepción ve la respuesta del superadmin")
}

// ── 6. Avisos internos
const rolOptometra = (await admin.c.from("roles").select("id").eq("clave", "optometra").eq("optica_id", admin.optica).single()).data?.id
const titulo = "E2E verificar 0116 aviso"
r = await recepcion.c.rpc("publicar_aviso_interno", { p_titulo: titulo, p_cuerpo: "x", p_para: "todos" })
ok(!!r.error, "el personal no publica avisos: " + (r.error?.message || ""))
r = await admin.c.rpc("publicar_aviso_interno", { p_titulo: titulo, p_cuerpo: "Reunión de optómetras", p_para: "rol", p_rol: rolOptometra })
const idAviso = r.data
ok(!r.error && idAviso, "el administrador publica un aviso para el rol Optómetra" + (r.error ? " — " + r.error.message : ""))
const veAviso = async (s) => ((await s.c.from("avisos_internos").select("id").eq("id", idAviso)).data || []).length
ok((await veAviso(optometra)) === 1 && (await veAviso(admin)) === 1, "el Optómetra y el administrador lo ven")
ok((await veAviso(recepcion)) === 0 && (await veAviso(ventas)) === 0, "Recepción y Ventas no (no son destinatarias)")
ok((await veAviso(demo)) === 0, "otra óptica no")
r = await anon.from("avisos_internos").select("id").limit(1)
ok(!!r.error || (r.data || []).length === 0, "sin sesión no se lee nada")
r = await admin.c.from("avisos_internos").insert({ optica_id: admin.optica, autor_nombre: "x", titulo: "E2E x", cuerpo: "x", para: "todos" })
ok(!!r.error, "nadie inserta avisos por la tabla")
r = await recepcion.c.rpc("marcar_avisos_internos_leidos", { p_avisos: [idAviso] })
const leidoPorRecepcion = ((await recepcion.c.from("avisos_internos_leidos").select("aviso_id").eq("aviso_id", idAviso)).data || []).length
ok(!r.error && leidoPorRecepcion === 0, "Recepción no puede marcar como leído un aviso que no es para ella")
r = await optometra.c.rpc("marcar_avisos_internos_leidos", { p_avisos: [idAviso] })
ok(!r.error, "el Optómetra lo marca como leído")
r = await optometra.c.rpc("lecturas_avisos_internos")
ok(!!r.error, "el personal no ve quién leyó")
r = await admin.c.rpc("lecturas_avisos_internos")
const lecturas = (r.data || []).filter((x) => x.aviso_id === idAviso)
ok(!r.error && lecturas.length >= 1 && lecturas.some((x) => x.perfil_id === optometra.id && x.leido_en) && !lecturas.some((x) => x.perfil_id === recepcion.id), "el administrador ve que el Optómetra lo leyó (y que Recepción no era destinataria)")
r = await demo.c.rpc("retirar_aviso_interno", { p_aviso: idAviso })
ok(!!r.error, "otra óptica no retira avisos de esta")
r = await admin.c.rpc("retirar_aviso_interno", { p_aviso: idAviso })
ok(!r.error, "el administrador retira su aviso")

// ── 7. Lo publicado sigue
r = await optometra.c.rpc("marcar_avisos_leidos", { p_mensajes: null })
ok(!r.error, "los avisos del sistema (marcar_avisos_leidos) siguen funcionando" + (r.error ? " — " + r.error.message : ""))

console.log(fallos === 0 ? "\nVerificación completa: todo pasó." : `\n${fallos} comprobaciones fallaron.`)
process.exit(fallos === 0 ? 0 : 1)
