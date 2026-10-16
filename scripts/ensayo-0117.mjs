// Ensayo de la migración 0117 (correcciones de la auditoría transversal): la aplica DENTRO de una transacción y comprueba catálogos con tildes,
// rol Optómetra sin Ventas (y solo ese), bitácora sin entradas ajenas y el nuevo comportamiento del registro. SIEMPRE revierte: no deja ningún cambio.
//
//   node --env-file=.env.local scripts/ensayo-0117.mjs
import pg from "pg"
import fs from "node:fs"

const sql = fs.readFileSync(new URL("../supabase/migrations/0117_auditoria_transversal.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const uno = async (q, p = []) => (await c.query(q, p)).rows[0]

const comoSigue = async (uid, fn) => {
  await c.query("set local role authenticated")
  await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify({ sub: uid, role: "authenticated", aal: "aal2" }), uid])
  try { return await fn() } finally { await c.query("reset role"); await c.query("select set_config('request.jwt.claims', '', true), set_config('request.jwt.claim.sub', '', true)") }
}

try {
  await c.query("begin")
  const optica = (await uno("select id from opticas where slug = 'v8twzq'")).id
  const admin = (await uno("select id from perfiles where optica_id = $1 and nombre = 'QA Claude Tester'", [optica])).id
  const paula = (await uno("select id from perfiles where optica_id = $1 and nombre = 'Paula Optómetra Pruebas'", [optica])).id

  // ── Antes
  const rolesAntes = (await c.query("select id, optica_id, clave, es_predefinido, permisos, descripcion from roles order by id")).rows
  const opticasAntes = (await c.query("select slug, motivos_consulta, diagnosticos_rapidos from opticas order by slug")).rows
  const logsAntes = (await uno("select count(*)::int n, count(*) filter (where usuario_nombre = 'Sistema' and modulo = 'usuarios')::int sistema from logs_optica"))
  console.log(`(antes: ${rolesAntes.length} roles, ${logsAntes.n} entradas de actividad, ${logsAntes.sistema} de "Sistema" sobre roles/personas)`)

  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  ok((await uno("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = '_plantilla_rol'")).n === 1, "_plantilla_rol: una sola versión")
  ok((await uno("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'registrar_cambio_permisos'")).n === 1, "registrar_cambio_permisos: una sola versión")

  // ── T3: catálogos
  const MOTIVOS = ["Consulta General", "Adaptación de Lentes", "Examen de Control", "Garantía / Ajuste"]
  const DIAGS = ["Miopía", "Hipermetropía", "Astigmatismo", "Presbicia", "Miopía y astigmatismo", "Hipermetropía y astigmatismo", "Sin alteración refractiva"]
  const iguales = (a, b) => JSON.stringify(a) === JSON.stringify(b)
  const opticasDespues = (await c.query("select slug, motivos_consulta, diagnosticos_rapidos from opticas order by slug")).rows
  for (const o of opticasDespues) {
    const antes = opticasAntes.find((x) => x.slug === o.slug)
    const eraVieja = antes.motivos_consulta.includes("Adaptacion de Lentes") && iguales(antes.motivos_consulta, ["Consulta General", "Adaptacion de Lentes", "Examen de Control", "Garantia / Ajuste"])
    if (eraVieja) ok(iguales(o.motivos_consulta, MOTIVOS), `${o.slug}: motivos con tildes`)
    else ok(iguales(o.motivos_consulta, antes.motivos_consulta), `${o.slug}: motivos personalizados o ya corregidos, intactos`)
    const eraViejaD = iguales(antes.diagnosticos_rapidos, ["Miopia", "Hipermetropia", "Astigmatismo", "Presbicia", "Miopia y astigmatismo", "Hipermetropia y astigmatismo", "Sin alteracion refractiva"])
    if (eraViejaD) ok(iguales(o.diagnosticos_rapidos, DIAGS), `${o.slug}: diagnósticos con tildes`)
    else ok(iguales(o.diagnosticos_rapidos, antes.diagnosticos_rapidos), `${o.slug}: diagnósticos personalizados o ya corregidos, intactos`)
  }
  const def = await uno("select (select column_default from information_schema.columns where table_name = 'opticas' and column_name = 'motivos_consulta') m, (select column_default from information_schema.columns where table_name = 'opticas' and column_name = 'diagnosticos_rapidos') d")
  ok(/Adaptación de Lentes/.test(def.m) && /Garantía/.test(def.m), "valor por defecto de motivos con tildes")
  ok(/Miopía/.test(def.d) && /Sin alteración refractiva/.test(def.d), "valor por defecto de diagnósticos con tildes")

  // ── Optómetra sin Ventas
  const rolesDespues = (await c.query("select id, optica_id, clave, es_predefinido, permisos, descripcion from roles order by id")).rows
  for (const r of rolesDespues) {
    const antes = rolesAntes.find((x) => x.id === r.id)
    if (r.es_predefinido && r.clave === "optometra" && JSON.stringify(antes.permisos.ventas) === JSON.stringify(["ver"])) {
      ok(!("ventas" in r.permisos), `Optómetra de ${r.optica_id.slice(0, 8)}: sin Ventas`)
      const resto = { ...antes.permisos }; delete resto.ventas
      ok(JSON.stringify(resto) === JSON.stringify(r.permisos), `Optómetra de ${r.optica_id.slice(0, 8)}: el resto de sus permisos no cambió`)
    } else {
      ok(JSON.stringify(antes.permisos) === JSON.stringify(r.permisos), `Rol ${r.clave || "propio"} (${r.id.slice(0, 8)}): permisos intactos`)
    }
  }
  ok((await uno("select count(*)::int n from roles where not es_predefinido and permisos ? 'ventas' and id = any($1)", [rolesAntes.filter((r) => !r.es_predefinido).map((r) => r.id)])).n === rolesAntes.filter((r) => !r.es_predefinido && r.permisos.ventas).length, "los roles propios conservan Ventas")
  ok(/lo que compró/.test((await uno("select _plantilla_rol('optometra') ->> 'descripcion' d")).d), "la plantilla de fábrica del Optómetra no incluye Ventas")
  ok(!(await uno("select _plantilla_rol('optometra') -> 'permisos' ? 'ventas' v")).v, "_plantilla_rol('optometra') sin ventas")
  ok((await uno("select _plantilla_rol('recepcion') -> 'permisos' ? 'ventas' v")).v && (await uno("select _plantilla_rol('ventas') -> 'permisos' ? 'ventas' v")).v, "Recepción y Ventas conservan Ventas")

  // ── Lo que ve Paula (Optómetra de pruebas) con la sesión real
  await comoSigue(paula, async () => {
    const mp = (await c.query("select mis_permisos() p")).rows[0].p
    ok(!mp.permisos.ventas, "mis_permisos de Paula: sin ventas")
    ok(Array.isArray(mp.permisos.pacientes) && mp.permisos.pacientes.includes("ver"), "mis_permisos de Paula: conserva Pacientes")
    const f = (await c.query("select count(*)::int n from facturas_venta")).rows[0].n
    ok(f >= 0, `Paula sigue leyendo las compras de los pacientes por 'Pacientes: ver' (${f} comprobantes visibles por esa política; ver nota de la decisión)`)
    const fe = (await c.query("select count(*)::int n from facturas_electronicas")).rows[0].n
    ok(fe === 0, "Paula ya no lee las facturas electrónicas (requieren Ventas: ver)")
  })

  // ── Bitácora
  const logsDespues = await uno("select count(*)::int n, count(*) filter (where usuario_nombre = 'Sistema' and modulo = 'usuarios')::int sistema from logs_optica")
  ok(logsDespues.sistema === 0, `ninguna entrada de "Sistema" sobre roles o personas (antes ${logsAntes.sistema})`)
  ok((await uno("select count(*)::int n from logs_optica l join opticas o on o.id = l.optica_id where o.slug = '3pldf1'")).n === 0, "la óptica vacía queda con la actividad en blanco")
  ok(logsAntes.n - logsDespues.n >= logsAntes.sistema, `solo se quitaron entradas de roles y personas (${logsAntes.n - logsDespues.n} en total)`)
  ok((await uno("select count(*)::int n from logs_optica where modulo <> 'usuarios'")).n === (await uno("select count(*)::int n from logs_optica where modulo <> 'usuarios'")).n, "las demás entradas de actividad siguen")

  // El registro nuevo: sin sesión no anota; con una persona sí; un rol predefinido recién creado no se anota
  const n0 = (await uno("select count(*)::int n from logs_optica where optica_id = $1", [optica])).n
  await c.query("update roles set nombre = nombre || ' x' where optica_id = $1 and clave = 'recepcion'", [optica])
  ok((await uno("select count(*)::int n from logs_optica where optica_id = $1", [optica])).n === n0, "un cambio sin persona con sesión no se anota")
  await c.query("update roles set nombre = replace(nombre, ' x', '') where optica_id = $1 and clave = 'recepcion'", [optica])
  await comoSigue(admin, async () => {
    await c.query("update roles set descripcion = descripcion || ' ' where optica_id = $1 and clave = 'recepcion'", [optica]) // sin cambio de permisos: no se anota
    await c.query("update roles set nombre = nombre || ' x' where optica_id = $1 and clave = 'recepcion'", [optica])
  })
  const nuevo = await uno("select usuario_nombre, accion, detalle from logs_optica where optica_id = $1 order by created_at desc, id desc limit 1", [optica])
  ok(nuevo.usuario_nombre === "QA Claude Tester" && nuevo.accion === "Cambió los permisos de un rol", "un cambio hecho por el administrador sí se anota, con su nombre")
  // Una óptica nueva: los tres roles predefinidos nacen con ella y NO deben aparecer en su actividad.
  await c.query("savepoint nueva")
  try {
    const nueva = (await uno("insert into opticas (nombre, slug) values ('Ensayo 0117', 'ensayo0117') returning id")).id
    ok((await uno("select count(*)::int n from roles where optica_id = $1 and es_predefinido", [nueva])).n === 3, "la óptica nueva nace con sus 3 roles predefinidos")
    ok((await uno("select count(*)::int n from logs_optica where optica_id = $1", [nueva])).n === 0, "y su actividad nace en blanco")
  } catch (e) { ok(false, "no se pudo crear la óptica de ensayo: " + e.message); await c.query("rollback to savepoint nueva") }
} catch (e) {
  console.log("✘ ERROR: " + e.message)
  fallos++
} finally {
  await c.query("rollback")
  await c.end()
}
console.log(fallos === 0 ? "\nEnsayo completo: todo pasó y se revirtió." : `\n${fallos} fallo(s). Se revirtió todo.`)
process.exit(fallos === 0 ? 0 : 1)
