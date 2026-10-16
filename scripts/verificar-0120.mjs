// Verificación con sesiones REALES (por la API) de la migración 0120 ya aplicada: el superadmin no ve los datos de una óptica sin su autorización.
// Para no tocar una óptica real, usa QA Test Claude: se le quita un momento la marca de prueba (como superadmin), se prueba con su administrador
// y su personal, y al final SE RESTAURA la marca. Las credenciales del superadmin se pasan por el entorno (no se guardan):
//   SUPERADMIN_EMAIL=... SUPERADMIN_PASSWORD=... node --env-file=.env.local --env-file=.env.test scripts/verificar-0120.mjs
import { createClient } from "@supabase/supabase-js"

let fallos = 0
const ok = (c, m) => { console.log((c ? "✔ " : "✘ ") + m); if (!c) fallos++ }
const nuevo = () => createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
async function sesion(email, password, nombre) {
  const c = nuevo()
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`No se pudo entrar como ${nombre}: ${error.message}`)
  return c
}
const n = async (c, t, optica) => { const { data, error } = await c.from(t).select("id").eq("optica_id", optica); return error ? -1 : data.length }

const sup = await sesion(process.env.SUPERADMIN_EMAIL, process.env.SUPERADMIN_PASSWORD, "superadmin")
const admin = await sesion(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD, "administrador (pruebas)")
const paula = await sesion(process.env.E2E_OPTOMETRA_EMAIL, process.env.E2E_OPTOMETRA_PASSWORD, "optómetra (pruebas)")
const anon = nuevo()
const { data: qa } = await sup.from("opticas").select("id, es_de_prueba").eq("slug", "v8twzq").single()
const { data: solna } = await sup.from("opticas").select("id, es_de_prueba").eq("slug", "optica-solna").single()
const { data: karla } = await sup.from("opticas").select("es_de_prueba").eq("slug", "karla-vision").single()
ok(karla.es_de_prueba === true, "Optica Karla V es un entorno de prueba")
ok(solna.es_de_prueba === false, "Óptica Solna Vision es la óptica real")

const TABLAS = ["pacientes_base", "citas_base", "consultas_base", "facturas_venta", "inventario", "logs_optica"]
try {
  // 1. Óptica real (Solna): el superadmin no ve nada sin autorización
  for (const t of TABLAS) ok((await n(sup, t, solna.id)) === 0, `sin autorización el superadmin ve 0 filas de ${t} de Óptica Solna Vision`)
  const { error: eEntrar } = await sup.rpc("entrar_como_optica", { p_optica: solna.id, p_motivo: "Verificación" })
  ok(!!eEntrar && /no ha autorizado/i.test(eEntrar.message), `entrar a la óptica real sin autorización se rechaza («${eEntrar?.message?.slice(0, 60)}…»)`)

  // 2. Un entorno de prueba no necesita autorización
  ok((await n(sup, "pacientes_base", qa.id)) >= 0 && qa.es_de_prueba === true, "en un entorno de prueba el superadmin puede ver sin autorización")

  // 3. QA Test Claude como si fuera real
  await sup.from("opticas").update({ es_de_prueba: false }).eq("id", qa.id)
  const base = {}
  for (const t of TABLAS) base[t] = (await admin.from(t).select("id")).data?.length ?? -1
  ok(base.pacientes_base > 0 && base.citas_base > 0, `(el administrador de pruebas ve sus datos: ${JSON.stringify(base)})`)
  for (const t of TABLAS) ok((await n(sup, t, qa.id)) === 0, `como óptica real, sin autorización el superadmin ve 0 filas de ${t}`)
  const { error: e1 } = await sup.rpc("entrar_como_optica", { p_optica: qa.id, p_motivo: "Revisar un error" })
  ok(!!e1, "y no puede entrar")
  const { error: eSup } = await sup.rpc("permitir_acceso_soporte", { p_horas: 24 })
  ok(!!eSup, "el superadmin no puede darse el permiso")
  const { error: ePaula } = await paula.rpc("permitir_acceso_soporte", { p_horas: 24 })
  ok(!!ePaula, "el personal de la óptica tampoco")
  ok(!!(await anon.rpc("permitir_acceso_soporte", { p_horas: 24 })).error, "sin sesión tampoco")
  ok(!!(await admin.rpc("permitir_acceso_soporte", { p_horas: 1000 })).error, "no se permite un acceso sin vencimiento")
  const { error: ePerm } = await admin.rpc("permitir_acceso_soporte", { p_horas: 1 })
  ok(!ePerm, "el administrador permite el acceso por 1 hora")
  const { data: mi } = await admin.rpc("mi_acceso_soporte")
  ok(mi.activo === true, "el administrador ve que el permiso está activo")
  for (const t of TABLAS) ok((await n(sup, t, qa.id)) === 0, `con permiso pero sin entrar, 0 filas de ${t}`)
  ok(!!(await sup.rpc("entrar_como_optica", { p_optica: qa.id, p_motivo: "  " })).error, "entrar exige el motivo")
  const { error: eEnt } = await sup.rpc("entrar_como_optica", { p_optica: qa.id, p_motivo: "Verificación de la 0120" })
  ok(!eEnt, "con permiso y motivo, entra")
  for (const t of TABLAS.filter((x) => base[x] > 0)) ok((await n(sup, t, qa.id)) >= base[t], `ya dentro ve ${t}`)
  const { data: avisos } = await admin.from("mensajes").select("asunto, cuerpo").like("asunto", "El soporte del sistema entró%").order("created_at", { ascending: false }).limit(1)
  ok(avisos?.length === 1 && /Verificación de la 0120/.test(avisos[0].cuerpo), `el administrador recibe el aviso con el motivo («${avisos?.[0]?.cuerpo}»)`)
  const { data: logs } = await admin.from("logs_optica").select("accion, detalle").eq("accion", "Entró como administrador").order("created_at", { ascending: false }).limit(1)
  ok(logs?.[0]?.detalle === "Verificación de la 0120", "la entrada queda en la actividad de la óptica, con el motivo")
  const { data: hist } = await admin.rpc("mi_acceso_soporte")
  ok(hist.entradas?.[0]?.motivo === "Verificación de la 0120", "el administrador ve quién entró y por qué")
  // archivos de las fichas (bucket privado): sin entrada, la lista de la carpeta de la óptica sale vacía
  await sup.rpc("salir_de_optica", { p_optica: qa.id })
  for (const t of TABLAS) ok((await n(sup, t, qa.id)) === 0, `al salir vuelve a ver 0 filas de ${t}`)
  await sup.rpc("entrar_como_optica", { p_optica: qa.id, p_motivo: "Segunda verificación" })
  const { error: eRev } = await admin.rpc("revocar_acceso_soporte")
  ok(!eRev && (await n(sup, "pacientes_base", qa.id)) === 0, "al revocar el administrador, el acceso se corta al instante")
  ok(!!(await sup.rpc("entrar_como_optica", { p_optica: qa.id, p_motivo: "Tercera verificación" })).error, "y no se puede volver a entrar")
  // el superadmin no escribe en las tablas de autorización
  ok(!!(await sup.from("entradas_soporte").insert({ optica_id: qa.id, superadmin_id: (await sup.auth.getUser()).data.user.id, superadmin_nombre: "x", vence_en: new Date(Date.now() + 3600e3).toISOString() })).error, "el superadmin no puede inventarse una entrada")
  ok(!!(await admin.from("accesos_soporte").insert({ optica_id: qa.id, vence_vence: 1 })).error, "ni el administrador escribe directo en los permisos")
  // el panel ya no recibe volúmenes
  const { data: d } = await sup.rpc("datos_negocio_superadmin")
  const claves = new Set(d.opticas.flatMap((o) => Object.keys(o)))
  ok(!["citas", "consultas", "ventas", "pacientes", "asistentes"].some((k) => claves.has(k)), `datos_negocio_superadmin no entrega volúmenes (${[...claves].join(", ")})`)
} finally {
  await admin.rpc("revocar_acceso_soporte")
  await sup.from("opticas").update({ es_de_prueba: true }).eq("id", qa.id)
  const { data: fin } = await sup.from("opticas").select("es_de_prueba").eq("id", qa.id).single()
  ok(fin.es_de_prueba === true, "QA Test Claude quedó otra vez como entorno de prueba")
}
console.log(fallos === 0 ? "\nVerificación completa: todo pasó." : `\n${fallos} fallo(s).`)
process.exit(fallos === 0 ? 0 : 1)
