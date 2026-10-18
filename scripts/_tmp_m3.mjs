import { chromium } from "@playwright/test"
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1093, height: 800 }, deviceScaleFactor: 1, locale: "es-EC" })
const page = await ctx.newPage()
await page.goto("http://localhost:5174/?optica=qu7u2j")
await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
await page.getByPlaceholder("Cédula o nombre de usuario").click(); await page.keyboard.insertText(process.env.DEMO_PORTAL_CEDULA)
await page.getByPlaceholder("Tu contraseña").click(); await page.keyboard.insertText(process.env.DEMO_PORTAL_CLAVE)
await page.getByRole("button", { name: "Entrar", exact: true }).click()
await page.waitForSelector(".pt-zona", { timeout: 20000 })
await page.waitForTimeout(2000)
await page.getByRole("button", { name: /menú/i }).first().click()
await page.waitForTimeout(600)
const D = process.argv[2]
for (const p of ["Mis citas", "Mis compras"]) {
  await page.getByRole("navigation", { name: "Menú del portal" }).getByRole("button", { name: p, exact: true }).click()
  await page.waitForTimeout(1200)
  await page.screenshot({ path: D + "/p-" + p.replace(" ", "") + ".png" })
}
await b.close()
