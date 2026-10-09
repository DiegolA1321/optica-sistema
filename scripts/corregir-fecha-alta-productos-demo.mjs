// Corrige en la Óptica Demo la fecha de alta de los productos: los 20 se crearon el mismo día (7 oct 2026), así que el
// "+N este mes" de los Totales del Inicio decía "+20 este mes" y no informaba nada. Se reparten de forma fija entre
// los últimos meses (3 de este mes, el resto de a 2 por mes hacia atrás). Solo cambia `created_at`.
//
//   node --env-file=.env.local scripts/corregir-fecha-alta-productos-demo.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/corregir-fecha-alta-productos-demo.mjs --ejecutar   # escribe de verdad
//
// Seguridad: aborta si la óptica objetivo no es exactamente "Óptica Demo"; solo toca productos de esa óptica;
// compara el conteo de filas de las demás ópticas antes y después. Imprime las fechas anteriores por si hay que volver atrás.
import pg from "pg"

const EJECUTAR = process.argv.includes("--ejecutar")
const NOMBRE_OPTICA = "Óptica Demo"

const client = new pg.Client()
await client.connect()
await client.query("begin")
try {
  const { rows: opts } = await client.query("select id, nombre from opticas where nombre = $1", [NOMBRE_OPTICA])
  if (opts.length !== 1) throw new Error(`Se esperaba exactamente una óptica "${NOMBRE_OPTICA}" y hay ${opts.length}`)
  const O = opts[0].id
  const otras = async () => JSON.stringify((await client.query("select optica_id, count(*)::int n, max(created_at)::text m from inventario where optica_id <> $1 group by 1 order by 1", [O])).rows)
  const antesOtras = await otras()

  const { rows: antes } = await client.query("select id, nombre, created_at::text c from inventario where optica_id = $1 order by nombre, id", [O])
  console.log(`Antes: ${antes.length} productos; fechas de alta:`, [...new Set(antes.map((p) => p.c.slice(0, 10)))])
  console.log("Fechas anteriores (para volver atrás):", JSON.stringify(antes.map((p) => [p.id, p.c])))

  const { rowCount } = await client.query(
    `with orden as (
       select id, row_number() over (order by nombre, id) rn from inventario where optica_id = $1
     )
     update inventario i
        set created_at = case
              when o.rn <= 3 then timestamptz '2026-10-01 10:00:00-05' + (o.rn - 1) * interval '1 day'
              else timestamptz '2026-09-05 10:00:00-05' - ((o.rn - 4) / 2) * interval '1 month'
            end
       from orden o
      where i.id = o.id and i.optica_id = $1`, [O])

  const { rows: despues } = await client.query("select to_char(created_at at time zone 'America/Guayaquil', 'YYYY-MM') mes, count(*)::int n from inventario where optica_id = $1 group by 1 order by 1", [O])
  console.log(`Actualizados: ${rowCount}. Productos por mes de alta:`, JSON.stringify(despues))
  const esteMes = despues.find((d) => d.mes === "2026-10")?.n ?? 0

  const fallos = []
  if (rowCount !== antes.length) fallos.push(`se esperaban ${antes.length} filas y se actualizaron ${rowCount}`)
  if (esteMes !== 3) fallos.push(`"+N este mes" debería ser 3 y es ${esteMes}`)
  if ((await otras()) !== antesOtras) fallos.push("cambió algo en las demás ópticas")
  if (fallos.length) throw new Error("Verificaciones fallidas: " + fallos.join("; "))

  if (EJECUTAR) { await client.query("commit"); console.log("EJECUTADO (commit)") }
  else { await client.query("rollback"); console.log("ENSAYO correcto: se revirtió. Para aplicar: --ejecutar") }
} catch (err) {
  await client.query("rollback")
  console.error("ERROR, se revirtió todo:", err.message)
  process.exitCode = 1
} finally {
  await client.end()
}
