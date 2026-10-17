// Revisión SOLO DE LECTURA de todo el sistema en celular (390), tablet (768) y laptop (1366×768): los módulos del personal con cada rol (Óptica Demo, que es de
// solo lectura: cualquier escritura se cancela), el panel del superadmin y las páginas públicas. Mide el desplazamiento horizontal, lo que se sale de la
// pantalla, los botones pequeños y si el menú se adapta; deja capturas de lo que se mide. NO corrige nada.
//
// La guarda de tamaño del sistema (ResolutionGuard) bloquea al personal y al superadmin por debajo de 950 px: para poder ver cada pantalla se le hace creer que
// la ventana es de 1366 px (solo para el script; el CSS sí usa el ancho real).
//
//   node --env-file=.env.local --env-file=.env.test scripts/revision-adaptable.mjs <carpeta-de-capturas> <salida.json>
//   (con SUPERADMIN_EMAIL y SUPERADMIN_PASSWORD en el entorno revisa también el panel del superadmin)
import { chromium } from "@playwright/test"
import fs from "node:fs"
import path from "node:path"
import { protegerDemo } from "../e2e/guardia-demo.js"

const BASE = `http://localhost:${process.env.E2E_PUERTO || "5174"}`
const CAPTURAS = path.resolve(process.argv[2] || "revision-capturas")
const SALIDA = path.resolve(process.argv[3] || "revision-adaptable.json")
const TAMANOS = [["celular", 390, 844], ["tablet", 768, 1024], ["laptop", 1366, 768]]
const ROLES = [["ADMIN", "Administrador"], ["OPTOMETRA", "Optómetra"], ["RECEPCION", "Recepción"], ["VENTAS", "Ventas"]]
fs.mkdirSync(CAPTURAS, { recursive: true })
const resultados = []
const nota = (r) => { resultados.push(r); console.log(JSON.stringify({ ...r, ofensores: (r.ofensores || []).length })) }

const espiarGuarda = `
  Object.defineProperty(window, 'outerWidth', { get: () => 1366 });
  Object.defineProperty(window, 'innerWidth', { get: () => 1366 });
  Object.defineProperty(window, 'innerHeight', { get: () => 768 });
  Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 });
`
// Mide la página actual: desplazamiento horizontal, elementos fuera de pantalla y botones pequeños.
const medir = (page) => page.evaluate(() => {
  const ancho = document.documentElement.clientWidth
  const visible = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" }
  const recortado = (e) => { for (let p = e.parentElement; p; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === "auto" || o === "hidden" || o === "scroll") && p.getBoundingClientRect().width <= ancho + 1) return true } return false }
  const ofensores = []
  for (const e of document.body.querySelectorAll("*")) {
    if (!visible(e)) continue
    const r = e.getBoundingClientRect()
    if (r.right > ancho + 1 && !recortado(e) && getComputedStyle(e).position !== "fixed") ofensores.push((e.tagName.toLowerCase() + "." + String(e.className || "").toString().split(" ").slice(0, 3).join(".") + " «" + (e.textContent || "").trim().slice(0, 30) + "» +" + Math.round(r.right - ancho) + "px"))
    if (ofensores.length >= 6) break
  }
  const pequenos = [...document.querySelectorAll("button, a[href], [role=tab], select, input:not([type=hidden])")].filter(visible).filter((b) => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44 }).length
  const textoChico = [...document.querySelectorAll("main *")].filter((e) => visible(e) && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(getComputedStyle(e).fontSize) < 14).length
  const scroll = document.documentElement.scrollWidth - ancho
  const bloqueado = !!document.body.innerText.match(/Nivel de Zoom No Soportado/)
  return { ancho, desplazamientoHorizontal: Math.max(0, scroll), ofensores, botonesMenoresDe44: pequenos, textosMenoresDe14: textoChico, bloqueado }
})

async function iniciar(browser, ancho, alto, conEspia) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, locale: "es-EC" })
  if (conEspia) await ctx.addInitScript(espiarGuarda)
  const page = await ctx.newPage()
  return { ctx, page }
}
const escribir = async (page, loc, valor) => { await loc.click(); await page.keyboard.press("Control+A"); await page.keyboard.press("Delete"); await page.keyboard.insertText(valor) }

async function entrarPersonal(page, rol) {
  await protegerDemo(page)
  await page.goto(`${BASE}/?optica=qu7u2j`)
  await page.getByRole("button", { name: "Iniciar sesión" }).first().click()
  await escribir(page, page.getByPlaceholder("Cédula o nombre de usuario"), process.env[`DEMO_${rol}_EMAIL`])
  await escribir(page, page.getByPlaceholder("Tu contraseña"), process.env[`DEMO_${rol}_PASSWORD`])
  await page.getByRole("button", { name: "Entrar", exact: true }).click()
  await page.waitForFunction(() => !document.body.innerText.includes("Iniciar sesión") || !!document.querySelector("aside nav"), null, { timeout: 40_000 })
  await page.waitForTimeout(2500)
}

async function modulos(page) {
  return page.evaluate(() => [...document.querySelectorAll("aside nav button")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()).filter(Boolean))
}
async function irA(page, nombre, ancho) {
  if (ancho < 1024) { const m = page.getByRole("button", { name: "Abrir menú" }); if (await m.count()) await m.first().click().catch(() => {}); await page.waitForTimeout(300) }
  const b = page.locator("aside nav button").filter({ hasText: nombre }).first()
  await b.click({ timeout: 8000 })
  await page.waitForTimeout(1800)
}

try {
  const browser = await chromium.launch()
  for (const [tam, ancho, alto] of TAMANOS) {
    // ── Páginas públicas ──
    {
      const { ctx, page } = await iniciar(browser, ancho, alto, false)
      const publicas = [
        ["Página de la óptica", `${BASE}/?optica=qu7u2j`, null],
        ["Página de venta del sistema", `${BASE}/?sitio=venta`, null],
        ["Política de privacidad", `${BASE}/?optica=qu7u2j&legal=privacidad`, null],
        ["Términos", `${BASE}/?optica=qu7u2j&legal=terminos`, null],
      ]
      for (const [nombre, url] of publicas) {
        await page.goto(url); await page.waitForTimeout(3500)
        const m = await medir(page)
        await page.screenshot({ path: path.join(CAPTURAS, `${tam}-publica-${nombre.replace(/\W+/g, "-")}.png`), fullPage: true })
        nota({ tamano: tam, rol: "Público", modulo: nombre, ...m })
      }
      // Inicio de sesión (ventana) y reserva de cita sin cuenta
      await page.goto(`${BASE}/?optica=qu7u2j`); await page.waitForTimeout(2500)
      await page.getByRole("button", { name: "Iniciar sesión" }).first().click().catch(() => {})
      await page.waitForTimeout(800)
      nota({ tamano: tam, rol: "Público", modulo: "Ventana de inicio de sesión", ...(await medir(page)) })
      await page.screenshot({ path: path.join(CAPTURAS, `${tam}-publica-login.png`) })
      await page.goto(`${BASE}/?optica=qu7u2j`); await page.waitForTimeout(2500)
      const reservar = page.getByRole("button", { name: /Solicita|Agendar|Reserva|cita/i }).first()
      if (await reservar.count()) { await reservar.click().catch(() => {}); await page.waitForTimeout(2000) }
      nota({ tamano: tam, rol: "Público", modulo: "Reserva de cita sin cuenta", ...(await medir(page)) })
      await page.screenshot({ path: path.join(CAPTURAS, `${tam}-publica-reserva.png`), fullPage: true })
      await ctx.close()
    }
    // ── Personal, con cada rol ──
    for (const [rol, nombreRol] of ROLES) {
      const { ctx, page } = await iniciar(browser, ancho, alto, true)
      try {
        await entrarPersonal(page, rol)
        let mods = await modulos(page)
        if (ancho < 1024 && mods.length === 0) { await page.getByRole("button", { name: "Abrir menú" }).first().click().catch(() => {}); await page.waitForTimeout(400); mods = await modulos(page) }
        const hayMenu = ancho >= 1024 ? true : (await page.getByRole("button", { name: "Abrir menú" }).count()) > 0
        nota({ tamano: tam, rol: nombreRol, modulo: "(menú)", menuAdaptado: hayMenu, modulosVistos: mods.length })
        for (const mod of mods) {
          try {
            await irA(page, mod, ancho)
            const m = await medir(page)
            const archivo = `${tam}-${rol}-${mod.replace(/\W+/g, "-")}.png`
            await page.screenshot({ path: path.join(CAPTURAS, archivo) })
            nota({ tamano: tam, rol: nombreRol, modulo: mod, ...m })
          } catch (e) { nota({ tamano: tam, rol: nombreRol, modulo: mod, error: e.message.split("\n")[0] }) }
        }
      } catch (e) { nota({ tamano: tam, rol: nombreRol, modulo: "(entrada)", error: e.message.split("\n")[0] }) }
      await ctx.close()
    }
    // ── Superadmin ──
    if (process.env.SUPERADMIN_EMAIL && process.env.SUPERADMIN_PASSWORD) {
      const { ctx, page } = await iniciar(browser, ancho, alto, true)
      try {
        await page.goto(`${BASE}/?sitio=admin`)
        await escribir(page, page.locator("#usuario-solo"), process.env.SUPERADMIN_EMAIL)
        await escribir(page, page.locator("#password-solo"), process.env.SUPERADMIN_PASSWORD)
        await page.getByRole("button", { name: "Entrar", exact: true }).click()
        await page.waitForTimeout(6000)
        nota({ tamano: tam, rol: "Superadmin", modulo: "(entrada)", ...(await medir(page)) })
        await page.screenshot({ path: path.join(CAPTURAS, `${tam}-superadmin-inicio.png`) })
        const items = await page.evaluate(() => [...document.querySelectorAll("aside nav button, nav button")].map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim()).filter(Boolean))
        for (const it of [...new Set(items)].slice(0, 12)) {
          try {
            if (ancho < 1024) { const m = page.getByRole("button", { name: "Abrir menú" }); if (await m.count()) await m.first().click().catch(() => {}); await page.waitForTimeout(300) }
            await page.locator("aside nav button, nav button").filter({ hasText: it }).first().click({ timeout: 6000 })
            await page.waitForTimeout(1800)
            nota({ tamano: tam, rol: "Superadmin", modulo: it, ...(await medir(page)) })
            await page.screenshot({ path: path.join(CAPTURAS, `${tam}-superadmin-${it.replace(/\W+/g, "-")}.png`) })
          } catch (e) { nota({ tamano: tam, rol: "Superadmin", modulo: it, error: e.message.split("\n")[0] }) }
        }
      } catch (e) { nota({ tamano: tam, rol: "Superadmin", modulo: "(entrada)", error: e.message.split("\n")[0] }) }
      await ctx.close()
    }
  }
  await browser.close()
} finally {
  fs.writeFileSync(SALIDA, JSON.stringify(resultados, null, 1))
}
console.log("Listo: " + resultados.length + " mediciones en " + SALIDA)
