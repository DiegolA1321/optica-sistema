// Capturas del perfil del paciente del sistema del personal a 1366 px (la graduación compartida con el portal), con cada rol de la Óptica Demo (solo LEE).
// Dice, por rol, si ve la sección «Graduación del paciente» y el botón «Explicar al paciente» (solo quien tiene permiso de fichas clínicas).
//   node --env-file=.env.test scripts/capturas-perfil-graduacion.mjs <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "capturas-perfil")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
fs.mkdirSync(SALIDA, { recursive: true })
const PACIENTE = "Paciente Demostración Portal"
const browser = await chromium.launch()
for (const rol of ["ADMIN", "OPTOMETRA", "RECEPCION", "VENTAS"]) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: "es-EC" })
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
  const menu = page.getByRole("button", { name: "Pacientes", exact: true }).first()
  if (!(await menu.count())) { console.log(rol + ": sin módulo Pacientes"); await ctx.close(); continue }
  await menu.click()
  await page.getByRole("textbox", { name: /buscar paciente/i }).fill(PACIENTE)
  await page.getByText(PACIENTE, { exact: false }).first().click()
  await page.getByRole("tab", { name: /Citas/ }).waitFor({ timeout: 20000 })
  const resumen = page.getByRole("tab", { name: /Resumen/ })
  if (await resumen.count()) await resumen.click()
  await page.waitForTimeout(1500)
  const seccion = page.getByRole("region", { name: "Graduación del paciente" })
  const hay = await seccion.count()
  const explicar = await page.getByRole("button", { name: "Explicar al paciente" }).count()
  console.log(`${rol}: sección de graduación ${hay ? "SÍ" : "no"} · «Explicar al paciente» ${explicar ? "SÍ" : "no"}`)
  const h = await page.evaluate(() => document.documentElement.scrollWidth)
  if (h > 1366) console.log(`  ⚠ desplazamiento horizontal: ${h}px`)
  await page.screenshot({ path: path.join(SALIDA, `perfil ${rol.toLowerCase()} · 1366.png`) })
  if (hay) {
    await seccion.scrollIntoViewIfNeeded()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(SALIDA, `perfil ${rol.toLowerCase()} graduacion · 1366.png`) })
    if (rol === "ADMIN" || rol === "OPTOMETRA") {
      await page.getByRole("button", { name: "Explicar al paciente" }).click()
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(SALIDA, `perfil ${rol.toLowerCase()} explicar al paciente · 1366.png`) })
      await page.keyboard.press("Escape")
      await page.waitForTimeout(400)
      await seccion.getByRole("button", { name: "Comparar dos recetas" }).click()
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(SALIDA, `perfil ${rol.toLowerCase()} comparar · 1366.png`) })
      await page.keyboard.press("Escape")
      await page.waitForTimeout(400)
      await seccion.getByRole("button", { name: /Ver la receta del/ }).first().click()
      await page.waitForSelector('[role="dialog"]')
      await page.waitForTimeout(700)
      await page.screenshot({ path: path.join(SALIDA, `perfil ${rol.toLowerCase()} detalle de receta · 1366.png`) })
    }
  }
  await ctx.close()
}
await browser.close()
console.log("Capturas en " + SALIDA)
