// Corrige en la Óptica Demo las ventas de lunas progresivas o bifocales que no son coherentes con la edad o el
// diagnóstico del paciente (progresivo/bifocal solo con 40 años o más y presbicia en la consulta): pasan a
// monofocal, igual que su orden de laboratorio y la lente recomendada de la consulta. No cambia precios ni totales.
//
//   node --env-file=.env.local scripts/corregir-lentes-demo.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/corregir-lentes-demo.mjs --ejecutar   # escribe de verdad
//
// Seguridad: aborta si la óptica objetivo no es exactamente "Óptica Demo"; solo toca filas de esa óptica; compara
// el conteo de filas de las demás ópticas y los totales de ventas antes y después.
import pg from "pg"

const EJECUTAR = process.argv.includes("--ejecutar")
const NOMBRE_OPTICA = "Óptica Demo"
const ETIQUETA = { monofocal: "Monofocal", progresivo: "Progresivo", bifocal: "Bifocal" }

const client = new pg.Client()
await client.connect()
await client.query("begin")
try {
  const { rows: opts } = await client.query("select id, nombre from opticas where nombre = $1", [NOMBRE_OPTICA])
  if (opts.length !== 1) throw new Error(`Se esperaba exactamente una óptica "${NOMBRE_OPTICA}" y hay ${opts.length}`)
  const O = opts[0].id
  const estado = async () => {
    const t = {}
    for (const tabla of ["facturas_venta", "ordenes_laboratorio", "consultas_base"]) {
      const { rows } = await client.query(`select optica_id, count(*)::int n from ${tabla} where optica_id <> $1 group by 1 order by 1`, [O])
      t[tabla] = JSON.stringify(rows)
    }
    const lin = await client.query(`select f.optica_id, count(*)::int n, md5(string_agg(l.id::text || coalesce(l.detalle::text,''), ',' order by l.id)) h from facturas_venta_lineas l join facturas_venta f on f.id = l.factura_id where f.optica_id <> $1 group by 1 order by 1`, [O])
    t.lineasOtras = JSON.stringify(lin.rows)
    const { rows } = await client.query(`select coalesce(sum(monto_total),0)::text s from facturas_venta where optica_id = $1`, [O])
    t.montoDemo = rows[0].s
    return t
  }
  const antes = await estado()

  const { rows: lineas } = await client.query(
    `select l.id linea_id, l.descripcion, l.detalle, f.id factura_id, f.consulta_id, f.estado, p.nombre, c.fecha::text fecha,
            extract(year from age(c.fecha, p.fecha_nacimiento))::int edad, c.diagnostico_categorias cats, c.lente_recomendado
       from facturas_venta_lineas l
       join facturas_venta f on f.id = l.factura_id
       join pacientes p on p.id = f.paciente_id
       left join consultas c on c.id = f.consulta_id
      where f.optica_id = $1 and l.tipo = 'luna'`, [O])

  const corregidas = []
  for (const l of lineas) {
    const tipo = l.detalle?.tipo_lente
    if (tipo !== "progresivo" && tipo !== "bifocal") continue
    const coherente = l.edad >= 40 && (l.cats || []).includes("Presbicia")
    if (coherente) continue
    const material = l.detalle?.material || ""
    const nuevaDescripcion = l.descripcion.replace(new RegExp(`^Luna: ${ETIQUETA[tipo]}`), `Luna: ${ETIQUETA.monofocal}`)
    await client.query(
      `update facturas_venta_lineas set detalle = jsonb_set(detalle, '{tipo_lente}', '"monofocal"'), descripcion = $2 where id = $1`, [l.linea_id, nuevaDescripcion])
    const { rowCount: ords } = await client.query(
      `update ordenes_laboratorio set tipo_lente = 'monofocal', observaciones = $3 where factura_id = $1 and optica_id = $2`,
      [l.factura_id, O, `Lente recomendado: Monofocal ${material}`.trim()])
    let consulta = 0
    if (l.consulta_id) {
      const r = await client.query(`update consultas_base set lente_recomendado = $2 where id = $1 and optica_id = $3`, [l.consulta_id, `Monofocal ${material}`.trim(), O])
      consulta = r.rowCount
    }
    corregidas.push(`${l.nombre} (${l.edad} años, ${l.fecha}): ${tipo} → monofocal · ${l.estado} · órdenes ${ords} · consulta ${consulta}`)
  }

  // ── Verificaciones: nada incoherente queda en toda la óptica ──
  const fallos = []
  const { rows: restantes } = await client.query(
    `select p.nombre, extract(year from age(c.fecha, p.fecha_nacimiento))::int edad, l.detalle->>'tipo_lente' tipo, c.diagnostico_categorias cats
       from facturas_venta_lineas l join facturas_venta f on f.id = l.factura_id join pacientes p on p.id = f.paciente_id left join consultas c on c.id = f.consulta_id
      where f.optica_id = $1 and l.tipo = 'luna' and l.detalle->>'tipo_lente' in ('progresivo','bifocal')`, [O])
  for (const r of restantes) if (!(r.edad >= 40 && (r.cats || []).includes("Presbicia"))) fallos.push(`${r.nombre}: ${r.tipo} sigue incoherente`)
  const { rows: ordenesMal } = await client.query(
    `select o.numero from ordenes_laboratorio o join facturas_venta_lineas l on l.factura_id = o.factura_id and l.tipo = 'luna'
      where o.optica_id = $1 and o.tipo_lente is distinct from l.detalle->>'tipo_lente'`, [O])
  for (const o of ordenesMal) fallos.push(`orden ${o.numero}: tipo distinto al de su venta`)
  const { rows: obsMal } = await client.query(
    `select o.numero, o.tipo_lente, o.observaciones from ordenes_laboratorio o
      where o.optica_id = $1 and o.observaciones like 'Lente recomendado: %' and o.observaciones not like 'Lente recomendado: ' || initcap(o.tipo_lente) || '%'`, [O])
  const avisos = obsMal.map((o) => `orden ${o.numero}: la nota dice "${o.observaciones}" y el tipo es ${o.tipo_lente}`)
  const despues = await estado()
  for (const k of Object.keys(antes)) if (antes[k] !== despues[k]) fallos.push(`cambió ${k}`)

  console.log(`Base: ${process.env.PGDATABASE} · modo: ${EJECUTAR ? "EJECUTAR" : "ENSAYO (se revierte)"} · óptica ${NOMBRE_OPTICA}`)
  console.log(`Ventas de lunas corregidas: ${corregidas.length}`)
  corregidas.forEach((c) => console.log("  -", c))
  console.log(`Progresivas/bifocales que quedan (todas coherentes): ${restantes.length}`)
  console.log("Notas de órdenes que no coinciden con su tipo:", avisos.length ? "\n  - " + avisos.join("\n  - ") : "ninguna")
  console.log(`Total de ventas de la Demo sin cambio: ${despues.montoDemo}`)
  console.log(`Verificaciones: ${fallos.length === 0 ? "todas correctas" : fallos.length + " FALLOS"}`)
  fallos.forEach((f) => console.log("  ✗", f))
  if (fallos.length) throw new Error("Verificaciones fallidas: se revierte")
  if (EJECUTAR) { await client.query("commit"); console.log("✔ COMMIT: datos escritos.") } else { await client.query("rollback"); console.log("↩ ENSAYO terminado: ROLLBACK, no se escribió nada.") }
} catch (e) {
  await client.query("rollback")
  console.error("✗ Error, se revirtió todo:", e.message)
  process.exitCode = 1
} finally {
  await client.end()
}
