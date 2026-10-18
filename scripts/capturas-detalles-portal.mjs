// Capturas del portal con el paciente de demostración (Demo, solo LEE: no confirma, no califica, no agenda): cada pantalla y cada ventana de detalle, a 1366 y 390 px (y las pantallas
// también a 1920 px, para ver el ancho del contenido), a 2x.
//   node --env-file=.env.test scripts/capturas-detalles-portal.mjs <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"

const SALIDA = path.resolve(process.argv[2] || "capturas-detalles")
const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
fs.mkdirSync(SALIDA, { recursive: true })
const PANTALLAS = [["Inicio", "Inicio"], ["Mis citas", "Mis citas"], ["Mi receta", "Mi receta"], ["Mis compras", "Mis compras"], ["Mis datos", "Mis datos"]]
// [pantalla, nombre del botón que cubre la tarjeta, nombre del archivo]
const DETALLES = [
  ["Inicio", /Ver el detalle de tu próxima cita/, "cita proxima"],
  ["Inicio", /Ver el detalle del pedido de tus lentes|Ver el detalle del pedido de/, "pedido de lentes"],
  ["Inicio", /Ver tu receta completa/, "graduacion"],
  ["Inicio", /por pagar. Ver el detalle/, "saldo"],
  ["Inicio", /Ver cómo sumas tus puntos/, "puntos"],
  ["Inicio", /¿Cómo te atendimos.*Ver el detalle/, "calificar visita"],
  ["Inicio", /Ver por qué se recomienda/, "control"],
  ["Inicio", /Ver el horario completo/, "optica"],
  ["Mis citas", /Ver el detalle de tu próxima cita/, "cita proxima desde Mis citas"],
  ["Mis citas", /Ver el detalle de tu cita del/, "cita anterior"],
  ["Mi receta", /Ver la receta del/, "receta anterior"],
  ["Mi receta", /^Comparar dos recetas$/, "comparar recetas"],
  ["Mis compras", /Ver el detalle de tu compra/, "compra"],
  ["Mis datos", /Pedir que eliminen mi cuenta/, "eliminar cuenta"],
]
const browser = await chromium.launch()
for (const [tam, ancho, alto] of [["laptop", 1366, 768], ["celular", 390, 844], ["grande", 1920, 1080]]) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, deviceScaleFactor: tam === "grande" ? 1 : 2, locale: "es-EC" })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/?optica=qu7u2j`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await page.getByPlaceholder("Cédula o nombre de usuario").click()
  await page.keyboard.insertText(process.env.DEMO_PORTAL_CEDULA)
  await page.getByPlaceholder("Tu contraseña").click()
  await page.keyboard.insertText(process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]') && document.querySelector("nav"), null, { timeout: 30000 })
  await page.waitForTimeout(1500)
  const ir = async (boton) => {
    await page.getByRole("navigation", { name: "Menú del portal" }).filter({ visible: true }).getByRole("button", { name: new RegExp("^" + boton + "$") }).click()
    await page.waitForTimeout(1200)
  }
  for (const [boton, nombre] of PANTALLAS) {
    if (boton !== "Inicio") await ir(boton)
    const h = await page.evaluate(() => { const e = document.querySelector("[data-portal-scroll]"); return e ? e.scrollHeight + e.getBoundingClientRect().top + 8 : document.body.scrollHeight })
    await page.setViewportSize({ width: ancho, height: Math.min(5000, Math.max(alto, Math.ceil(h))) })
    await page.waitForTimeout(400)
    await page.screenshot({ path: path.join(SALIDA, `${nombre} · ${tam}.png`) })
    await page.setViewportSize({ width: ancho, height: alto })
  }
  if (tam === "grande") { await ctx.close(); continue }
  let actual = ""
  for (const [pantalla, nombreBoton, archivo] of DETALLES) {
    if (actual !== pantalla) { await ir(pantalla); actual = pantalla }
    const boton = page.getByRole("button", { name: nombreBoton }).first()
    if (!(await boton.count())) { console.log("sin tarjeta:", archivo); continue }
    await boton.scrollIntoViewIfNeeded()
    await boton.click({ position: { x: 6, y: 6 } })
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
    await page.waitForTimeout(700)
    // ¿La ventana tiene barra de desplazamiento? Solo debe tenerla si su contenido no cabe en la pantalla.
    const scroll = await page.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const c = d && [...d.querySelectorAll('div')].find((e) => getComputedStyle(e).overflowY === 'auto'); return c ? c.scrollHeight - c.clientHeight : 0 })
    console.log(`${tam} · ${archivo}: ${scroll > 1 ? 'DESPLAZA ' + scroll + ' px' : 'sin desplazamiento'}`)
    await page.screenshot({ path: path.join(SALIDA, `detalle ${archivo} · ${tam}.png`) })
    await page.keyboard.press("Escape")
    await page.waitForSelector('[role="dialog"]', { state: "detached", timeout: 5000 }).catch(() => {})
  }
  // «Agendar cita» con la lista del motivo abierta (flota encima del calendario)
  await ir("Mis citas")
  await page.getByRole("button", { name: "Agendar cita" }).first().click()
  await page.getByRole("combobox", { name: "Motivo de la cita" }).click()
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SALIDA, `agendar con la lista abierta · ${tam}.png`) })
  await ctx.close()
}
await browser.close()
console.log("Capturas en " + SALIDA)
