// Ensayo de la migración 0100 (asignado_original + reasignar_cita): la aplica DENTRO de una transacción, repite lo que hace el
// front PUBLICADO (select * de la vista, insert y update con columnas explícitas) y prueba la función con distintos usuarios.
// SIEMPRE revierte (rollback): no deja ningún cambio en la base.
//
//   node --env-file=.env.local scripts/ensayo-0100.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0100_asignado_original.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }

const como = async (uid, fn) => {
  await c.query("savepoint s")
  try {
    await c.query("set local role authenticated")
    await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
    return await fn()
  } finally {
    await c.query("rollback to savepoint s")
    await c.query("reset role")
  }
}
const intenta = async (uid, fn) => { try { return { r: await como(uid, fn) } } catch (e) { return { e: e.message } } }

try {
  await c.query("begin")
  const optica = (await c.query("select id from opticas where slug = 'v8twzq'")).rows[0]?.id
  if (!optica) throw new Error("No se encontró la óptica de pruebas v8twzq")
  const perfiles = (await c.query("select id, rol, nombre, es_optometra, coalesce(activo, true) activo from perfiles where optica_id = $1 order by created_at", [optica])).rows
  console.log("Perfiles de la óptica de pruebas:", perfiles.map((p) => `${p.nombre}(${p.rol}${p.es_optometra ? ",opt" : ""}${p.activo ? "" : ",inactivo"})`).join(", "))
  const admin = perfiles.find((p) => p.rol === "admin")
  const otros = perfiles.filter((p) => p.id !== admin.id && p.activo)
  if (!admin || otros.length < 1) throw new Error("Hace falta un admin y otra persona activa")
  const [a, b] = [admin, otros[0]]
  const ajena = (await c.query("select id from perfiles where optica_id <> $1 limit 1", [optica])).rows[0]?.id

  // ── Antes de aplicar: el front publicado (sin la columna nueva)
  const trgAntes = (await c.query("select count(*)::int n from pg_trigger where tgrelid='public.citas'::regclass and not tgisinternal")).rows[0].n
  await c.query(sql)
  ok(true, "La migración se aplica sin errores")

  const insertViejo = `insert into citas (optica_id, paciente, fecha, hora, motivo, estado, asignado_a)
                       values ($1, 'ENSAYO 0100', '2099-01-01', '10:00 AM', 'Examen', 'Pendiente', $2) returning *`
  const cid = (await c.query(insertViejo, [optica, a.id])).rows[0]
  ok(cid && cid.asignado_original === null, "insert del front viejo: asignado_original queda null")
  ok(Object.keys(cid).length === 25, "la vista tiene 25 columnas (24 de antes + asignado_original)")

  // update del front viejo (solo el motivo) conserva todo
  await c.query("update citas set motivo = 'Cambio' where id = $1", [cid.id])
  let f = (await c.query("select * from citas where id = $1", [cid.id])).rows[0]
  ok(f.motivo === "Cambio" && f.asignado_a === a.id && f.asignado_original === null, "update del front viejo: conserva asignado_a y asignado_original")

  // ── reasignar_cita
  const reas = (uid, nuevo) => c.query("select * from reasignar_cita($1, $2)", [cid.id, nuevo])
  let r = await intenta(admin.id, async () => (await reas(admin.id, b.id)).rows[0])
  ok(r.r && r.r.nuevo_asignado === b.id && r.r.nuevo_original === a.id, "el administrador reasigna: asignado=B, original=A")
  r = await intenta(admin.id, async () => { await reas(admin.id, b.id); await reas(admin.id, a.id); return (await c.query("select asignado_a, asignado_original from citas where id=$1", [cid.id])).rows[0] })
  ok(r.r && r.r.asignado_a === a.id && r.r.asignado_original === a.id, "reasignar y devolver (Deshacer): asignado=A, original=A (ya no figura reasignada)")
  r = await intenta(admin.id, async () => { await reas(admin.id, b.id); return (await c.query("select count(*)::int n from logs_optica where accion='Reasignó una cita'")).rows[0].n })
  ok(r.r === 1, "deja una fila en la actividad")
  r = await intenta(admin.id, async () => (await reas(admin.id, null)).rows[0])
  ok(r.r && r.r.nuevo_asignado === null, "se puede dejar sin asignar")
  r = await intenta(admin.id, async () => (await reas(admin.id, ajena)).rows[0])
  ok(!!r.e, "no acepta a alguien de otra óptica: " + r.e)
  r = await intenta(ajena, async () => (await reas(ajena, b.id)).rows[0])
  ok(!!r.e, "otra óptica no puede reasignar: " + r.e)
  r = await intenta(admin.id, async () => { await c.query("update citas set estado='Atendida' where id=$1", [cid.id]); return (await reas(admin.id, b.id)).rows[0] })
  ok(!!r.e && /pendiente o en espera/.test(r.e), "no reasigna una cita Atendida: " + r.e)
  r = await intenta(admin.id, async () => { await c.query("update citas set estado='En Espera' where id=$1", [cid.id]); return (await reas(admin.id, b.id)).rows[0] })
  ok(r.r && r.r.nuevo_asignado === b.id, "sí reasigna una cita En Espera")

  // alguien sin permiso / con alcance propio: se prueba con quien tenga rol distinto de admin
  const noAdmin = otros.find((p) => p.rol !== "admin")
  if (noAdmin) {
    const rr = await intenta(noAdmin.id, async () => {
      const t = (await c.query("select tiene_permiso('citas','editar') ed, alcance_efectivo('citas') al")).rows[0]
      let err = null
      try { await reas(noAdmin.id, a.id) } catch (e) { err = e.message }
      return { ...t, err }
    })
    console.log(`  (${noAdmin.nombre}: editar=${rr.r?.ed}, alcance=${rr.r?.al}, resultado de reasignar: ${rr.r?.err || "permitido"})`)
    const esperaPermiso = rr.r?.ed && rr.r?.al === "todo"
    ok(esperaPermiso ? !rr.r.err : !!rr.r?.err, "quien no tiene editar+todo es rechazado; quien sí lo tiene puede (por permiso, no por rol)")
  }

  // anon no puede ejecutarla
  const anon = (await c.query("select has_function_privilege('anon','public.reasignar_cita(uuid,uuid)','execute') a, has_function_privilege('authenticated','public.reasignar_cita(uuid,uuid)','execute') u")).rows[0]
  ok(!anon.a && anon.u, "anon no puede ejecutarla; authenticated sí")

  // la vista conserva sus opciones y no quedó ningún objeto dependiente roto
  const op = (await c.query("select reloptions from pg_class where oid='public.citas'::regclass")).rows[0].reloptions
  ok(op?.includes("security_invoker=true"), "la vista sigue con security_invoker=true")
  const trg = (await c.query("select count(*)::int n from pg_trigger where tgrelid='public.citas'::regclass and not tgisinternal")).rows[0].n
  ok(trg === trgAntes, `la vista conserva sus triggers instead of (antes ${trgAntes}, ahora ${trg})`)
  const g = (await c.query("select has_table_privilege('authenticated','public.citas','select') s, has_table_privilege('authenticated','public.citas','insert') i, has_table_privilege('authenticated','public.citas','update') u")).rows[0]
  ok(g.s && g.i && g.u, "authenticated conserva select/insert/update en la vista")

  // funciones del sistema que leen la vista siguen corriendo (cron de recordatorios, no asistió)
  for (const f of ["marcar_no_asistio_automatico()"]) {
    try { await c.query("savepoint x"); await c.query(`select ${f.replace("()", "")}()`); ok(true, `${f} se ejecuta`); await c.query("rollback to savepoint x") }
    catch (e) { await c.query("rollback to savepoint x"); ok(false, `${f} falló: ${e.message}`) }
  }
} catch (e) {
  fallos++
  console.error("✘ Error en el ensayo:", e.message)
} finally {
  await c.query("rollback")
  await c.end()
  console.log(fallos ? `\n${fallos} problema(s). Nada se aplicó (rollback).` : "\nTodo bien. Nada se aplicó (rollback).")
  process.exit(fallos ? 1 : 0)
}
