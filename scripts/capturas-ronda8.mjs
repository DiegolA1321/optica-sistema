// Capturas de la ronda 8: cada pantalla del portal y cada pestaña del perfil del paciente (personal) a 1093 (la laptop de 1366 con la escala al 125 %), 1366, 1920 y 390 px, con el menú abierto y
// plegado, con DOS pacientes: el de demostración (Óptica Demo, SOLO LEE) y uno con datos incompletos que se crea en la óptica de pruebas y se borra al terminar.
//   node --env-file=.env.test --env-file=.env.local scripts/capturas-ronda8.mjs <carpeta-de-salida>
// A 390 px el sistema del personal muestra la pantalla de tamaño no admitido (ResolutionGuard, hasta que se corrija docs/revision-adaptable.md): no hay perfil que capturar ahí.
import { chromium } from "@playwright/test"
import pg from "pg"
import { randomUUID } from "node:crypto"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "capturas-ronda8")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
fs.mkdirSync(SALIDA, { recursive: true })
const PANTALLAS = ["Inicio", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]
const PESTANAS = [["resumen", /^Resumen/], ["citas", /^Citas/], ["graduacion", /^Graduación/], ["compras", /^Compras/], ["ordenes", /^Órdenes/]]
// [rótulo, ancho, alto, escala, menús]
const TAMANOS = [["1093", 1093, 768, 1.25, [false, true]], ["1366", 1366, 768, 1, [false, true]], ["1920", 1920, 1080, 1, [false]]]
const CELULAR = ["390", 390, 844, 2]
const INCOMPLETO = { nombre: "Paciente Datos Incompletos", cedula: "0900000088", usuario: "incompleto88", clave: "Captura-8-ok" }

// ── El paciente con datos incompletos (óptica de pruebas v8twzq) ──
const c = new pg.Client()
await c.connect()
const q = async (t, p) => (await c.query(t, p)).rows
const OP = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const ADMIN = (await q("select id, nombre from perfiles where optica_id = $1 and rol = 'admin' limit 1", [OP]))[0]
let idIncompleto = null
async function crearIncompleto() {
  await borrarIncompleto()
  const [modelo] = await q("select * from pacientes_base where optica_id = $1 and anonimizado_en is null limit 1", [OP])
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [modelo.id])
  idIncompleto = randomUUID()
  await c.query("update t_p set id = $1, nombre = $2, cedula = $3, telefono = null, correo = null, fecha_nacimiento = null, usuario = $4, clave_temporal = extensions.crypt($5, extensions.gen_salt('bf')), tiene_cuenta = true, sesion_token = null, anonimizado_en = null", [idIncompleto, INCOMPLETO.nombre, INCOMPLETO.cedula, INCOMPLETO.usuario, INCOMPLETO.clave])
  await c.query("insert into pacientes_base select * from t_p")
  const cifrar = async (t) => (t == null ? null : (await q("select cifrar_clinico($1) v", [t]))[0].v)
  const fecha = async (n) => (await q(`select ((now() at time zone 'America/Guayaquil')::date + $1::int)::text d`, [n]))[0].d
  const citaAtendida = (await q(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado) values ($1, $2, $3, $4, '10:20 AM', 'Examen de Control', 'Atendida') returning id`, [OP, idIncompleto, INCOMPLETO.nombre, await fecha(-40)]))[0].id
  await c.query(`insert into citas_base (optica_id, paciente_id, paciente, fecha, hora, motivo, estado) values ($1, $2, $3, $4, '03:00 PM', 'Consulta General', 'Pendiente'), ($1, $2, $3, $5, '09:00 AM', 'Consulta General', 'No Asistió')`, [OP, idIncompleto, INCOMPLETO.nombre, await fecha(6), await fecha(-80)])
  // Una consulta con la receta a medias: solo el ojo derecho (esfera y cilindro), sin agudeza, sin adición ni distancia pupilar.
  const datos = { retinoscopia: {}, od: { esfera: "-2.00", cilindro: "-0.50", eje: "", avSc: "", avCc: "" }, oi: { esfera: "", cilindro: "", eje: "", avSc: "", avCc: "" }, medidas: {}, examen: {} }
  await c.query(
    `insert into consultas_base (id, optica_id, paciente_id, paciente, fecha, motivo, usa_lentes, lente_recomendado, proximo_control_dias, evolucion_calculada, estado_correccion, profesional_nombre, profesional_id, cita_id, diagnostico_categorias, imagenes,
       diagnostico_enc, antecedentes_enc, alergias_enc, antecedentes_familiares_enc, indicaciones_enc, datos_clinicos_enc, detalle_consulta_enc)
     values ($1,$2,$3,$4,$5,'Examen de Control',false,null,180,null,'Sin evaluación',$6,$7,$8,$9,'[]'::jsonb,$10,$11,$12,$13,$14,$15,$16)`,
    [randomUUID(), OP, idIncompleto, INCOMPLETO.nombre, await fecha(-40), ADMIN.nombre, ADMIN.id, citaAtendida, ["Miopía"], await cifrar("Miopía"), await cifrar(""), await cifrar(""), await cifrar(""), await cifrar(""), await cifrar(JSON.stringify(datos)), await cifrar(null)],
  )
}
async function borrarIncompleto() {
  const ids = (await q("select id from pacientes_base where optica_id = $1 and cedula = $2", [OP, INCOMPLETO.cedula])).map((r) => r.id)
  if (!ids.length) return
  await c.query("delete from pases_a_venta where paciente_id = any($1)", [ids])
  await c.query("delete from consultas_base where paciente_id = any($1)", [ids])
  await c.query("delete from citas_base where paciente_id = any($1)", [ids])
  await c.query("delete from pacientes_base where id = any($1)", [ids])
}

const browser = await chromium.launch()
const PACIENTES = [
  { clave: "demo", etiqueta: "demo", slug: "qu7u2j", nombrePerfil: "Paciente Demostración Portal", portal: [process.env.DEMO_PORTAL_CEDULA, process.env.DEMO_PORTAL_CLAVE], staff: [process.env.DEMO_ADMIN_EMAIL, process.env.DEMO_ADMIN_PASSWORD] },
  { clave: "incompleto", etiqueta: "incompleto", slug: "v8twzq", nombrePerfil: INCOMPLETO.nombre, portal: [INCOMPLETO.usuario, INCOMPLETO.clave], staff: [process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD] },
]

const foto = async (page, nombre, selectorScroll) => {
  const h = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return document.body.scrollHeight; return s === "#panel-paciente" ? Math.ceil(e.getBoundingClientRect().bottom + window.scrollY + 40) : Math.ceil(e.scrollHeight + e.getBoundingClientRect().top + 8) }, selectorScroll)
  const v = page.viewportSize()
  await page.setViewportSize({ width: v.width, height: Math.min(6000, Math.max(v.height, h)) })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SALIDA, nombre + ".png") })
  await page.setViewportSize(v)
}
const desborde = async (page, ancho, que) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > ancho + 1) console.log(`  ⚠ ${que}: desplazamiento horizontal ${w} px (ventana ${ancho})`) }

async function portal(p, [rotulo, ancho, alto, escala], plegado) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, locale: "es-EC" })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?optica=${p.slug}`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click(); await page.keyboard.insertText(p.portal[0])
  await page.getByPlaceholder("Tu contraseña").click(); await page.keyboard.insertText(p.portal[1])
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForSelector(".pt-zona", { timeout: 30000 })
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  if (plegado) await page.getByRole("button", { name: "Ocultar el menú" }).click()
  for (const pantalla of PANTALLAS) {
    await page.getByRole("navigation", { name: "Menú del portal" }).filter({ visible: true }).getByRole("button", { name: pantalla, exact: true }).click()
    await page.waitForTimeout(1300)
    await foto(page, `portal · ${p.etiqueta} · ${pantalla} · ${rotulo}${plegado ? " · plegado" : ""}`, "[data-portal-scroll]")
    await desborde(page, ancho, `portal ${p.etiqueta} ${pantalla} ${rotulo}`)
  }
  await ctx.close()
}

async function perfil(p, [rotulo, ancho, alto, escala], plegado) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala, locale: "es-EC" })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?optica=${p.slug}`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click(); await page.keyboard.insertText(p.staff[0])
  await page.getByPlaceholder("Tu contraseña").click(); await page.keyboard.insertText(p.staff[1])
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForFunction(() => !document.body.innerText.includes("Iniciar sesión"), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.getByRole("button", { name: "Pacientes", exact: true }).first().click()
  await page.getByRole("textbox", { name: /buscar paciente/i }).fill(p.nombrePerfil)
  const fila = page.getByRole("row").filter({ hasText: p.nombrePerfil })
  await fila.getByRole("button", { name: /Ver perfil 360/ }).waitFor({ timeout: 30000 })
  await page.waitForTimeout(3000)
  for (let i = 0; i < 6; i++) {
    await fila.getByRole("button", { name: /Ver perfil 360/ }).click()
    if (await page.getByRole("tab", { name: /Citas/ }).waitFor({ timeout: 8000 }).then(() => true, () => false)) break
  }
  if (plegado) await page.getByRole("button", { name: "Colapsar menú" }).click()
  await page.waitForTimeout(1200)
  for (const [nombre, tab] of PESTANAS) {
    await page.getByRole("tab", { name: tab }).first().click()
    await page.waitForTimeout(1300)
    await foto(page, `perfil · ${p.etiqueta} · ${nombre} · ${rotulo}${plegado ? " · plegado" : ""}`, "#panel-paciente")
    await desborde(page, ancho, `perfil ${p.etiqueta} ${nombre} ${rotulo}`)
  }
  await ctx.close()
}

try {
  await crearIncompleto()
  for (const p of PACIENTES) {
    console.log("== " + p.etiqueta)
    for (const t of TAMANOS) for (const plegado of t[4]) { await portal(p, t.slice(0, 4), plegado); await perfil(p, t.slice(0, 4), plegado) }
    await portal(p, CELULAR, false)
  }
} finally {
  await borrarIncompleto()
  await c.end()
  await browser.close()
}
console.log("Capturas en " + SALIDA)
