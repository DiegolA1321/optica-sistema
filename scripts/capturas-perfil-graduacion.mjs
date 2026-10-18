// Capturas del perfil del paciente del sistema del personal con el paciente de demostración (Óptica Demo, solo LEE): cada pestaña a 1366, 1920 y 390 px con el administrador, y la pestaña
// «Graduación» (con el selector abierto, «Explicar al paciente» y «Comparar dos recetas») además con cada rol. Dice, por rol, si ve la pestaña «Graduación».
//   node --env-file=.env.test scripts/capturas-perfil-graduacion.mjs <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "capturas-perfil")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
fs.mkdirSync(SALIDA, { recursive: true })
const PACIENTE = "Paciente Demostración Portal"
// A 390 px el sistema del personal muestra la pantalla de tamaño no admitido (ResolutionGuard, decisión del 17 oct.: se quita después del portal): no hay perfil que capturar.
const TAMANOS = [["1366", 1366, 768], ["1920", 1920, 1080]]
const browser = await chromium.launch()

async function entrar(ctx, rol) {
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?optica=qu7u2j`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click()
  await page.keyboard.insertText(process.env[`DEMO_${rol}_EMAIL`])
  await page.getByPlaceholder("Tu contraseña").click()
  await page.keyboard.insertText(process.env[`DEMO_${rol}_PASSWORD`])
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForFunction(() => !document.body.innerText.includes("Iniciar sesión"), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  // En celular el menú lateral está cerrado: se abre con su botón.
  if (!(await page.getByRole("button", { name: "Pacientes", exact: true }).first().isVisible())) await page.getByRole("button", { name: "Abrir menú" }).click().catch(() => {})
  const menu = page.getByRole("button", { name: "Pacientes", exact: true }).first()
  if (!(await menu.count())) return null
  await menu.click()
  await page.getByRole("textbox", { name: /buscar paciente/i }).fill(PACIENTE)
  const fila = page.getByRole("row").filter({ hasText: PACIENTE })
  await fila.getByRole("button", { name: /Ver perfil 360/ }).waitFor({ timeout: 30000 })
  await fila.getByText("Graduación:").waitFor({ timeout: 30000 }).catch(() => {})
  for (let i = 0; i < 5; i++) {
    await fila.getByRole("button", { name: /Ver perfil 360/ }).click()
    if (await page.getByRole("tab", { name: /Citas/ }).waitFor({ timeout: 8000 }).then(() => true, () => false)) break
  }
  await page.waitForTimeout(1200)
  return page
}
const foto = async (page, nombre) => { await page.waitForTimeout(600); await page.screenshot({ path: path.join(SALIDA, nombre + ".png"), fullPage: false }) }
const alto = (page) => page.evaluate(() => { const e = document.querySelector("#panel-paciente"); return e ? e.getBoundingClientRect().bottom + window.scrollY + 40 : document.body.scrollHeight })
const sinDesbordeHorizontal = async (page, ancho, que) => { const w = await page.evaluate(() => document.documentElement.scrollWidth); if (w > ancho) console.log(`  ⚠ ${que}: desplazamiento horizontal ${w}px (ventana ${ancho})`) }

// 1. Administrador: cada pestaña en los tres tamaños
for (const [rotulo, ancho, altoV] of TAMANOS) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: altoV }, locale: "es-EC", deviceScaleFactor: ancho < 500 ? 2 : 1 })
  const page = await entrar(ctx, "ADMIN")
  if (!page) { console.log("sin acceso a Pacientes a " + rotulo); await ctx.close(); continue }
  console.log("tamaño " + rotulo)
  for (const [nombre, tab] of [["citas", /^Citas|Citas \d/], ["resumen", /Resumen/], ["graduacion", /Graduación/], ["productos y servicios", /Productos y servicios/], ["ordenes de laboratorio", /Órdenes de laboratorio/]]) {
    await page.getByRole("tab", { name: tab }).first().click()
    await page.waitForTimeout(1200)
    const h = Math.min(6000, Math.max(altoV, Math.ceil(await alto(page))))
    await page.setViewportSize({ width: ancho, height: h })
    await foto(page, `perfil admin · ${nombre} · ${rotulo}`)
    await sinDesbordeHorizontal(page, ancho, `${nombre} a ${rotulo}`)
    await page.setViewportSize({ width: ancho, height: altoV })
  }
  await ctx.close()
}

// 2. Cada rol: la pestaña «Graduación» a 1366 px y sus ventanas
for (const rol of ["ADMIN", "OPTOMETRA", "RECEPCION", "VENTAS"]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "es-EC" })
  const page = await entrar(ctx, rol)
  if (!page) { console.log(rol + ": sin módulo Pacientes"); await ctx.close(); continue }
  const pestana = page.getByRole("tab", { name: /Graduación/ })
  const ve = await pestana.count()
  console.log(`${rol}: pestaña «Graduación» ${ve ? "SÍ" : "no"}`)
  if (ve) {
    await pestana.click()
    await page.getByRole("button", { name: "Explicar al paciente" }).waitFor({ timeout: 15000 })
    await foto(page, `perfil ${rol.toLowerCase()} · graduacion · 1366`)
    if (rol === "ADMIN" || rol === "OPTOMETRA") {
      await page.getByRole("button", { name: /Elegir otra receta/ }).click()
      await foto(page, `perfil ${rol.toLowerCase()} · graduacion selector abierto · 1366`)
      await page.getByRole("option", { name: /21 de noviembre de 2025/ }).click()
      await foto(page, `perfil ${rol.toLowerCase()} · graduacion receta anterior · 1366`)
      await page.getByRole("button", { name: "Explicar al paciente" }).click()
      await foto(page, `perfil ${rol.toLowerCase()} · explicar al paciente · 1366`)
      await page.getByRole("button", { name: "Volver a la vista técnica" }).click()
      await page.getByRole("button", { name: "Comparar dos recetas" }).click()
      await page.waitForSelector('[role="dialog"]')
      await foto(page, `perfil ${rol.toLowerCase()} · comparar recetas · 1366`)
    }
  }
  await ctx.close()
}
await browser.close()
console.log("Capturas en " + SALIDA)
