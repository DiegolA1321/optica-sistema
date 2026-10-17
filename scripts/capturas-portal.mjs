// Capturas del portal del paciente en laptop (1366×768), tablet (768) y celular (390): del paciente de demostración PERMANENTE de la Óptica Demo (cita próxima, historial, tres
// recetas, lentes en el laboratorio, saldo y una compra con factura electrónica) y de un paciente NUEVO (temporal, en la óptica de pruebas, que se borra al terminar).
// Cada pantalla se captura completa (la ventana se alarga hasta el final del contenido) y cada ventana, como se ve. Solo LEE en la Demo.
//
//   node --env-file=.env.local --env-file=.env.test scripts/capturas-portal.mjs [carpeta-de-salida]
//   Con MUESTRA_DETALLE=1 el detalle de las citas (con quién, confirmar, calificar; migración 0125) es de ejemplo (solo en desarrollo) mientras la migración no esté aplicada.
import { chromium } from "@playwright/test"
import pg from "pg"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "docs/portal-v2-capturas")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
const TAMANOS = [["laptop", 1366, 768], ["tablet", 768, 1024], ["celular", 390, 844]]
const CLAVE_NUEVO = "PortalNuevo2026x"
const MUESTRA = process.env.MUESTRA_DETALLE === "1" ? "&_muestra=detalle" : ""
fs.rmSync(SALIDA, { recursive: true, force: true })
fs.mkdirSync(SALIDA, { recursive: true })

const c = new pg.Client()
await c.connect()
const q = async (t, p) => (await c.query(t, p)).rows
const hoy = (await q("select (now() at time zone 'America/Guayaquil')::date::text d"))[0].d
const OPTICA_PRUEBAS = (await q("select id from opticas where slug = 'v8twzq'"))[0].id
const fijo = (await q("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [OPTICA_PRUEBAS]))[0]
let nuevoId = null

async function prepararNuevo() {
  await c.query("drop table if exists t_p")
  await c.query("create temp table t_p as select * from pacientes_base where id = $1", [fijo.id])
  await c.query(
    `update t_p set id = gen_random_uuid(), nombre = 'María Fernanda Alcívar Mora', cedula = '0999999990', usuario = null, fecha_nacimiento = date '1952-05-15', fecha_registro = $1::date,
       clave_temporal = extensions.crypt($2, extensions.gen_salt('bf')), tiene_cuenta = true, sesion_token = null, intentos_fallidos = 0, bloqueado_hasta = null,
       ultima_consulta = null, estado_clinico_enc = null, evolucion_enc = null, estado_correccion_enc = null, referido_por = null, referido_por_id = null, correo = 'nuevo@example.com', telefono = '0991112233'`,
    [hoy, CLAVE_NUEVO],
  )
  nuevoId = (await q("insert into pacientes_base select * from t_p returning id"))[0].id
}
const limpiar = async () => { if (nuevoId) await c.query("delete from pacientes_base where id = $1", [nuevoId]) }

async function entrar(page, slug, cedula, clave, extra = "") {
  await page.goto(`${BASE}/?optica=${slug}${extra}`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click()
  await page.keyboard.insertText(cedula)
  await page.getByPlaceholder("Tu contraseña").click()
  await page.keyboard.insertText(clave)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.getByRole("heading", { name: "Resumen" }).waitFor({ timeout: 30_000 })
  await page.waitForFunction(() => !document.querySelector('[aria-label="Cargando tu resumen"]'), null, { timeout: 30_000 })
  await page.waitForTimeout(700)
}
const menu = (page, nombre) => page.getByRole("navigation", { name: "Menú del portal" }).filter({ visible: true }).getByRole("button", { name: nombre, exact: true })

try {
  await prepararNuevo()
  const browser = await chromium.launch()
  for (const [tam, ancho, alto] of TAMANOS) {
    for (const caso of ["demo", "nuevo"]) {
      const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, locale: "es-EC" })
      const page = await ctx.newPage()
      const foto = (n) => page.screenshot({ path: path.join(SALIDA, `${tam}-${caso}-${n}.png`) })
      // La pantalla completa: se alarga la ventana hasta el final del contenido y se vuelve al tamaño de siempre.
      const fotoLarga = async (n) => {
        const h = await page.evaluate(() => { const e = document.querySelector("main > div.overflow-y-auto"); return e ? e.scrollHeight + e.getBoundingClientRect().top + 8 : document.body.scrollHeight })
        await page.setViewportSize({ width: ancho, height: Math.min(5000, Math.max(alto, Math.ceil(h))) })
        await page.waitForTimeout(350)
        await foto(n)
        await page.setViewportSize({ width: ancho, height: alto })
        await page.waitForTimeout(150)
      }
      if (caso === "demo") await entrar(page, "qu7u2j", process.env.DEMO_PORTAL_CEDULA, process.env.DEMO_PORTAL_CLAVE, MUESTRA)
      else await entrar(page, "v8twzq", "0999999990", CLAVE_NUEVO)

      await foto("resumen-pantalla")
      await fotoLarga("resumen")
      if (caso === "nuevo") { await ctx.close(); continue }

      await page.getByRole("button", { name: /^Avisos/ }).click()
      await page.waitForTimeout(300)
      await foto("campanita")
      await page.keyboard.press("Escape")
      await page.mouse.click(5, 300)
      for (const [boton, n] of [["Mis citas", "citas"], ["Mi receta", "receta"], ["Mis compras", "compras"], ["Mis datos", "datos"]]) {
        await menu(page, boton).click()
        await page.waitForTimeout(900)
        await fotoLarga(n)
      }
      // Ventanas
      await menu(page, "Mis citas").click(); await page.waitForTimeout(500)
      const fila = page.getByRole("button", { name: /Ver el detalle de tu cita/ }).filter({ has: page.getByRole("status", { name: "Estado: Atendida" }) }).first()
      if (await fila.count()) { await fila.click(); await page.waitForTimeout(600); await foto("ventana-detalle-cita"); await page.keyboard.press("Escape"); await page.waitForTimeout(300) }
      await menu(page, "Mi receta").click(); await page.waitForTimeout(500)
      const receta = page.getByRole("button", { name: /Ver la receta del/ }).first()
      if (await receta.count()) { await receta.click(); await page.waitForTimeout(600); await foto("ventana-detalle-receta"); await page.keyboard.press("Escape"); await page.waitForTimeout(300) }
      await menu(page, "Mis citas").click(); await page.waitForTimeout(400)
      await page.getByRole("button", { name: "Agendar cita" }).first().click(); await page.waitForTimeout(800)
      const dias = page.locator('button[title="Disponible"]')
      if (await dias.count()) { await dias.nth(1).click(); await page.waitForTimeout(400) }
      await foto("ventana-agendar")
      await ctx.close()
    }
  }
  await browser.close()
} finally {
  await limpiar()
  await c.end()
}
console.log("Capturas en " + SALIDA + ": " + fs.readdirSync(SALIDA).length + " archivos. El paciente de demostración sigue en la Demo; el paciente nuevo temporal se borró.")
