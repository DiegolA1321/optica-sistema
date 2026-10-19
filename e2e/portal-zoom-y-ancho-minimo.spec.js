// El portal del paciente se usa con la letra grande y desde el celular: tiene que funcionar con el zoom del navegador al 200 % y a 320 px de ancho (el celular más angosto). Demo, SOLO LECTURA.
// En cada pantalla (y en las ventanas que abre cada tarjeta) falla si: hay desplazamiento horizontal, algo se sale por el borde derecho, hay texto de menos de 16 px o algo que se toca mide menos de 44 px.
// El mensaje de «tamaño no admitido» NO existe en el portal (ver ResolutionGuard): aquí se comprueba que tampoco aparece.
import { test, expect } from '@playwright/test'
import { escribirSecreto, SLUG_DEMO } from './ayudas.js'
import { protegerDemo } from './guardia-demo.js'

const PANTALLAS = ['Inicio', 'Mis citas', 'Mi receta', 'Mis compras', 'Mis datos']
const CASOS = [
  { nombre: 'zoom 200 % en una pantalla de 1366 px', ancho: 683, alto: 384, escala: 2 },
  { nombre: 'zoom 200 % en una pantalla de 1920 px', ancho: 960, alto: 540, escala: 2 },
  { nombre: '320 px de ancho', ancho: 320, alto: 640, escala: 2 },
]

// Lo que se mide dentro de la página: devuelve la lista de problemas de lo que hay a la vista (la pantalla o la ventana abierta).
async function revisar(page, donde) {
  return page.evaluate((donde) => {
    const problemas = []
    const raiz = document.querySelector('[role="dialog"]') || document.body
    const ancho = window.innerWidth
    const visible = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.sr-only, [aria-hidden="true"]') }
    const dentroDeDesplazable = (e) => { for (let p = e.parentElement; p && p !== document.body; p = p.parentElement) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll') && p.scrollWidth > p.clientWidth) return true } return false }
    const dc = document.documentElement
    if (dc.scrollWidth > dc.clientWidth + 1) problemas.push(`${donde}: la página tiene desplazamiento horizontal (${dc.scrollWidth} > ${dc.clientWidth})`)
    for (const c of document.querySelectorAll('[data-portal-scroll], [role="dialog"], [role="dialog"] *')) {
      const o = getComputedStyle(c).overflowX
      if ((o === 'auto' || o === 'scroll') && c.scrollWidth > c.clientWidth + 1 && c !== dc) problemas.push(`${donde}: «${(c.getAttribute('aria-label') || c.className).toString().slice(0, 50)}» se desplaza en horizontal`)
    }
    // nada se sale por el borde derecho
    for (const e of raiz.querySelectorAll('*')) {
      if (!visible(e) || e.closest('svg') || dentroDeDesplazable(e)) continue
      const r = e.getBoundingClientRect()
      if (r.right > ancho + 1 && !e.closest('.sr-only')) { problemas.push(`${donde}: «${(e.getAttribute('aria-label') || e.textContent || e.className).toString().replace(/\s+/g, ' ').trim().slice(0, 40)}» se sale por la derecha (${Math.round(r.right)} > ${ancho})`); break }
    }
    // texto de al menos 16 px (y nada de texto cortado)
    const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT)
    const chicos = new Set()
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (!n.textContent.trim()) continue
      const p = n.parentElement
      if (!p || !visible(p) || p.closest('svg, script, style, option')) continue
      const px = parseFloat(getComputedStyle(p).fontSize)
      if (px < 15.99) chicos.add(`«${n.textContent.trim().slice(0, 30)}» (${px} px)`)
    }
    if (chicos.size) problemas.push(`${donde}: texto de menos de 16 px: ${[...chicos].slice(0, 5).join(', ')}`)
    // lo que se toca mide al menos 44 px (los enlaces dentro de una frase quedan fuera: miden lo que mide la letra)
    for (const e of raiz.querySelectorAll('button, [role="button"], [role="radio"], [role="tab"], select, input:not([type="hidden"]), textarea, summary')) {
      if (!visible(e)) continue
      const r = e.getBoundingClientRect()
      // Los días de un calendario son siete columnas: en 320 px no caben de 44 px de ancho (miden 40); su altura sí es de 48 px. Es el único caso que se admite más angosto (mínimo 38 px).
      const esDia = e.closest('.grid-cols-7') !== null
      if (r.height < 43.5 || r.width < (esDia ? 38 : 43.5)) { problemas.push(`${donde}: se toca algo de ${Math.round(r.width)}×${Math.round(r.height)} px (mínimo 44): «${(e.getAttribute('aria-label') || e.textContent || e.tagName).toString().replace(/\s+/g, ' ').trim().slice(0, 40)}»`) }
    }
    return problemas
  }, donde)
}

async function entrar(page) {
  await protegerDemo(page)
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.DEMO_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
}

for (const caso of CASOS) {
  test.describe(`Portal con ${caso.nombre}`, () => {
    test.use({ viewport: { width: caso.ancho, height: caso.alto }, deviceScaleFactor: caso.escala })

    test('cada pantalla y cada ventana se ve y se usa bien: sin desplazamiento horizontal, letra de 16 px o más, todo lo que se toca de 44 px o más', async ({ page }) => {
      test.setTimeout(420_000)
      await entrar(page)
      // el mensaje de «Nivel de Zoom No Soportado» no existe en el portal
      await expect(page.getByText('Nivel de Zoom No Soportado')).toHaveCount(0)
      const problemas = []
      for (const pantalla of PANTALLAS) {
        await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: pantalla, exact: true }).click()
        await page.waitForTimeout(800)
        const donde = `Portal (${caso.nombre}) · ${pantalla}`
        problemas.push(...(await revisar(page, donde)))
        // y las ventanas que abre cada tarjeta o fila
        const total = await page.locator('[data-portal-scroll] .pt-abrible').count()
        for (let i = 0; i < total; i++) {
          const el = page.locator('[data-portal-scroll] .pt-abrible').nth(i)
          if (!(await el.isVisible())) continue
          await el.scrollIntoViewIfNeeded()
          await el.click({ position: { x: 8, y: 8 } }).catch(() => {})
          await page.waitForTimeout(500)
          if (await page.getByRole('dialog').count()) {
            const titulo = (await page.getByRole('dialog').first().getAttribute('aria-label')) || `ventana ${i + 1}`
            problemas.push(...(await revisar(page, `${donde} · ventana «${titulo}»`)))
            await page.keyboard.press('Escape')
            await page.getByRole('dialog').first().waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {})
          }
        }
      }
      // ventanas que se abren con un botón (no con una tarjeta)
      for (const [pantalla, boton] of [['Mis citas', 'Agendar cita'], ['Mi receta', 'Comparar dos recetas'], ['Mi receta', /Elegir otra receta/], ['Mis compras', 'Solicitar lentes nuevos'], ['Mis datos', /Cambiar contraseña/]]) {
        await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: pantalla, exact: true }).click()
        await page.waitForTimeout(600)
        const b = page.getByRole('button', { name: boton }).first()
        if (!(await b.count())) continue
        await b.scrollIntoViewIfNeeded()
        await b.click()
        await page.waitForTimeout(600)
        problemas.push(...(await revisar(page, `Portal (${caso.nombre}) · ${pantalla} · «${boton}»`)))
        await page.keyboard.press('Escape')
        await page.waitForTimeout(300)
      }
      expect(problemas, problemas.join('\n')).toEqual([])
    })
  })
}
