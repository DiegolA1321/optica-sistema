// Pone cada captura del portal (de scripts/comparar-portal.mjs) al lado de la imagen aprobada de `docs/portal-propuesta/` en una sola imagen: aprobada a la izquierda, la
// implementada a la derecha, para compararlas punto por punto.
//   node scripts/lado-a-lado-portal.mjs <carpeta-de-capturas> <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const CAPTURAS = path.resolve(process.argv[2] || "capturas-portal")
const SALIDA = path.resolve(process.argv[3] || "lado-a-lado")
const APROBADAS = path.resolve("docs/portal-propuesta")
fs.mkdirSync(SALIDA, { recursive: true })
const PARES = ["Resumen · laptop", "Resumen · celular", "Mis citas · laptop", "Mi receta · laptop", "Mis compras · laptop", "Mis datos · laptop"]
const browser = await chromium.launch()
for (const nombre of PARES) {
  const celular = nombre.includes("celular")
  const ancho = celular ? 1000 : 2000
  const html = `<body style="margin:0;background:#888;font:600 20px sans-serif;color:#fff"><div style="display:flex;gap:12px;align-items:flex-start;width:${ancho}px">
    <div style="flex:1;min-width:0"><div style="padding:6px">APROBADA</div><img style="width:100%;display:block" src="${pathToFileURL(path.join(APROBADAS, nombre + ".png"))}"></div>
    <div style="flex:1;min-width:0"><div style="padding:6px">IMPLEMENTADA</div><img style="width:100%;display:block" src="${pathToFileURL(path.join(CAPTURAS, nombre + ".png"))}"></div></div></body>`
  const page = await browser.newPage({ viewport: { width: ancho, height: 800 } })
  const tmp = path.join(SALIDA, "_tmp.html")
  fs.writeFileSync(tmp, html)
  await page.goto(pathToFileURL(tmp).href)
  await page.waitForLoadState("load")
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(SALIDA, nombre + ".png"), fullPage: true })
  await page.close()
}
fs.rmSync(path.join(SALIDA, "_tmp.html"), { force: true })
await browser.close()
console.log("Comparaciones en " + SALIDA)
