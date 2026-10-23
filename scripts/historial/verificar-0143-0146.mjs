// Verificación de 0143–0146 YA APLICADAS, con SESIONES REALES (administrador, optómetra y recepción de la óptica de pruebas) por la API de verdad. Limpia lo que crea (por la conexión directa).
//   node --env-file=.env.local --env-file=.env.test scripts/historial/verificar-0143-0146.mjs
import { createClient } from "@supabase/supabase-js"
import pg from "pg"
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const entrar = async (rol) => {
  const s = nuevo()
  const { data, error } = await s.auth.signInWithPassword({ email: process.env[`E2E_${rol}_EMAIL`], password: process.env[`E2E_${rol}_PASSWORD`] })
  if (error) throw new Error(`No se pudo entrar como ${rol}: ${error.message}`)
  return { s, id: data.user.id }
}
const db = new pg.Client(); await db.connect()
const q = async (t, p) => (await db.query(t, p)).rows
const mas = (iso, d) => { const f = new Date(`${iso}T12:00:00`); f.setDate(f.getDate() + d); return `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}` }
const creadas = []
try {
  const admin = await entrar("ADMIN"); const opt = await entrar("OPTOMETRA"); const rec = await entrar("RECEPCION")
  const optica = (await q("select optica_id from perfiles where id = $1", [admin.id]))[0].optica_id
  const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date::text d"))[0].d
  const lunes = (() => { let d = mas(hoy, 30); while (new Date(`${d}T12:00:00`).getDay() !== 1) d = mas(d, 1); return d })()
  const antes = (await q("select settings from opticas where id = $1", [optica]))[0].settings

  // 0143
  let r = await rec.s.rpc("registrar_conteo_inventario", { p_fecha: hoy })
  const d1 = (await q("select settings from opticas where id = $1", [optica]))[0].settings
  ok(!r.error && d1.ultimoConteo === hoy, "0143: Recepción (Inventario: ver) registra el conteo" + (r.error ? " — " + r.error.message : ""))
  ok(JSON.stringify({ ...d1, ultimoConteo: antes.ultimoConteo }) === JSON.stringify(antes) || antes.ultimoConteo === undefined && JSON.stringify((({ ultimoConteo, ...x }) => x)(d1)) === JSON.stringify(antes), "0143: el resto de la configuración queda igual")
  await db.query("update opticas set settings = $2 where id = $1", [optica, antes])

  // 0144
  r = await admin.s.rpc("guardar_plantilla_crm", { p_motivo: "lentes_listos_envio", p_texto: "Hola, tu pedido ya salió y llega pronto a tu dirección." })
  ok(!r.error, "0144: el administrador guarda la plantilla de envío" + (r.error ? " — " + r.error.message : ""))
  r = await admin.s.rpc("guardar_plantilla_crm", { p_motivo: "lentes_listos_envio", p_texto: "" })
  ok(!r.error, "0144: y la deja otra vez en la de fábrica")

  // 0145
  const { data: fichas, error: eF } = await opt.s.from("consultas").select("id, cita_resumen").limit(5)
  ok(!eF, "0145: la vista de fichas responde con su cita_resumen" + (eF ? " — " + eF.message : ""))
  const alc = await opt.s.rpc("alcance_efectivo", { p_modulo: "consultas" })
  ok(!alc.error && ["todo", "atiende", "propio"].includes(alc.data), "0145: alcance_efectivo responde (" + alc.data + ")")
  const fila = (fichas || []).find((f) => f.cita_resumen)
  ok(!fila || (typeof fila.cita_resumen.estado === "string" && !!fila.cita_resumen.fecha), "0145: la cita de la ficha trae fecha y estado")

  // 0146
  r = await admin.s.rpc("guardar_horario_persona", { p_usuario: opt.id, p_usa_optica: true, p_horario: null })
  ok(!r.error, "0146: el administrador deja a Paula con el horario de la óptica" + (r.error ? " — " + r.error.message : ""))
  r = await rec.s.rpc("guardar_horario_persona", { p_usuario: rec.id, p_usa_optica: true, p_horario: null })
  ok(!!r.error, "0146: Recepción no asigna horarios: " + r.error?.message)
  const w = await rec.s.from("horarios_usuario").update({ usa_horario_optica: true }).eq("usuario_id", rec.id)
  ok(!!w.error, "0146: nadie escribe su horario por la tabla")
  r = await opt.s.rpc("solicitar_ausencia", { p_tipo: "otro", p_desde: lunes, p_hasta: lunes, p_franja: "todo", p_motivo: "Verificación 0146", p_doc_ruta: null, p_doc_nombre: null })
  ok(!r.error && r.data, "0146: Paula solicita una ausencia" + (r.error ? " — " + r.error.message : "")); const aus = r.data; if (aus) creadas.push(aus)
  let l = await opt.s.from("ausencias_personal").select("id").eq("id", aus)
  ok(l.data?.length === 1, "0146: Paula la ve")
  l = await rec.s.from("ausencias_personal").select("id").eq("id", aus)
  ok(!l.error && l.data?.length === 0, "0146: Recepción no la ve")
  l = await admin.s.from("ausencias_personal").select("id").eq("id", aus)
  ok(l.data?.length === 1, "0146: el administrador la ve")
  r = await rec.s.rpc("resolver_ausencia", { p_id: aus, p_aprobar: true })
  ok(!!r.error, "0146: Recepción no la aprueba")
  r = await admin.s.rpc("resolver_ausencia", { p_id: aus, p_aprobar: true })
  ok(!r.error, "0146: el administrador la aprueba" + (r.error ? " — " + r.error.message : ""))
  const ag = await rec.s.rpc("agenda_profesionales", { p_optica_id: optica })
  const pa = (ag.data || []).find((x) => x.id === opt.id)
  ok(!ag.error && !!pa && pa.ausencias.some((a) => a.desde === lunes) && !JSON.stringify(ag.data).includes("Verificación"), "0146: la agenda de profesionales trae la ausencia aprobada, sin motivo")
  const av = await opt.s.from("avisos_internos").select("titulo").like("titulo", "Tu ausencia%")
  ok(!av.error && av.data?.some((a) => a.titulo === "Tu ausencia fue aprobada"), "0146: Paula recibe el aviso de la aprobación")
  r = await admin.s.rpc("retirar_ausencia", { p_id: aus })
  ok(!r.error, "0146: el administrador la retira (el tiempo vuelve a la agenda)")
  const anon = nuevo()
  const pub = await anon.rpc("agenda_profesionales", { p_optica_id: optica })
  ok(!pub.error && Array.isArray(pub.data), "0146: la web (sin sesión) lee la agenda de profesionales")
  const cubo = await opt.s.storage.from("ausencias-documentos").upload(`${optica}/${opt.id}/verificacion-0146.pdf`, new Blob(["%PDF-1.4 verificacion"], { type: "application/pdf" }), { contentType: "application/pdf" })
  ok(!cubo.error, "0146: Paula sube un documento a su carpeta privada" + (cubo.error ? " — " + cubo.error.message : ""))
  const ruta = `${optica}/${opt.id}/verificacion-0146.pdf`
  const urlAdmin = await admin.s.storage.from("ausencias-documentos").createSignedUrl(ruta, 60)
  const urlRec = await rec.s.storage.from("ausencias-documentos").createSignedUrl(ruta, 60)
  ok(!!urlAdmin.data?.signedUrl, "0146: el administrador puede abrir el documento")
  ok(!urlRec.data?.signedUrl, "0146: Recepción NO puede abrir el documento")
  const ajena = await rec.s.storage.from("ausencias-documentos").upload(`${optica}/${opt.id}/ajena.pdf`, new Blob(["x"], { type: "application/pdf" }), { contentType: "application/pdf" })
  ok(!!ajena.error, "0146: nadie sube a la carpeta de otra persona")
  const quitado = await opt.s.storage.from("ausencias-documentos").remove([ruta])
  ok(!quitado.error, "0146: Paula quita su documento de prueba (la limpieza)")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally {
  for (const id of creadas) await db.query("delete from ausencias_personal where id = $1", [id])
  await db.query("delete from avisos_internos where titulo like 'Tu ausencia%' and optica_id = (select optica_id from perfiles where nombre like 'QA Claude%' limit 1)").catch(() => {})
  await db.end()
}
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien: verificado con sesiones reales y limpio.")
process.exit(fallos ? 1 : 0)
