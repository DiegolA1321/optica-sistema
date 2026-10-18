import { chromium } from "@playwright/test"
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1093, height: 700 }, deviceScaleFactor: 1.25, locale: "es-EC" })
const page = await ctx.newPage()
await page.goto("http://localhost:5174/?optica=qu7u2j")
await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
await page.getByPlaceholder("Cédula o nombre de usuario").click(); await page.keyboard.insertText(process.env.DEMO_PORTAL_CEDULA)
await page.getByPlaceholder("Tu contraseña").click(); await page.keyboard.insertText(process.env.DEMO_PORTAL_CLAVE)
await page.getByRole("button", { name: "Entrar", exact: true }).click()
await page.waitForSelector(".pt-zona", { timeout: 20000 })
await page.waitForTimeout(2000)
const medir = async (etq) => {
  const r = await page.evaluate(() => {
    const s = document.querySelector("[data-portal-scroll]").getBoundingClientRect()
    const z = document.querySelector(".pt-zona").getBoundingClientRect()
    const hijos = [...document.querySelector(".pt-zona").children].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), e.tagName + "." + String(e.className).slice(0, 50)] })
    return { scroll: [Math.round(s.left), Math.round(s.width)], zona: [Math.round(z.left), Math.round(z.width)], hijos }
  })
  console.log(etq, JSON.stringify(r))
}
await medir("abierto Inicio")
await page.getByRole("button", { name: /Ocultar el menú|Mostrar el menú|menú/i }).first().click().catch((e) => console.log("sin botón menú"))
await page.waitForTimeout(600)
await medir("plegado Inicio")
for (const p of ["Mis citas", "Mi receta", "Mis compras", "Mis datos"]) {
  await page.getByRole("navigation", { name: "Menú del portal" }).getByRole("button", { name: p, exact: true }).click()
  await page.waitForTimeout(1000)
  await medir("plegado " + p)
}
await b.close()
