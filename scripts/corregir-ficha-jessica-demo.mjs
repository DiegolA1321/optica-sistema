// Corrige en la Óptica Demo la ficha de prueba del 7 de octubre de Jessica Macías Loor: su graduación pasó de
// OD −3,00 / OI −3,25 (3 oct.) a OD −1,50 / OI −1,12 (equivalente esférico) en 4 días, que no tiene sentido clínico.
// Queda OD −3,25 / OI −3,50 (cambio de 0,25 D por ojo respecto a la consulta anterior, miopía que avanza un paso), con
// su agudeza sin lentes y la evolución "Aumentó" que le corresponde. No toca el diagnóstico, el control agendado ni el resto.
//
//   node --env-file=.env.local scripts/corregir-ficha-jessica-demo.mjs              # ensayo: se revierte
//   node --env-file=.env.local scripts/corregir-ficha-jessica-demo.mjs --ejecutar   # escribe de verdad
//
// Seguridad: aborta si la óptica objetivo no es exactamente "Óptica Demo"; solo toca la consulta de esa paciente del
// 7 de octubre; compara el conteo de filas de las demás ópticas antes y después.
import pg from "pg"
import { tendenciaEntreConsultas } from "../src/utilidades/tendenciaGraduacion.js"

const EJECUTAR = process.argv.includes("--ejecutar")
const NUEVO = {
  od: { esfera: "-3.25", cilindro: "0.00", eje: "", avSc: "20/80", avCc: "20/20" },
  oi: { esfera: "-3.50", cilindro: "0.00", eje: "", avSc: "20/100", avCc: "20/20" },
}

const client = new pg.Client()
await client.connect()
await client.query("begin")
try {
  const { rows: opts } = await client.query("select id from opticas where nombre = 'Óptica Demo'")
  if (opts.length !== 1) throw new Error("No se encontró exactamente una óptica 'Óptica Demo'")
  const O = opts[0].id
  const otras = async () => JSON.stringify((await client.query(`select optica_id, count(*)::int n from consultas_base where optica_id <> $1 group by 1 order by 1`, [O])).rows)
  const antes = await otras()

  const { rows } = await client.query(
    `select c.id, c.fecha::text fecha, c.datos_clinicos from consultas c join pacientes_base p on p.id = c.paciente_id
      where c.optica_id = $1 and p.nombre = 'Jessica Macías Loor' order by c.fecha, c.created_at`, [O])
  if (rows.length !== 2) throw new Error("Se esperaban 2 consultas de Jessica y hay " + rows.length)
  const [previa, hoy] = rows
  if (previa.fecha !== "2026-10-03" || hoy.fecha !== "2026-10-07") throw new Error("Las fechas de las consultas no son las esperadas")

  const datos = { ...hoy.datos_clinicos, od: NUEVO.od, oi: NUEVO.oi }
  const tendencia = tendenciaEntreConsultas([{ fecha: hoy.fecha, od: NUEVO.od, oi: NUEVO.oi }, { fecha: previa.fecha, od: previa.datos_clinicos.od, oi: previa.datos_clinicos.oi }])
  await client.query(`update consultas_base set datos_clinicos_enc = cifrar_clinico($2::text), evolucion_calculada = $3 where id = $1 and optica_id = $4`, [hoy.id, JSON.stringify(datos), tendencia.verdicto, O])
  await client.query(
    `update pacientes_base p set evolucion_enc = cifrar_clinico($2) from consultas c where c.id = $1 and p.id = c.paciente_id and p.optica_id = $3`, [hoy.id, tendencia.verdicto, O])

  // ── Verificaciones ──
  const fallos = []
  const { rows: [d] } = await client.query(`select datos_clinicos, evolucion_calculada from consultas where id = $1`, [hoy.id])
  const cambioOjo = (o) => Math.abs(Number(d.datos_clinicos[o].esfera) - Number(previa.datos_clinicos[o].esfera))
  if (cambioOjo("od") > 0.25 || cambioOjo("oi") > 0.25) fallos.push("el cambio supera 0,25 D")
  if (d.datos_clinicos.control_agenda !== "ahora") fallos.push("se perdió la elección del control")
  if (d.evolucion_calculada !== "Aumentó") fallos.push("evolución inesperada: " + d.evolucion_calculada)
  if (!(Number(d.datos_clinicos.od.esfera) < 0 && Number(d.datos_clinicos.oi.esfera) < 0)) fallos.push("la miopía no tiene esfera negativa")
  if ((await otras()) !== antes) fallos.push("cambió otra óptica")
  console.log(`modo: ${EJECUTAR ? "EJECUTAR" : "ENSAYO"} · tendencia: ${tendencia.verdicto} (variación ${tendencia.variacion})`)
  console.log("verificaciones:", fallos.length ? fallos.join("; ") : "correctas")
  if (fallos.length) throw new Error("Verificaciones fallidas")
  if (EJECUTAR) { await client.query("commit"); console.log("✔ COMMIT") } else { await client.query("rollback"); console.log("↩ ENSAYO: ROLLBACK") }
} catch (e) {
  await client.query("rollback"); console.error("✗ Se revirtió todo:", e.message); process.exitCode = 1
} finally { await client.end() }
