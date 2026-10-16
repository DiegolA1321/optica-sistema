// Verificación de la migración 0114 YA APLICADA, con sesiones reales a través de la API (lo que ve el navegador): el administrador de la óptica de pruebas,
// el de la Demo (otra óptica), los otros roles de la óptica de pruebas y sin sesión. Escribe solo en la óptica de pruebas (la limpia la próxima corrida de Playwright).
//
//   node --env-file=.env.local --env-file=.env.test scripts/verificar-0114.mjs
import { createClient } from "@supabase/supabase-js"

let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(prefijo, entorno) {
  const c = nuevo()
  const { data, error } = await c.auth.signInWithPassword({ email: process.env[`${entorno}_${prefijo}_EMAIL`], password: process.env[`${entorno}_${prefijo}_PASSWORD`] })
  if (error) throw new Error(`No se pudo iniciar sesión (${entorno} ${prefijo}): ${error.message}`)
  const { data: perfil } = await c.from("perfiles").select("optica_id, nombre").eq("id", data.user.id).single()
  return { c, id: data.user.id, optica: perfil.optica_id, nombre: perfil.nombre }
}
const cedula = () => { const d = [0, 9, Math.floor(Math.random() * 6)]; while (d.length < 9) d.push(Math.floor(Math.random() * 10)); const s = d.reduce((a, x, i) => { const v = x * (i % 2 === 0 ? 2 : 1); return a + (v > 9 ? v - 9 : v) }, 0); d.push((10 - (s % 10)) % 10); return d.join("") }

const admin = await sesion("ADMIN", "E2E")
const demo = await sesion("ADMIN", "DEMO")
const nombre = "E Dos E Verificar " + Math.random().toString(36).slice(2, 6)

// 1. Los permisos y el historial desde la API
let r = await admin.c.from("pacientes").insert({ optica_id: admin.optica, nombre, cedula: cedula(), telefono: "0991112233", correo: "Sin Correo", fecha_nacimiento: "1990-05-15", evolucion: "Sin evaluación", ultima_consulta: "Pendiente", fecha_registro: "2026-03-01", estado_clinico: "Activo", acepta_recordatorios: true, acepta_promociones: false }).select().single()
ok(!r.error && r.data.acepta_recordatorios === true && r.data.acepta_promociones === false, "crear un paciente con sus permisos (recordatorios sí, promociones y saludos no)" + (r.error ? " — " + r.error.message : ""))
const pac = r.data?.id
r = await admin.c.from("consentimientos_historial").select("permiso, valor, origen, cambiado_por_nombre").eq("paciente_id", pac)
ok(r.data?.length === 2 && r.data.every((h) => h.origen === "personal" && h.cambiado_por_nombre === admin.nombre), "…y su registro inicial queda en el historial, con quién lo registró")
r = await admin.c.from("pacientes").select("id, acepta_recordatorios, acepta_promociones, consentimiento_actualizado_por").limit(3)
ok(!r.error && r.data.length > 0 && r.data.every((p) => typeof p.acepta_recordatorios === "boolean"), "la lista de pacientes trae los permisos de todos")

// 2. Cada motivo pide su permiso
const contactar = (c, motivo, extra = {}) => c.rpc("registrar_contacto_crm", { p_paciente_id: pac, p_motivo: motivo, p_canal: "whatsapp", p_mensaje: "Hola", p_campana_id: null, p_resultado: null, p_volver_el: null, ...extra })
r = await contactar(admin.c, "cumpleanos")
ok(/no aceptó recibir promociones y saludos/.test(r.error?.message || ""), "el cumpleaños no se ofrece sin 'Promociones y saludos': " + r.error?.message)
r = await contactar(admin.c, "control_vencido")
ok(!r.error && r.data, "el control vencido sí (Recordatorios de salud)" + (r.error ? " — " + r.error.message : ""))
const contacto = r.data
r = await admin.c.rpc("cambiar_consentimiento_paciente", { p_paciente_id: pac, p_recordatorios: null, p_promociones: true, p_origen: "personal" })
ok(!r.error && r.data.acepta_promociones === true, "activar 'Promociones y saludos' desde el perfil")
r = await contactar(admin.c, "cumpleanos")
ok(!r.error && r.data, "…y entonces sí se le escribe por su cumpleaños")
const hoy = new Date(Date.now() - 5 * 3600e3); hoy.setUTCDate(hoy.getUTCDate() + 3)
const en3 = hoy.toISOString().slice(0, 10)
r = await admin.c.rpc("registrar_resultado_contacto_crm", { p_contacto_id: contacto, p_resultado: "volver_a_contactar", p_volver_el: en3 })
ok(!r.error, "anotar 'volver a contactar en 3 días'" + (r.error ? " — " + r.error.message : ""))
r = await admin.c.from("crm_contactos").select("resultado, volver_el, creado_por_nombre").eq("id", contacto).single()
ok(r.data?.resultado === "volver_a_contactar" && r.data.volver_el === en3 && r.data.creado_por_nombre === admin.nombre, "…se lee por la API con su fecha y quién lo hizo")
r = await admin.c.from("crm_contactos").update({ mensaje: "cambiado" }).eq("id", contacto)
ok(!!r.error, "el contacto no se edita desde la API: " + r.error?.message)
r = await admin.c.from("crm_contactos").delete().eq("id", contacto)
ok(!!r.error, "…ni se borra: " + r.error?.message)
r = await admin.c.rpc("crear_campana_crm", { p_nombre: "E2E verificación", p_grupo: "cumpleanos_mes", p_mensaje: "Hola {nombre}, te saludamos de {optica}." })
ok(!r.error && r.data, "crear una campaña")
r = await admin.c.rpc("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "¡Feliz cumple, {nombre}! De {optica}." })
ok(!r.error, "guardar una plantilla")
r = await admin.c.from("crm_plantillas").select("motivo, texto")
ok(r.data?.some((p) => p.motivo === "cumpleanos"), "…y se lee")
await admin.c.rpc("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "" })

// 3. Otra óptica
r = await demo.c.from("crm_contactos").select("id").eq("paciente_id", pac)
ok(!r.error && r.data.length === 0, "el administrador de la Demo no ve los contactos de la óptica de pruebas")
r = await demo.c.from("consentimientos_historial").select("id").eq("paciente_id", pac)
ok(!r.error && r.data.length === 0, "…ni el historial de sus permisos")
r = await demo.c.rpc("registrar_contacto_crm", { p_paciente_id: pac, p_motivo: "control_vencido", p_canal: "whatsapp", p_mensaje: null, p_campana_id: null, p_resultado: null, p_volver_el: null })
ok(/no existe/.test(r.error?.message || ""), "…ni registra un contacto de un paciente ajeno: " + r.error?.message)
r = await demo.c.rpc("cambiar_consentimiento_paciente", { p_paciente_id: pac, p_recordatorios: false, p_promociones: false, p_origen: "personal" })
ok(/no existe/.test(r.error?.message || ""), "…ni cambia sus permisos: " + r.error?.message)

// 4. Sin sesión
const anon = nuevo()
r = await anon.from("crm_contactos").select("id").limit(1)
ok(!!r.error || (r.data || []).length === 0, "sin sesión no se lee ningún contacto")
r = await anon.rpc("registrar_contacto_crm", { p_paciente_id: pac, p_motivo: "control_vencido", p_canal: "whatsapp", p_mensaje: null, p_campana_id: null, p_resultado: null, p_volver_el: null })
ok(!!r.error, "sin sesión no se registra nada: " + r.error?.message)
r = await anon.rpc("mis_permisos_mensajes", { p_paciente_id: pac, p_token: "inventado" })
ok(r.data?.ok === false && r.data.error === "sesion", "el portal: con un token inventado no entrega los permisos")
r = await anon.rpc("actualizar_consentimiento_paciente", { p_paciente_id: pac, p_token: "inventado", p_recordatorios: false, p_promociones: false })
ok(r.data?.ok === false && r.data.error === "sesion", "…ni los cambia")
r = await anon.rpc("registrar_permisos_cita_publica", { p_cita_id: "00000000-0000-0000-0000-000000000000", p_recordatorios: true, p_promociones: true })
ok(r.data === false, "la reserva web: una cita inexistente no cambia nada")
r = await admin.c.from("pacientes").select("acepta_recordatorios, acepta_promociones").eq("id", pac).single()
ok(r.data?.acepta_recordatorios === true && r.data.acepta_promociones === true, "los permisos del paciente siguen como los dejó el personal")

// 5. Los otros roles de la óptica de pruebas (lo que pueden hacer según su rol)
for (const rol of ["OPTOMETRA", "RECEPCION", "VENTAS"]) {
  try {
    const s = await sesion(rol, "E2E")
    const lee = await s.c.from("crm_contactos").select("id").limit(1)
    const escribe = await contactar(s.c, "control_vencido")
    console.log(`  · ${rol} (${s.nombre}): lee el CRM ${lee.error ? "no" : "sí"}; registrar un contacto ${escribe.error ? "→ " + escribe.error.message : "→ permitido"}`)
  } catch (e) { console.log(`  · ${rol}: ${e.message}`) }
}

console.log(fallos === 0 ? "\nTODO BIEN con sesiones reales." : `\n${fallos} COMPROBACIÓN(ES) FALLARON.`)
process.exit(fallos ? 1 : 0)
