// Ensayo de la migración 0112 (categoría "Monturas"): la aplica dentro de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0112.mjs
import pg from "pg"
import fs from "node:fs"
const sql = fs.readFileSync(new URL("../supabase/migrations/0112_categoria_monturas.sql", import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const n = async (q, p = []) => (await c.query(q, p)).rows[0].n
try {
  await c.query("begin")
  const antes = { productos: await n("select count(*)::int n from inventario"), stock: await n("select coalesce(sum(stock),0)::int n from inventario"),
    movs: await n("select count(*)::int n from movimientos_inventario") }
  const viejas = await n("select count(*)::int n from inventario where categoria in ('Armazones','Armazón','Montura')")
  const opticasViejas = await n("select count(*)::int n from opticas where categorias_inventario && array['Armazones','Armazón','Montura']")
  console.log(`(antes: ${antes.productos} productos, ${viejas} con el nombre viejo, ${opticasViejas} ópticas con el nombre viejo)`)
  await c.query(sql)
  ok(true, "La migración se aplica sin errores")
  ok(await n("select count(*)::int n from inventario where categoria in ('Armazones','Armazón','Montura')") === 0, "ningún producto conserva el nombre viejo")
  ok(await n("select count(*)::int n from inventario where categoria = 'Monturas'") >= viejas, `los ${viejas} productos pasaron a "Monturas"`)
  ok(await n("select count(*)::int n from opticas where categorias_inventario && array['Armazones','Armazón','Montura']") === 0, "ninguna óptica conserva el nombre viejo en su catálogo")
  ok(await n("select count(*)::int n from opticas o where (select count(*) from unnest(o.categorias_inventario)) <> (select count(distinct x) from unnest(o.categorias_inventario) x)") === 0, "sin categorías repetidas")
  ok(await n("select count(*)::int n from opticas where 'Monturas' = any(categorias_inventario)") >= opticasViejas, "las ópticas con el nombre viejo ahora tienen 'Monturas'")
  ok(await n("select count(*)::int n from opticas where array_length(categorias_inventario,1) is null") === 0, "ninguna óptica quedó sin categorías")
  ok(await n("select count(*)::int n from inventario") === antes.productos && await n("select coalesce(sum(stock),0)::int n from inventario") === antes.stock, "no cambió ningún producto ni existencia")
  ok(await n("select count(*)::int n from movimientos_inventario") === antes.movs, "el cambio de categoría no deja movimientos (solo cambia el texto)")
  const def = (await c.query("select column_default d from information_schema.columns where table_name='opticas' and column_name='categorias_inventario'")).rows[0].d
  ok(/Monturas/.test(def) && !/Armaz|Montura'/.test(def), "las ópticas nuevas empiezan con Monturas y Accesorios: " + def)
} catch (e) { console.error("ERROR:", e.message); fallos++ } finally {
  await c.query("rollback"); await c.end()
  console.log(fallos === 0 ? "\nTodo bien. Se revirtió todo." : `\n${fallos} comprobaciones fallaron. Se revirtió todo.`)
  process.exitCode = fallos === 0 ? 0 : 1
}
