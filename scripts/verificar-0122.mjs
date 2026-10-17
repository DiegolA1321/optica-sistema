// Verificación con sesiones REALES (por la API) de la migración 0122 ya aplicada («Ofrecer ayuda» como conversación de Soporte y el límite de 2000 caracteres).
// Escribe SOLO en la óptica de pruebas (QA Test Claude) y al final la deja limpia. La Óptica Demo se usa solo para comprobar que otra óptica no ve nada.
// Las credenciales del superadmin se pasan por el entorno (no se guardan):
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0122.mjs
import { createClient } from "@supabase/supabase-js"
import { limpiarAyudasDePruebas } from "../e2e/limpiar-ayuda.js"
import { limpiarSoporteDePruebas } from "../e2e/limpiar-soporte.js"

let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(email, password, nombre) {
  const c = nuevo()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo entrar como ${nombre}: ${error.message}`)
  return c
}
const de = (n) => "x".repeat(n)

await limpiarAyudasDePruebas()
await limpiarSoporteDePruebas()
const sup = await sesion(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin")
const admin = await sesion(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD, "administrador (pruebas)")
const personal = await sesion(process.env.E2E_OPTOMETRA_EMAIL, process.env.E2E_OPTOMETRA_PASSWORD, "optómetra (pruebas)")
const otra = await sesion(process.env.DEMO_ADMIN_EMAIL, process.env.DEMO_ADMIN_PASSWORD, "administrador de otra óptica (Demo)")
const anon = nuevo()
const { data: qa } = await sup.from("opticas").select("id, es_de_prueba").eq("slug", "v8twzq").single()
ok(qa.es_de_prueba === true, "se escribe solo en un entorno de prueba (QA Test Claude)")
const MENSAJE = "Vimos que en los últimos 30 días no usaron Ventas. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí."

try {
  // 1. Solo el superadmin ofrece ayuda
  for (const [nombre, c] of [["el administrador de una óptica", admin], ["el personal", personal], ["el administrador de otra óptica", otra], ["sin sesión", anon]]) {
    ok(!!(await c.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "ventas", p_mensaje: MENSAJE })).error, `${nombre} NO puede ofrecer ayuda`)
  }
  ok(/Módulo desconocido/.test((await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "inventado", p_mensaje: "Hola" })).error?.message || ""), "un módulo desconocido se rechaza")

  // 2. Ofrecer ayuda crea la consulta «iniciada por el soporte»
  const { data: o, error: eo } = await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "ventas", p_mensaje: MENSAJE })
  ok(!eo && o?.[0]?.numero > 0, `ofrecer ayuda crea la consulta SOP-${String(o?.[0]?.numero).padStart(4, "0")} (${eo?.message || "ok"})`)
  const id = o[0].id
  const { data: k } = await sup.from("soporte_consultas").select("*").eq("id", id).single()
  ok(k.iniciada_por === "soporte" && k.ayuda_modulo === "ventas" && k.tipo === "ayuda" && k.estado === "respondida" && k.respuesta_sin_leer === true, "queda «iniciada por el soporte», con el módulo como dato, «Respondida» y sin leer")
  ok(!/http|localhost/i.test(k.descripcion) && k.asunto === "Ayuda con Ventas", "el mensaje no lleva direcciones y el asunto lo dice")

  // 3. Quién la ve y la campanita
  ok(((await admin.from("soporte_consultas").select("id").eq("id", id)).data || []).length === 1, "el administrador de esa óptica la ve")
  ok(((await personal.from("soporte_consultas").select("id").eq("id", id)).data || []).length === 0, "el personal no la ve")
  ok(((await otra.from("soporte_consultas").select("id").eq("id", id)).data || []).length === 0, "el administrador de otra óptica no la ve")
  const { data: campanita } = await admin.from("soporte_consultas").select("id, ayuda_modulo").eq("iniciada_por", "soporte").eq("respuesta_sin_leer", true).neq("estado", "resuelta")
  ok(campanita.some((x) => x.id === id), "le llega a la campanita del administrador")
  ok(!(await personal.rpc("marcar_consulta_soporte_leida", { p_consulta: id })).error && (await sup.from("soporte_consultas").select("respuesta_sin_leer").eq("id", id).single()).data.respuesta_sin_leer === true, "el personal no puede marcarla como leída")
  await admin.rpc("marcar_consulta_soporte_leida", { p_consulta: id })
  ok((await sup.from("soporte_consultas").select("respuesta_sin_leer").eq("id", id).single()).data.respuesta_sin_leer === false, "al abrirla, el administrador baja la campanita")

  // 4. Responder en la misma conversación
  ok(!(await admin.rpc("responder_consulta_soporte", { p_consulta: id, p_cuerpo: "E2E gracias, la miramos hoy." })).error, "el administrador responde en la misma conversación")
  ok(((await sup.from("soporte_mensajes").select("id").eq("consulta_id", id)).data || []).length === 2, "la conversación tiene el mensaje del soporte y la respuesta")

  // 5. No se repite hasta 30 días después; con otro módulo sí
  const rep = await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "ventas", p_mensaje: "Otra vez" })
  ok(/Ya se ofreció ayuda con este módulo el \d\d\/\d\d\/\d{4}\. Podrás volver a ofrecerla el \d\d\/\d\d\/\d{4}/.test(rep.error?.message || ""), "repetir la oferta del mismo módulo se rechaza con su fecha")
  const { data: o2, error: e2 } = await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "inventario", p_mensaje: "Hola con Inventario" })
  ok(!e2 && o2?.[0]?.numero > 0, "con otro módulo (Inventario) sí se puede")

  // 6. «No usamos este módulo» (en Inventario)
  ok(!!(await personal.rpc("no_usamos_modulo", { p_consulta: o2[0].id })).error, "el personal no puede marcar «no usamos este módulo»")
  ok(!!(await otra.rpc("no_usamos_modulo", { p_consulta: o2[0].id })).error, "el administrador de otra óptica no puede")
  ok(!!(await sup.rpc("no_usamos_modulo", { p_consulta: o2[0].id })).error, "el superadmin tampoco decide por la óptica")
  ok(!(await admin.rpc("no_usamos_modulo", { p_consulta: o2[0].id })).error, "el administrador marca «no usamos este módulo»")
  ok((await sup.from("soporte_consultas").select("estado").eq("id", o2[0].id).single()).data.estado === "resuelta", "la consulta queda resuelta")
  const { data: marcados } = await admin.from("modulos_no_usados").select("modulo")
  ok(marcados.some((m) => m.modulo === "inventario"), "el administrador ve el módulo que marcó")
  ok(((await otra.from("modulos_no_usados").select("modulo")).data || []).every((m) => m.modulo !== "inventario") && ((await personal.from("modulos_no_usados").select("modulo")).data || []).length === 0, "ni otra óptica ni el personal ven esa decisión")
  ok(/no usa este módulo/.test((await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "inventario", p_mensaje: "Hola" })).error?.message || ""), "el soporte ya no puede ofrecerle ayuda con ese módulo")
  ok(!!(await personal.rpc("volver_a_usar_modulo", { p_modulo: "inventario" })).error, "el personal no puede deshacerla")
  ok(!(await admin.rpc("volver_a_usar_modulo", { p_modulo: "inventario" })).error && ((await admin.from("modulos_no_usados").select("modulo")).data || []).length === 0, "el administrador la deshace")
  ok(/Ya se ofreció/.test((await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "inventario", p_mensaje: "Hola" })).error?.message || ""), "deshacerla no salta el límite de 30 días")

  // 7. Las tablas nuevas no se escriben desde la aplicación; el tipo «ayuda» es solo del soporte
  ok(!!(await sup.from("ayudas_ofrecidas").insert({ optica_id: qa.id, modulo: "citas" })).error, "nadie escribe en ayudas_ofrecidas (ni el superadmin)")
  ok(!!(await admin.from("modulos_no_usados").insert({ optica_id: qa.id, modulo: "citas" })).error, "nadie escribe en modulos_no_usados (ni el administrador)")
  ok(((await admin.from("ayudas_ofrecidas").select("id")).data || []).length === 0, "el administrador no lee el registro de ayudas ofrecidas")
  ok(!!(await admin.rpc("crear_consulta_soporte", { p_id: crypto.randomUUID(), p_modulo: "otro", p_tipo: "ayuda", p_urgencia: "normal", p_asunto: "E2E tipo ayuda", p_descripcion: "x" })).error, "una óptica no puede escribir una consulta de tipo «ayuda»")

  // 8. El mismo límite de 2000 caracteres, validado en el servidor
  const largo = /máximo 2000 caracteres/
  const nueva = (cuerpo) => admin.rpc("crear_consulta_soporte", { p_id: crypto.randomUUID(), p_modulo: "otro", p_tipo: "problema", p_urgencia: "normal", p_asunto: "E2E límite", p_descripcion: cuerpo })
  ok(largo.test((await nueva(de(2001))).error?.message || ""), "una consulta de más de 2000 caracteres se rechaza")
  const { data: c2000, error: e2000 } = await nueva(de(2000))
  ok(!e2000 && c2000?.[0]?.numero > 0, "una consulta de exactamente 2000 caracteres pasa")
  ok(largo.test((await admin.rpc("responder_consulta_soporte", { p_consulta: c2000[0].id, p_cuerpo: de(2001) })).error?.message || ""), "una respuesta de la óptica de más de 2000 se rechaza")
  ok(largo.test((await sup.rpc("soporte_responder", { p_consulta: c2000[0].id, p_cuerpo: de(2001) })).error?.message || ""), "una respuesta del soporte de más de 2000 se rechaza")
  ok(largo.test((await sup.rpc("ofrecer_ayuda", { p_optica: qa.id, p_modulo: "reportes", p_mensaje: de(2001) })).error?.message || ""), "ofrecer ayuda con más de 2000 se rechaza")
  ok(largo.test((await admin.rpc("publicar_aviso_interno", { p_titulo: "E2E aviso largo", p_cuerpo: de(2001), p_para: "todos" })).error?.message || ""), "un aviso del administrador de más de 2000 se rechaza")
  ok(largo.test((await sup.from("mensajes").insert({ tipo: "anuncio", optica_id: qa.id, remitente_nombre: "Soporte", asunto: "E2E aviso", cuerpo: de(2001), estado: "resuelto" })).error?.message || ""), "un aviso del superadmin de más de 2000 se rechaza")
  ok(!!(await anon.rpc("crear_consulta_soporte", { p_id: crypto.randomUUID(), p_modulo: "otro", p_tipo: "problema", p_urgencia: "normal", p_asunto: "E2E", p_descripcion: "x" })).error, "sin sesión no se escribe nada")
} finally {
  await limpiarAyudasDePruebas()
  await limpiarSoporteDePruebas()
}
console.log(fallos === 0 ? "\nTodo pasó." : `\n${fallos} comprobación(es) fallaron.`)
process.exit(fallos === 0 ? 0 : 1)
