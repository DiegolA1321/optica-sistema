// Corrige en la Óptica Demo el "lente recomendado" de las consultas cuyo material no coincide con el de su orden de
// laboratorio (por ejemplo la consulta dice "Monofocal Policarbonato" y la orden fabrica CR-39). Pasa a ser
// "<Tipo> <material de la orden>", y la nota automática "Lente recomendado: …" de la orden queda igual de coherente.
// No toca precios, comprobantes ni la orden en sí (tipo, material, receta).
//
//   node --env-file=.env.local scripts/corregir-lente-recomendado-demo.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/corregir-lente-recomendado-demo.mjs --ejecutar   # escribe de verdad
//
// Seguridad: aborta si la óptica objetivo no es exactamente "Óptica Demo"; solo toca filas de esa óptica; compara
// el conteo de filas de las demás ópticas y los totales de ventas antes y después.
import pg from "pg"

const EJECUTAR = process.argv.includes("--ejecutar")
const NOMBRE_OPTICA = "Óptica Demo"
const ETIQUETA = { monofocal: "Monofocal", progresivo: "Progresivo", bifocal: "Bifocal" }
const norm = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

const client = new pg.Client()
await client.connect()
await client.query("begin")
try {
  const { rows: opts } = await client.query("select id from opticas where nombre = $1", [NOMBRE_OPTICA])
  if (opts.length !== 1) throw new Error(`Se esperaba exactamente una óptica "${NOMBRE_OPTICA}" y hay ${opts.length}`)
  const O = opts[0].id
  const estado = async () => {
    const t = {}
    for (const tabla of ["consultas_base", "ordenes_laboratorio", "facturas_venta"]) {
      const { rows } = await client.query(`select optica_id, count(*)::int n from ${tabla} where optica_id <> $1 group by 1 order by 1`, [O])
      t[tabla] = JSON.stringify(rows)
    }
    const { rows } = await client.query(`select coalesce(sum(monto_total),0)::text s from facturas_venta where optica_id = $1`, [O])
    t.montoDemo = rows[0].s
    const { rows: ord } = await client.query(`select md5(string_agg(id::text || tipo_lente || coalesce(material,'') || receta_od::text, ',' order by id::text)) h from ordenes_laboratorio where optica_id = $1`, [O])
    t.ordenesIntactas = ord[0].h
    return t
  }
  const antes = await estado()

  const { rows } = await client.query(
    `select c.id consulta_id, c.lente_recomendado, p.nombre,
            array_agg(distinct o.material) materiales, array_agg(distinct o.tipo_lente) tipos, count(o.id)::int ordenes
       from consultas_base c
       join ordenes_laboratorio o on o.consulta_id = c.id and o.estado <> 'cancelada'
       join pacientes_base p on p.id = c.paciente_id
      where c.optica_id = $1
      group by c.id, c.lente_recomendado, p.nombre`, [O])

  const corregidas = [], omitidas = []
  for (const r of rows) {
    const materiales = r.materiales.filter(Boolean)
    if (materiales.length !== 1 || r.tipos.length !== 1) { omitidas.push(`${r.nombre}: ${r.ordenes} órdenes con materiales o tipos distintos (se revisa a mano)`); continue }
    const material = materiales[0], tipo = r.tipos[0]
    const actual = r.lente_recomendado || ""
    const materialActual = actual.split(" ").slice(1).join(" ")
    // Coincide si el material de la consulta es el de la orden; sin lente recomendado no se inventa uno.
    if (!actual || norm(materialActual) === norm(material)) continue
    const nuevo = `${ETIQUETA[tipo] || tipo} ${material}`
    await client.query(`update consultas_base set lente_recomendado = $2 where id = $1 and optica_id = $3`, [r.consulta_id, nuevo, O])
    await client.query(`update ordenes_laboratorio set observaciones = $2 where consulta_id = $1 and optica_id = $3 and observaciones like 'Lente recomendado:%'`, [r.consulta_id, `Lente recomendado: ${nuevo}`, O])
    corregidas.push(`${r.nombre}: "${actual}" → "${nuevo}"`)
  }

  // ── Verificaciones ──
  const fallos = []
  const { rows: quedan } = await client.query(
    `select p.nombre, c.lente_recomendado, o.material from consultas_base c join ordenes_laboratorio o on o.consulta_id = c.id and o.estado <> 'cancelada'
       join pacientes_base p on p.id = c.paciente_id
      where c.optica_id = $1 and c.lente_recomendado is not null and o.material is not null
        and lower(c.lente_recomendado) not like '% ' || lower(o.material)`, [O])
  const omitidasNombres = new Set(omitidas.map((o) => o.split(":")[0]))
  for (const q of quedan) if (!omitidasNombres.has(q.nombre)) fallos.push(`${q.nombre}: "${q.lente_recomendado}" sigue distinto al material ${q.material}`)
  const despues = await estado()
  for (const k of Object.keys(antes)) if (antes[k] !== despues[k]) fallos.push(`cambió ${k}`)

  console.log(`Base: ${process.env.PGDATABASE} · modo: ${EJECUTAR ? "EJECUTAR" : "ENSAYO (se revierte)"} · óptica ${NOMBRE_OPTICA}`)
  console.log(`Consultas con orden revisadas: ${rows.length} · corregidas: ${corregidas.length}`)
  corregidas.forEach((c) => console.log("  -", c))
  console.log("Omitidas:", omitidas.length ? "\n  - " + omitidas.join("\n  - ") : "ninguna")
  console.log(`Órdenes (tipo, material y receta), comprobantes y totales sin cambio: ${despues.montoDemo}`)
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
