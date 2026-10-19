// ¿Carga el mapa de la óptica en el portal? Entra con el paciente de demostración (sesión real) a la VERSIÓN COMPILADA (la que lleva la política CSP: `vite build` + `vite preview`),
// abre «La óptica», y mira si el marco de Google Maps se carga (respuesta del servidor, errores de CSP y ancho del marco). Solo lee.
//   node --env-file=.env.test scripts/verificar-mapa-portal.mjs [puerto]
import { chromium } from "@playwright/test"

const BASE = `http://localhost:${process.argv[2] || "5176"}`
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: "es-EC" })
const page = await ctx.newPage()
const consola = []
page.on("console", (m) => { if (/Content Security Policy|frame-src|Refused/i.test(m.text())) consola.push(m.text().slice(0, 200)) })
const respuestas = []
page.on("response", (r) => { if (/google\.com\/maps/.test(r.url())) respuestas.push(`${r.status()} ${r.url().slice(0, 90)}`) })
await page.goto(`${BASE}/?optica=qu7u2j`)
await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
await page.getByPlaceholder("Cédula o nombre de usuario").click()
await page.keyboard.insertText(process.env.DEMO_PORTAL_CEDULA)
await page.getByPlaceholder("Tu contraseña").click()
await page.keyboard.insertText(process.env.DEMO_PORTAL_CLAVE)
await page.getByRole("button", { name: "Entrar", exact: true }).click()
await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector("nav"), null, { timeout: 30000 })
await page.waitForTimeout(1500)
await page.getByRole("button", { name: /Ver el horario completo/ }).first().click()
const marco = page.locator("iframe[title^='Mapa de']")
await marco.waitFor({ timeout: 10000 })
await page.waitForTimeout(6000)
const caja = await marco.boundingBox()
const frame = page.frames().find((f) => /google\.com\/maps/.test(f.url()))
let titulo = "", cuerpo = 0
if (frame) { titulo = await frame.title().catch(() => ""); cuerpo = (await frame.evaluate(() => document.body?.innerText?.length ?? 0).catch(() => 0)) }
console.log("Marco en la página:", caja ? `${Math.round(caja.width)}×${Math.round(caja.height)} px` : "no")
console.log("Respuestas de google.com/maps:", respuestas.length ? respuestas.join(" | ") : "ninguna")
console.log("Dirección del marco:", frame ? frame.url().slice(0, 100) : "el marco no navegó")
console.log("Título del documento del marco:", titulo || "(vacío)", "· texto:", cuerpo, "caracteres")
console.log("Errores de CSP en la consola:", consola.length ? consola.join(" | ") : "ninguno")
await page.screenshot({ path: process.argv[3] || "mapa-portal.png" })
await browser.close()
