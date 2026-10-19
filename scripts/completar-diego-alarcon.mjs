// Completa las dos recetas de prueba del paciente «Diego alarcon» (Óptica Demo): tenían solo el ojo derecho (y a medias). Pedido de Diego, 18 oct. 2026.
//   node --env-file=.env.local scripts/completar-diego-alarcon.mjs
import pg from "pg"
const c = new pg.Client(); await c.connect()
const P = "cf1adea0-ebf2-499a-a6a1-080d59acd834"
const nuevo = {
  "98cc9185-e348-4ae3-8357-54e2adc7ade9": { od: { esfera: "+0.25", cilindro: "", eje: "", avSc: "20/25", avCc: "20/20" }, oi: { esfera: "+0.50", cilindro: "-0.25", eje: "90", avSc: "20/30", avCc: "20/20" }, medidas: { dp: "62", alt: "", adicion: "", avCerca: "" } },
  "ec822571-b430-4727-b542-dbb587e4e937": { od: { esfera: "+0.25", cilindro: "-0.75", eje: "10", avSc: "20/30", avCc: "20/20" }, oi: { esfera: "+0.25", cilindro: "-1.00", eje: "170", avSc: "20/40", avCc: "20/25" }, medidas: { dp: "62", alt: "", adicion: "", avCerca: "" } },
}
for (const [id, d] of Object.entries(nuevo)) {
  const { rows: [k] } = await c.query("select datos_clinicos from consultas where id = $1 and paciente_id = $2", [id, P])
  if (!k) throw new Error("no existe " + id)
  const datos = { ...k.datos_clinicos, od: d.od, oi: d.oi, medidas: { ...k.datos_clinicos?.medidas, ...d.medidas } }
  await c.query("update consultas_base set datos_clinicos_enc = cifrar_clinico($2) where id = $1 and paciente_id = $3", [id, JSON.stringify(datos), P])
  console.log("completada", id)
}
const { rows } = await c.query("select id, datos_clinicos->'oi' oi from consultas where paciente_id = $1", [P])
console.log(JSON.stringify(rows))
await c.end()
