import { chromium } from "@playwright/test"
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1093, height: 700 }, deviceScaleFactor: 1.25, locale: "es-EC" })
const page = await ctx.newPage()
await page.goto("http://localhost:5174/?optica=qu7u2j")
await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
await page.getByPlaceholder("Cédula o nombre de usuario").click(); await page.keyboard.insertText(process.env.DEMO_ADMIN_EMAIL)
await page.getByPlaceholder("Tu contraseña").click(); await page.keyboard.insertText(process.env.DEMO_ADMIN_PASSWORD)
await page.getByRole("button", { name: "Entrar", exact: true }).click()
await page.waitForTimeout(5000)
await page.getByRole("button", { name: "Pacientes", exact: true }).first().click()
await page.getByRole("textbox", { name: /buscar paciente/i }).fill("Paciente Demostración Portal")
const fila = page.getByRole("row").filter({ hasText: "Paciente Demostración Portal" })
await fila.getByRole("button", { name: /Ver perfil 360/ }).waitFor({ timeout: 30000 })
await page.waitForTimeout(3000)
await fila.getByRole("button", { name: /Ver perfil 360/ }).click()
await page.getByRole("tab", { name: /Citas/ }).waitFor()
await page.waitForTimeout(1500)
const medir = async (etq) => {
  const r = await page.evaluate(() => {
    const tab = document.querySelector('[role="tablist"]')
    const cadena = []
    for (let e = tab; e && e !== document.body; e = e.parentElement) { const r = e.getBoundingClientRect(); cadena.push([Math.round(r.left), Math.round(r.width), e.tagName + "." + String(e.className).slice(0, 70), getComputedStyle(e).maxWidth]) }
    return cadena
  })
  console.log(etq); r.forEach((x) => console.log("  ", JSON.stringify(x)))
}
await page.getByRole("button",{name:"Colapsar menú"}).click();await page.waitForTimeout(800);await medir("plegado")
console.log(await page.locator("aside, nav").first().evaluate((e) => e.className.slice(0, 100)))
await page.screenshot({ path: process.argv[2] + "/m2-plegado.png" })
await b.close()
