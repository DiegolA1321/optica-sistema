// Verificación de la migración 0115 YA APLICADA, con sesiones reales a través de la API (lo que ve el navegador): el administrador de la óptica de pruebas, el de la Demo
// (otra óptica), Recepción y Optómetra de la óptica de pruebas, el superadmin y sin sesión. Escribe solo en la óptica de pruebas (la limpia la próxima corrida de Playwright).
//
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0115.mjs
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
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64")

const admin = await de("E2E", "ADMIN")
const demo = await de("DEMO", "ADMIN")
const recepcion = await de("E2E", "RECEPCION")
const optometra = await de("E2E", "OPTOMETRA")
const sup = process.env.SUPERADMIN_EMAIL ? await sesion(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin") : null
const anon = nuevo()
if (!sup) console.log("(sin SUPERADMIN_EMAIL: se omiten las comprobaciones del superadmin)")

const crear = (s, id, extra = {}) => s.c.rpc("crear_consulta_soporte", { p_id: id, p_modulo: "ventas", p_tipo: "problema", p_urgencia: "urgente", p_asunto: "E2E verificar 0115", p_descripcion: "Prueba de verificación", p_contexto: { pantalla: "Ventas" }, p_adjuntos: [], ...extra })

// 1. El administrador crea una consulta con una captura (API de almacenamiento y función)
const id = randomUUID()
const ruta = `${admin.optica}/${id}/captura.png`
let r = await admin.c.storage.from("soporte-adjuntos").upload(ruta, PNG, { contentType: "image/png" })
ok(!r.error, "el administrador sube una captura a la carpeta de su óptica" + (r.error ? " — " + r.error.message : ""))
r = await crear(admin, id, { p_adjuntos: [{ ruta, nombre: "captura.png" }] })
const fila = Array.isArray(r.data) ? r.data[0] : r.data
ok(!r.error && fila?.numero > 0, `crea la consulta y recibe su número (SOP-${String(fila?.numero || 0).padStart(4, "0")})` + (r.error ? " — " + r.error.message : ""))

// 2. Quién la ve
const ve = async (s) => (await s.c.from("soporte_consultas").select("id").eq("id", id)).data?.length || 0
ok((await ve(admin)) === 1, "el administrador de la óptica la ve")
ok((await ve(demo)) === 0, "el administrador de OTRA óptica (Demo) no la ve")
ok((await ve(recepcion)) === 0 && (await ve(optometra)) === 0, "el resto del personal (Recepción, Optómetra) no ve la consulta de otra persona")
r = await anon.from("soporte_consultas").select("id").limit(1)
ok(!!r.error || (r.data || []).length === 0, "sin sesión no se lee nada")
if (sup) ok((await ve(sup)) === 1, "el superadmin la ve")

// 3. Las capturas
r = await admin.c.storage.from("soporte-adjuntos").createSignedUrl(ruta, 60)
ok(!r.error && r.data?.signedUrl, "el autor puede abrir su captura")
r = await demo.c.storage.from("soporte-adjuntos").createSignedUrl(ruta, 60)
ok(!!r.error || !r.data?.signedUrl, "otra óptica NO puede abrir la captura")
r = await demo.c.storage.from("soporte-adjuntos").upload(`${admin.optica}/${randomUUID()}/x.png`, PNG, { contentType: "image/png" })
ok(!!r.error, "otra óptica NO puede subir a la carpeta de esta")
r = await admin.c.storage.from("soporte-adjuntos").upload(`${admin.optica}/${randomUUID()}/x.txt`, Buffer.from("hola"), { contentType: "text/plain" })
ok(!!r.error, "no se admite un archivo que no es imagen")
r = await anon.storage.from("soporte-adjuntos").createSignedUrl(ruta, 60)
ok(!!r.error || !r.data?.signedUrl, "sin sesión no se abre ninguna captura")
r = await admin.c.storage.from("soporte-adjuntos").remove([ruta])
ok(!(r.data || []).length, "nadie borra una captura (no hay política de borrado)")

// 4. Escribir directo en las tablas está cerrado
r = await admin.c.from("soporte_consultas").update({ estado: "resuelta", calificacion: 5 }).eq("id", id)
ok(!!r.error, "no se puede cambiar el estado ni la calificación por la tabla: " + (r.error?.message || "sin error"))
r = await admin.c.from("soporte_mensajes").insert({ consulta_id: id, optica_id: admin.optica, autor_nombre: "x", de: "soporte", cuerpo: "x" })
ok(!!r.error, "no se puede escribir la conversación por la tabla")

// 5. Conversación, notas internas y respuestas guardadas (con el superadmin)
if (sup) {
  r = await sup.c.rpc("soporte_responder", { p_consulta: id, p_cuerpo: "E2E nota interna de verificación", p_interna: true, p_estado: null, p_adjuntos: [] })
  ok(!r.error, "el superadmin deja una nota interna" + (r.error ? " — " + r.error.message : ""))
  r = await sup.c.rpc("soporte_responder", { p_consulta: id, p_cuerpo: "E2E respuesta de verificación", p_interna: false, p_estado: null, p_adjuntos: [] })
  ok(!r.error, "el superadmin responde")
  const textos = async (s) => ((await s.c.from("soporte_mensajes").select("cuerpo, interna").eq("consulta_id", id)).data || [])
  ok((await textos(sup)).some((m) => m.interna), "el superadmin ve la nota interna")
  const delAdmin = await textos(admin)
  ok(delAdmin.some((m) => m.cuerpo === "E2E respuesta de verificación") && !delAdmin.some((m) => m.interna || /nota interna/.test(m.cuerpo)), "el administrador ve la respuesta pero NO la nota interna")
  r = await admin.c.rpc("soporte_responder", { p_consulta: id, p_cuerpo: "Intento", p_interna: false, p_estado: null, p_adjuntos: [] })
  ok(!!r.error, "el administrador de la óptica no puede responder como soporte: " + (r.error?.message || ""))
  const estado = (await admin.c.from("soporte_consultas").select("estado, respuesta_sin_leer, primera_respuesta_en").eq("id", id).single()).data
  ok(estado.estado === "respondida" && estado.respuesta_sin_leer && estado.primera_respuesta_en, "queda 'Respondida', con la respuesta sin leer para la campanita")
  r = await admin.c.rpc("marcar_consulta_soporte_leida", { p_consulta: id })
  ok(!r.error && (await admin.c.from("soporte_consultas").select("respuesta_sin_leer").eq("id", id).single()).data.respuesta_sin_leer === false, "al abrirla, la campanita baja")
  r = await demo.c.rpc("responder_consulta_soporte", { p_consulta: id, p_cuerpo: "Intruso", p_adjuntos: [] })
  ok(!!r.error, "otra óptica no puede escribir en la conversación: " + (r.error?.message || ""))
  r = await sup.c.rpc("soporte_cambiar_estado", { p_consulta: id, p_estado: "resuelta" })
  ok(!r.error, "el superadmin la resuelve")
  r = await admin.c.rpc("calificar_consulta_soporte", { p_consulta: id, p_nota: 5, p_comentario: "E2E verificación" })
  ok(!r.error, "la óptica la califica" + (r.error ? " — " + r.error.message : ""))
  r = await admin.c.rpc("reabrir_consulta_soporte", { p_consulta: id, p_motivo: "E2E sigue igual" })
  ok(!r.error, "la óptica la reabre")
  r = await admin.c.from("soporte_respuestas_guardadas").select("id").limit(1)
  ok(!(r.data || []).length, "la óptica no lee las respuestas guardadas")
  const g = await sup.c.from("soporte_respuestas_guardadas").insert({ titulo: "E2E guardada", texto: "Texto de verificación" }).select("id").single()
  ok(!g.error, "el superadmin crea una respuesta guardada")
  if (g.data?.id) await sup.c.from("soporte_respuestas_guardadas").delete().eq("id", g.data.id)
}

// 6. Avisos: lo publicado sigue funcionando y el "leído" es de cada persona
r = await admin.c.from("mensajes").select("id, tipo").eq("tipo", "anuncio").limit(5)
ok(!r.error, "la lectura de avisos por `mensajes` (la versión publicada) sigue funcionando")
r = await admin.c.rpc("marcar_avisos_leidos", { p_mensajes: null })
ok(!r.error, "marcar avisos como leídos funciona")
r = await demo.c.from("avisos_leidos").select("mensaje_id").eq("perfil_id", admin.id)
ok(!(r.data || []).length, "la lectura de un aviso no se ve desde otra cuenta")

// 7. La versión publicada: escribir en `mensajes` sigue funcionando y llega a las tablas nuevas
const asuntoPublicado = "E2E verificar 0115 publicado " + Math.random().toString(36).slice(2, 6)
r = await admin.c.from("mensajes").insert({ tipo: "consulta", optica_id: admin.optica, remitente_id: admin.id, remitente_nombre: admin.nombre, asunto: asuntoPublicado, cuerpo: "Desde la versión publicada" }).select().single()
ok(!r.error, "la versión publicada sigue pudiendo escribir una consulta en `mensajes`" + (r.error ? " — " + r.error.message : ""))
r = await admin.c.from("soporte_consultas").select("numero, estado").eq("asunto", asuntoPublicado)
ok(r.data?.length === 1 && r.data[0].estado === "recibida", "…y aparece sola en Soporte nuevo")

// 8. Los roles de una óptica nueva
r = await admin.c.rpc("permisos_efectivos")
ok(!r.error, "los permisos efectivos siguen respondiendo")

console.log(fallos === 0 ? "\nTODO BIEN: la migración 0115 pasa la verificación con sesiones reales." : `\n${fallos} COMPROBACIÓN(ES) FALLARON.`)
process.exit(fallos ? 1 : 0)
