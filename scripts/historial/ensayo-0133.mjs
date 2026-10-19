// Ensayo de la migración 0133 (la receta del portal con lo nuevo de la ficha de cinco pasos): la aplica DENTRO de una transacción y SIEMPRE revierte.
//   node --env-file=.env.local scripts/ensayo-0133.mjs
import pg from "pg"
import fs from "node:fs"

const leer = (f) => fs.readFileSync(new URL("../../supabase/migrations/" + f, import.meta.url), "utf8")
const c = new pg.Client()
await c.connect()
let fallos = 0
const ok = (cond, msg) => { console.log((cond ? "✔ " : "✘ ") + msg); if (!cond) fallos++ }
const q = async (t, p) => (await c.query(t, p)).rows
const fn = async (consulta, montaje, completa) => (await q("select consulta_para_paciente($1::jsonb, $2, $3) r", [JSON.stringify(consulta), montaje, completa]))[0].r

const nueva = {
  id: "x", paciente_id: "p", paciente: "A", fecha: "2026-10-19", motivo: "Control", antecedentes: "Diabetes", alergias: "Penicilina",
  diagnostico: "Miopía", lente_recomendado: "Progresivo", indicaciones: "Pausas",
  datos_clinicos: {
    od: { esfera: "-1.75", cilindro: "-0.75", eje: "10", avSc: "20/50", avCc: "20/25", avRx: "20/20", avRxF: "2", avScF: "1", avCcF: "" },
    oi: { esfera: "-1.00", cilindro: "-0.50", eje: "180", avSc: "20/40", avCc: "20/25", avRx: "20/25" },
    medidas: { adicion: "+1.50", adicionOd: "+1.50", adicionOi: "+1.75", dp: "62", dpOd: "31", dpOi: "31", dpCerca: "59", alt: "18", avCerca: "J1", avCercaRx: "J1", prismaOdCant: "2", prismaOdBase: "Nasal", prismaOiCant: "", prismaOiBase: "" },
    examen: { pioOd: "14" }, retinoscopia: { od: "x", oi: "y" },
    ficha: { v: 2, anamnesis: { sintomas: ["Dolor de cabeza"] }, salud: { pio: { od: "14" } } },
    control_agenda: "ahora",
  },
}
const vieja = { id: "y", fecha: "2026-01-01", datos_clinicos: { od: { esfera: "-1", cilindro: "", eje: "", avSc: "20/40", avCc: "20/20" }, oi: { esfera: "-1" }, medidas: { adicion: "+1.00", dp: "60", alt: "17" } } }

try {
  await c.query("begin")
  const antes = await fn(vieja, true, false)
  await c.query(leer("0133_portal_receta_ficha_cinco_pasos.sql"))
  ok((await q("select count(*)::int n from pg_proc where pronamespace = 'public'::regnamespace and proname = 'consulta_para_paciente'"))[0].n === 1, "consulta_para_paciente: una sola versión")

  const conMontaje = (await fn(nueva, true, false)).datos_clinicos
  ok(conMontaje.od.avRx === "20/20" && conMontaje.od.avRxF === "2" && conMontaje.od.avScF === "1" && conMontaje.oi.avRx === "20/25", "el portal recibe la agudeza con la receta nueva y las letras falladas")
  ok(conMontaje.medidas.adicionOd === "+1.50" && conMontaje.medidas.adicionOi === "+1.75" && conMontaje.medidas.prismaOdCant === "2" && conMontaje.medidas.prismaOdBase === "Nasal", "recibe la adición por ojo y el prisma")
  ok(conMontaje.medidas.dp === "62" && conMontaje.medidas.dpOd === "31" && conMontaje.medidas.dpOi === "31" && conMontaje.medidas.dpCerca === "59" && conMontaje.medidas.alt === "18", "con permiso, recibe la DP total, de cada ojo, de cerca y la altura")
  const sinMontaje = (await fn(nueva, false, false)).datos_clinicos
  ok(!("dp" in sinMontaje.medidas) && !("dpOd" in sinMontaje.medidas) && !("dpOi" in sinMontaje.medidas) && !("dpCerca" in sinMontaje.medidas) && !("alt" in sinMontaje.medidas), "sin permiso, NO recibe ninguna distancia pupilar ni la altura")
  ok(sinMontaje.medidas.adicionOd === "+1.50" && sinMontaje.medidas.avCercaRx === "J1", "sin permiso sí recibe la adición y la agudeza de cerca")
  const todo = JSON.stringify(await fn(nueva, true, false))
  for (const prohibido of ["Diabetes", "Penicilina", "anamnesis", "salud", "pioOd", "retinoscopia", "control_agenda", "ficha", "motivo"]) ok(!todo.includes(prohibido), `el portal no recibe «${prohibido}»`)

  const d = await fn(nueva, false, true)
  ok(d.datos_clinicos.ficha?.anamnesis && !("control_agenda" in d.datos_clinicos) && !("dpOd" in d.datos_clinicos.medidas), "la descarga de mis datos incluye la ficha completa, sin campos internos ni la DP si no hay permiso")

  const despues = await fn(vieja, true, false)
  ok(JSON.stringify(despues.datos_clinicos.medidas) === JSON.stringify(antes.datos_clinicos.medidas) && despues.datos_clinicos.od.avCc === "20/20" && despues.datos_clinicos.od.esfera === "-1", "una receta guardada antes se entrega igual que antes")

  // con la API real de la base: una consulta de la óptica de pruebas, vista como el paciente
  const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
  const P = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OP]))[0].id
  await c.query("update pacientes_base set sesion_token = 'tok-0133', sesion_token_creado_en = now() where id = $1", [P])
  await c.query("insert into consultas (optica_id, paciente_id, paciente, fecha, motivo, datos_clinicos) values ($1, $2, 'E Dos E Portal Auditoria', '2026-10-19', 'Control', $3::jsonb)", [OP, P, JSON.stringify(nueva.datos_clinicos)])
  await c.query("savepoint s"); await c.query("set local role anon")
  const filas = (await c.query("select datos_clinicos from mis_consultas_paciente($1, 'tok-0133') where fecha = '2026-10-19'", [P])).rows
  await c.query("reset role"); await c.query("release savepoint s")
  ok(filas.length === 1 && filas[0].datos_clinicos.od.avRx === "20/20" && !JSON.stringify(filas[0]).includes("anamnesis"), "mis_consultas_paciente entrega la receta nueva y nada más")
} catch (e) {
  console.error("ERROR", e.message); fallos++
} finally {
  await c.query("rollback").catch(() => {})
  await c.end()
}
console.log(fallos ? `\n${fallos} fallo(s). Nada quedó escrito (se revirtió).` : "\nTodo bien. Nada quedó escrito (se revirtió).")
process.exit(fallos ? 1 : 0)
