// Capturas del portal con el paciente de demostración (Demo, solo LEE) a 1366 y 390 px, a 2x y pantalla completa, con los mismos nombres que las imágenes aprobadas de
// `docs/portal-propuesta/`, para ponerlas una junto a la otra.
//   node --env-file=.env.test scripts/comparar-portal.mjs <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "capturas-portal")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
fs.mkdirSync(SALIDA, { recursive: true })
const PANTALLAS = [["Inicio", "Resumen"], ["Mis citas", "Mis citas"], ["Mi receta", "Mi receta"], ["Mis compras", "Mis compras"], ["Mis datos", "Mis datos"]]
const browser = await chromium.launch()
for (const [tam, ancho, alto] of [["laptop", 1366, 768], ["celular", 390, 844]]) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: 2, locale: "es-EC" })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?optica=qu7u2j`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click()
  await page.keyboard.insertText(process.env.DEMO_PORTAL_CEDULA)
  await page.getByPlaceholder("Tu contraseña").click()
  await page.keyboard.insertText(process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForSelector('[data-portal-listo]', { timeout: 30000 }).catch(() => {})
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector("nav"), null, { timeout: 30000 })
  await page.waitForTimeout(1200)
  for (const [boton, nombre] of PANTALLAS) {
    if (nombre !== "Resumen") {
      await page.getByRole("navigation", { name: "Menú del portal" }).filter({ visible: true }).getByRole("button", { name: new RegExp("^" + boton + "$") }).click()
      await page.waitForTimeout(1200)
    }
    const h = await page.evaluate(() => { const e = document.querySelector("[data-portal-scroll]") || document.querySelector("main > div.overflow-y-auto"); return e ? e.scrollHeight + e.getBoundingClientRect().top + 8 : document.body.scrollHeight })
    await page.setViewportSize({ width: ancho, height: Math.min(5000, Math.max(alto, Math.ceil(h))) })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SALIDA, `${nombre} · ${tam}.png`) })
    await page.setViewportSize({ width: ancho, height: alto })
  }
  await ctx.close()
}
await browser.close()
console.log("Capturas en " + SALIDA)
