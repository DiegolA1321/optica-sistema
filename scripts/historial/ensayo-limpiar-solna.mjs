// Ensayo de limpiar-solna-propuesta.sql: lo corre dentro de una transacción que SIEMPRE se revierte y comprueba que (1) ninguna otra óptica cambió y (2) lo que debe conservarse sigue igual.
//
//   node --env-file=.env.local scripts/historial/ensayo-limpiar-solna.mjs
import pg from "pg"
import fs from "node:fs"

const OPTICA = "b6eb867a-6b08-42c6-b493-27d139bed64e"
const sql = fs.readFileSync(new URL("./limpiar-solna-propuesta.sql", import.meta.url), "utf8").replace(/^begin;$/m, "").replace(/^rollback;$/m, "")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const tablas = (await q(`select c.table_name t from information_schema.columns c join information_schema.tables x using (table_schema, table_name)
  where c.table_schema = 'public' and c.column_name = 'optica_id' and x.table_type = 'BASE TABLE' order by 1`)).map((r) => r.t)
const conteos = async () => {
  const m = {}
  for (const t of tablas) for (const r of await q(`select optica_id::text id, count(*)::int n from public.${t} group by 1`)) m[`${t}|${r.id}`] = r.n
  return m
}
const stock = async () => JSON.stringify(await q("select id, stock, activo from inventario where optica_id = $1 order by id", [OPTICA]))
const marca = async () => JSON.stringify(await q("select nombre, slug, logo_url, settings, marca, motivos_consulta, categorias_inventario, datos_bancarios, activa from opticas where id = $1", [OPTICA]))

const authAntes = async () => (await q("select count(*)::int n from auth.users where email = 'secretaria.qa.prueba@opticasolna.test'"))[0].n
const authInicio = await authAntes()
const antes = await conteos()
const stockAntes = await stock()
const marcaAntes = await marca()
try {
  await c.query("begin")
  await c.query(sql)
  const despues = await conteos()
  const claves = new Set([...Object.keys(antes), ...Object.keys(despues)])
  const otras = [...claves].filter((k) => !k.endsWith(OPTICA) && (antes[k] || 0) !== (despues[k] || 0))
  ok(otras.length === 0, "ninguna otra óptica cambió" + (otras.length ? ": " + otras.join(", ") : ""))
  const borrado = {}
  const quedan = {}
  for (const t of tablas) {
    const a = antes[`${t}|${OPTICA}`] || 0
    const d = despues[`${t}|${OPTICA}`] || 0
    if (a !== d) borrado[t] = `${a} → ${d}`
    if (d > 0) quedan[t] = d
  }
  console.log("\nBorrado en Solna:", JSON.stringify(borrado, null, 1))
  console.log("Queda en Solna:", JSON.stringify(quedan))
  const conservar = { perfiles: 2, roles: 4, disponibilidad: 1, horarios_usuario: 1, inventario: 1, movimientos_inventario: 1, auditoria: 7 }
  for (const [t, n] of Object.entries(conservar)) ok((despues[`${t}|${OPTICA}`] || 0) === n, `${t}: se conserva (${n})`)
  const vaciar = ["pacientes_base", "citas_base", "consultas_base", "facturas_venta", "abonos_factura", "ordenes_laboratorio", "pases_a_venta", "citas_eventos", "logs_optica", "contador_comprobantes_venta", "contador_ordenes_laboratorio"]
  for (const t of vaciar) ok((despues[`${t}|${OPTICA}`] || 0) === 0, `${t}: queda vacía`)
  const hijas = await q(`select (select count(*)::int from facturas_venta_lineas l where l.factura_id in (select id from facturas_venta where optica_id = $1)) lineas`, [OPTICA])
  ok(hijas[0].lineas === 0, "sin líneas de factura huérfanas")
  ok((await stock()) === stockAntes, "el producto y su existencia siguen igual (el borrado no tocó el inventario)")
  ok((await marca()) === marcaAntes, "la fila de la óptica (marca, ajustes, catálogos, logo) no cambió")
  ok((despues[`visitas|${OPTICA}`] || 0) === 0, `visitas a la página pública: se borran las ${antes[`visitas|${OPTICA}`] || 0}`)
  ok(authInicio === 1 && (await authAntes()) === 0, "la cuenta de Auth huérfana de prueba se borra (y solo esa)")
  ok((await q("select count(*)::int n from auth.users u where exists (select 1 from perfiles p where p.id = u.id and p.optica_id = $1)", [OPTICA]))[0].n === 2, "las cuentas del administrador y de Leonela siguen")
} catch (e) {
  console.log("✘ ERROR:", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  const fin = await conteos()
  ok(JSON.stringify(fin) === JSON.stringify(antes), "revertido: todo quedó exactamente como estaba")
  await c.end()
}
console.log(fallos ? `\n${fallos} comprobación(es) fallaron` : "\nTodo ✔ (nada aplicado)")
process.exit(fallos ? 1 : 0)
