// Ensayo de la migración 0141 (stock máximo por producto): la aplica DENTRO de una transacción y SIEMPRE revierte. No toca ninguna fila real.
//   node --env-file=.env.local scripts/historial/ensayo-0141.mjs
import pg from "pg"
import fs from "node:fs"
const c = new pg.Client(); await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const como = async (rol, claims, sql, params = []) => {
  await c.query("savepoint r")
  try {
    if (claims) await c.query("select set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true)", [JSON.stringify(claims), claims.sub])
    await c.query(`set local role ${rol}`)
    const r = (await c.query(sql, params)).rows
    await c.query("reset role"); await c.query("release savepoint r")
    return { r }
  } catch (e) { await c.query("rollback to savepoint r"); await c.query("reset role"); return { e: e.message } }
}
try {
  await c.query("begin")
  const antes = (await q("select count(*)::int n, count(*) filter (where critico is not null)::int con_minimo from inventario"))[0]
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id // la óptica de pruebas
  const admin = (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
  const cl = { sub: admin.id, role: "authenticated", aal: "aal2" }

  await c.query(fs.readFileSync(new URL("../../supabase/migrations/0141_stock_maximo_por_producto.sql", import.meta.url), "utf8"))
  ok((await q("select count(*)::int n from information_schema.columns where table_name = 'inventario' and column_name = 'stock_maximo'"))[0].n === 1, "la columna existe")
  const despues = (await q("select count(*)::int n, count(*) filter (where stock_maximo is not null)::int con_maximo from inventario"))[0]
  ok(despues.n === antes.n && despues.con_maximo === 0, `ningún producto cambia: ${despues.n} productos, todos «usar el general»`)

  // Un administrador crea y edita un producto con su máximo propio (por la API, con las políticas de siempre).
  const nuevo = await como("authenticated", cl, "insert into inventario (optica_id, nombre, categoria, stock, precio, critico, stock_maximo) values ($1, 'ENSAYO 0141', 'Monturas', 40, 10, 5, 30) returning id, stock, stock_maximo", [OP])
  ok(nuevo.r?.[0]?.stock_maximo === 30, "el administrador guarda un máximo propio" + (nuevo.e ? " — " + nuevo.e : ""))
  ok(nuevo.r?.[0]?.stock === 40, "y el máximo no limita la existencia: 40 u. con máximo 30")
  const id = nuevo.r?.[0]?.id
  ok((await como("authenticated", cl, "update inventario set stock_maximo = null where id = $1 returning id", [id])).r?.length === 1, "lo deja vacío («usar el general»)")
  ok((await como("authenticated", cl, "update inventario set stock_maximo = 0 where id = $1", [id])).e?.includes("inventario_stock_maximo_check"), "un máximo de 0 se rechaza")
  ok((await como("authenticated", cl, "update inventario set stock_maximo = 10000 where id = $1", [id])).e?.includes("inventario_stock_maximo_check"), "un máximo de más de 9999 se rechaza")
  ok((await como("authenticated", cl, "update inventario set stock_maximo = 7 where id = $1 returning stock", [id])).r?.[0]?.stock === 40, "un máximo menor que la existencia se acepta (solo avisa)")

  // Otra óptica no puede tocarlo; un anónimo tampoco.
  const otra = (await q("select id from opticas where id <> $1 limit 1", [OP]))[0]
  const otroAdmin = otra ? (await q("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [otra.id]))[0] : null
  if (otroAdmin) {
    const clOtra = { sub: otroAdmin.id, role: "authenticated", aal: "aal2" }
    ok((await como("authenticated", clOtra, "update inventario set stock_maximo = 99 where id = $1 returning id", [id])).r?.length === 0, "el administrador de otra óptica no puede cambiarlo")
  }
  ok((await como("anon", null, "update inventario set stock_maximo = 1 where id = $1 returning id", [id])).e !== undefined, "un anónimo no")
} catch (e) { console.error("ERROR", e.message); fallos++ } finally { await c.query("rollback").catch(() => {}); await c.end() }
console.log(fallos ? `\n${fallos} fallo(s).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
