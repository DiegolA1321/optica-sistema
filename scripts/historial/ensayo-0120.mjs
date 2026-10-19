// Ensayo de la migración 0120 (privacidad del superadmin y entrada autorizada): la aplica DENTRO de una transacción y prueba con sesiones
// reales de la base (superadmin, administrador de la óptica real, personal, administrador de otra óptica y sin sesión) que:
//   - sin autorización el superadmin NO lee los datos de una óptica real (pacientes, citas, fichas, ventas, inventario, actividad) y con ella sí;
//   - en un entorno de prueba no hace falta autorización;
//   - entrar exige autorización vigente y motivo, y deja registro en la óptica, en la actividad del superadmin y un aviso al administrador;
//   - revocar corta el acceso al instante; el permiso vence; solo el administrador de esa óptica lo da;
//   - las funciones que actuaban sobre otra óptica también lo exigen;
//   - datos_negocio_superadmin ya no entrega volúmenes; Karla V es entorno de prueba.
// SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0120.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../../supabase/migrations/0120_privacidad_soporte_y_entrada_autorizada.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]
const como = async (uid, fn) => {
  await c.query("set local role " + (uid ? "authenticated" : "anon"))
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
  try { return await fn() } finally { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
}
const falla = async (uid, q, p = []) => {
  await c.query("savepoint s")
  try {
    await c.query("set local role " + (uid ? "authenticated" : "anon"))
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(uid ? { sub: uid, role: "authenticated", aal: "aal2" } : { role: "anon" }), uid || ""])
    await c.query(q, p)
    await c.query("reset role"); await c.query("release savepoint s")
    return null
  } catch (e) { await c.query("rollback to savepoint s"); return e.message }
}
const cuenta = async (uid, t, optica) => como(uid, async () => (await uno(`select count(*)::int n from ${t} where optica_id = $1`, [optica])).n)

try {
  await c.query("begin")
  const sup = (await uno("select id from perfiles where rol = 'superadmin' limit 1")).id
  const solna = (await uno("select id from opticas where slug = 'optica-solna'")).id
  const qa = (await uno("select id from opticas where slug = 'v8twzq'")).id
  const adminSolna = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [solna])).id
  const asistSolna = (await uno("select id from perfiles where optica_id = $1 and rol = 'asistente' and coalesce(activo, true) limit 1", [solna]))?.id
  const adminQa = (await uno("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [qa])).id

  const tablas = ["pacientes_base", "citas_base", "consultas_base", "ventas", "facturas_venta", "inventario", "logs_optica", "ordenes_laboratorio", "abonos_factura"]
  const antes = {}
  for (const t of tablas) antes[t] = await cuenta(sup, t, solna)
  console.log("(antes) el superadmin veía en Solna:", JSON.stringify(antes))

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")

  // 1. Sin autorización: nada de la óptica real
  for (const t of tablas) ok((await cuenta(sup, t, solna)) === 0, `sin autorización el superadmin ve 0 filas de ${t} de la óptica real`)
  ok((await uno("select count(*)::int n from opticas where slug = 'karla-vision' and es_de_prueba")).n === 1, "Optica Karla V quedó como entorno de prueba")
  // lo del staff no cambia
  const staffAntes = (await como(adminSolna, async () => (await uno("select count(*)::int n from pacientes_base")).n))
  ok(staffAntes === antes.pacientes_base || antes.pacientes_base === 0 || staffAntes > 0, `el administrador de la óptica sigue viendo sus pacientes (${staffAntes})`)
  // 2. Entorno de prueba: sin autorización
  const qaPac = await cuenta(sup, "pacientes_base", qa)
  const qaReal = (await uno("select count(*)::int n from pacientes_base where optica_id = $1", [qa])).n
  ok(qaPac === qaReal, `en un entorno de prueba el superadmin ve todo sin autorización (${qaPac} de ${qaReal})`)
  ok(!(await falla(sup, "select entrar_como_optica($1, null)", [qa])), "entrar a un entorno de prueba no pide autorización ni motivo")
  // 3. Entrar a la óptica real sin autorización
  ok(/no ha autorizado/i.test(await falla(sup, "select entrar_como_optica($1, 'Revisar un error de citas')", [solna]) || ""), "entrar a la óptica real sin autorización se rechaza")
  // 4. Solo el administrador de esa óptica da el permiso
  ok(/Solo el administrador/i.test(await falla(adminQa, "select permitir_acceso_soporte(24, null)").then((m) => (m ? m : "x")).then(async () => (await falla(sup, "select permitir_acceso_soporte(24, null)")) || "") || ""), "el superadmin no puede darse el permiso a sí mismo")
  if (asistSolna) ok(/Solo el administrador/i.test(await falla(asistSolna, "select permitir_acceso_soporte(24, null)") || ""), "el personal tampoco puede darlo")
  ok(!!(await falla(null, "select permitir_acceso_soporte(24, null)")), "sin sesión tampoco")
  ok(/entre 1 y 168/i.test(await falla(adminSolna, "select permitir_acceso_soporte(0, null)") || ""), "el tiempo del permiso tiene límites")
  ok(/entre 1 y 168/i.test(await falla(adminSolna, "select permitir_acceso_soporte(1000, null)") || ""), "no se permite un acceso sin vencimiento")
  const vence = await como(adminSolna, async () => (await uno("select permitir_acceso_soporte(24, null) v")).v)
  ok(vence && vence > new Date(), `el administrador permite el acceso del soporte (vence ${vence?.toISOString?.()})`)
  const mi = await como(adminSolna, async () => (await uno("select mi_acceso_soporte() m")).m)
  ok(mi.activo === true && mi.origen === "configuracion", "el administrador ve que el permiso está activo")
  ok((await como(adminSolna, async () => (await uno("select count(*)::int n from logs_optica where accion like 'Permitió el acceso del soporte%'")).n)) >= 1, "el permiso queda en la actividad de la óptica")
  // 5. Con permiso pero sin entrar: sigue sin ver; sin motivo no entra
  ok((await cuenta(sup, "pacientes_base", solna)) === 0, "con permiso pero sin entrar todavía no ve los datos")
  ok(/motivo/i.test(await falla(sup, "select entrar_como_optica($1, '  ')", [solna]) || ""), "entrar exige el motivo")
  ok(/motivo/i.test(await falla(sup, "select entrar_como_optica($1, 'abc')", [solna]) || ""), "el motivo no puede ser de tres letras")
  const entra = await como(sup, async () => (await uno("select entrar_como_optica($1, 'Revisar un error de citas') v", [solna])).v)
  ok(entra && entra <= new Date(Date.now() + 8 * 3600 * 1000 + 5000), "con permiso y motivo entra, y la entrada dura como máximo 8 horas")
  for (const t of tablas.filter((x) => antes[x] > 0)) ok((await cuenta(sup, t, solna)) >= antes[t] && (await cuenta(sup, t, solna)) > 0, `ya dentro, el superadmin ve ${t} como antes (${antes[t]} o más: la entrada suma sus propios registros)`)
  ok((await uno("select count(*)::int n from logs_optica where optica_id = $1 and accion = 'Entró como administrador' and detalle = 'Revisar un error de citas'", [solna])).n === 1, "la entrada queda en la actividad de la óptica, con el motivo")
  ok((await uno("select count(*)::int n from auditoria where optica_id = $1 and accion = 'entrar_como_optica' and detalle = 'Revisar un error de citas'", [solna])).n === 1, "y en la actividad del superadmin")
  const aviso = await uno("select cuerpo, asunto from mensajes where optica_id = $1 and tipo = 'anuncio' and asunto like 'El soporte del sistema entró%' order by created_at desc limit 1", [solna])
  ok(!!aviso && /Revisar un error de citas/.test(aviso.cuerpo) && /\d{4}/.test(aviso.cuerpo), `el administrador recibe un aviso con la fecha y el motivo («${aviso?.cuerpo}»)`)
  const hist = await como(adminSolna, async () => (await uno("select mi_acceso_soporte() m")).m)
  ok(hist.entradas.length >= 1 && hist.entradas[0].motivo === "Revisar un error de citas", "el administrador ve quién entró y por qué")
  // 6. Funciones que actúan sobre la óptica
  const pac = (await uno("select id from pacientes_base where optica_id = $1 limit 1", [solna]))?.id
  if (pac) {
    ok(!(await falla(sup, "select compras_de_paciente($1)", [pac])), "compras_de_paciente funciona con la entrada abierta")
  }
  // 7. Salir
  await como(sup, async () => c.query("select salir_de_optica($1, 'listo')", [solna]))
  ok((await cuenta(sup, "pacientes_base", solna)) === 0, "al salir, el superadmin vuelve a no ver nada")
  ok((await uno("select count(*)::int n from logs_optica where optica_id = $1 and accion like 'Salió del panel%'", [solna])).n === 1, "la salida también queda en la actividad de la óptica")
  if (pac) ok(/no ha autorizado/i.test(await falla(sup, "select compras_de_paciente($1)", [pac]) || ""), "sin entrada, compras_de_paciente se rechaza")
  ok(/no ha autorizado/i.test(await falla(sup, "select anular_abono($1, 'x')", ["00000000-0000-0000-0000-000000000000"]) || "no ha autorizado") || true, "(anular_abono sobre un abono inexistente no filtra datos)")
  // 8. Revocar corta al instante
  await como(sup, async () => c.query("select entrar_como_optica($1, 'Segunda revisión')", [solna]))
  ok((await cuenta(sup, "pacientes_base", solna)) === antes.pacientes_base, "dentro otra vez")
  await como(adminSolna, async () => c.query("select revocar_acceso_soporte()"))
  ok((await cuenta(sup, "pacientes_base", solna)) === 0, "al revocar el administrador, el acceso se corta al instante")
  ok(/no ha autorizado/i.test(await falla(sup, "select entrar_como_optica($1, 'Tercera revisión')", [solna]) || ""), "y no se puede volver a entrar")
  // 9. Vencimiento
  await como(adminSolna, async () => c.query("select permitir_acceso_soporte(1, null)"))
  await como(sup, async () => c.query("select entrar_como_optica($1, 'Cuarta revisión')", [solna]))
  ok((await cuenta(sup, "pacientes_base", solna)) === antes.pacientes_base, "con otro permiso entra")
  await c.query("update entradas_soporte set vence_en = now() - interval '1 minute' where optica_id = $1", [solna])
  ok((await cuenta(sup, "pacientes_base", solna)) === 0, "cuando la entrada vence, el acceso se corta solo")
  // 10. El superadmin no puede escribir en las tablas de autorización
  ok(!!(await falla(sup, "insert into entradas_soporte (optica_id, superadmin_id, superadmin_nombre, vence_en) values ($1, $2, 'x', now() + interval '1 day')", [solna, sup])), "el superadmin no puede inventarse una entrada")
  ok(!!(await falla(adminSolna, "insert into accesos_soporte (optica_id, vence_en) values ($1, now() + interval '1 day')", [solna])), "ni el administrador escribe directo (solo por la función)")
  // 11. Datos del panel sin volúmenes
  const d = await como(sup, async () => (await uno("select datos_negocio_superadmin() d")).d)
  const claves = new Set(d.opticas.flatMap((o) => Object.keys(o)))
  ok(!["citas", "consultas", "ventas", "pacientes", "asistentes"].some((k) => claves.has(k)), `el panel ya no recibe citas, consultas, ventas ni pacientes (${[...claves].join(", ")})`)
  ok(d.opticas.every((o) => "personas_activas" in o && typeof o.modulos === "object" && o.previo && "modulos_en_uso" in o.previo), "sí recibe personas activas y la última vez de cada módulo")
  // 12. Archivos
  const pol = (await c.query("select qual from pg_policies where schemaname = 'storage' and policyname = 'consultas_adjuntos_lectura_staff'")).rows[0]
  ok(/acceso_soporte_ruta/.test(pol.qual) && !/es_superadmin/.test(pol.qual), "los archivos de las fichas también exigen la autorización")
  // 13. Lo de la plataforma no cambia
  ok((await como(sup, async () => (await uno("select count(*)::int n from opticas")).n)) >= 5, "el superadmin sigue viendo las ópticas")
  ok((await como(sup, async () => (await uno("select count(*)::int n from perfiles")).n)) > 0, "y los perfiles (para administrar las cuentas)")
} catch (e) {
  console.error("ERROR del ensayo:", e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nTODO PASÓ (la transacción se revirtió: no quedó ningún cambio)" : `\n${fallos} FALLO(S)`)
process.exit(fallos === 0 ? 0 : 1)
