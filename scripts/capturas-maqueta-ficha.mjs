// Capturas de la maqueta de la ficha clínica en cinco pasos (docs/maquetas/ficha-cinco-pasos.html) a 1093 px de ancho: es una propuesta, no el sistema.
//   node scripts/capturas-maqueta-ficha.mjs <carpeta-de-salida>
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { pathToFileURL } from "node:url"

const SALIDA = path.resolve(process.argv[2] || "docs/ficha-cinco-pasos-propuesta")
const ARCHIVO = pathToFileURL(path.resolve("docs/maquetas/ficha-cinco-pasos.html")).href
fs.mkdirSync(SALIDA, { recursive: true })
const NOMBRES = ["anamnesis", "agudeza-visual", "refraccion", "salud-ocular", "diagnostico-y-receta"]
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1093, height: 800 } })
for (let n = 1; n <= 5; n++) {
  await page.goto(`${ARCHIVO}?paso=${n}`)
  await page.waitForTimeout(300)
  await page.screenshot({ path: path.join(SALIDA, `paso-${n}-${NOMBRES[n - 1]}-1093.png`), fullPage: true })
}
await browser.close()
console.log("Listo:", SALIDA)
