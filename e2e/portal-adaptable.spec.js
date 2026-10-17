// El portal no tiene desplazamiento horizontal ni nada cortado a 390 px (celular), 768 px (tablet) y 1366 px (laptop); el texto del contenido es de 16 px o más y
// todo lo que se toca mide al menos 44 px (regla 48 de docs/principios-diseno.md). Solo lee: entra con el paciente fijo del portal en la óptica de pruebas.
import { test, expect } from '@playwright/test'
import { escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

const TAMANOS = [['celular', 390, 844], ['tablet', 768, 1024], ['laptop', 1366, 768]]
const SECCIONES = ['Resumen', 'Mis citas', 'Mi receta', 'Mis compras', 'Mis datos']

for (const [nombre, ancho, alto] of TAMANOS) {
  test(`Portal a ${ancho} px (${nombre}): sin desplazamiento horizontal, texto de 16 px y botones de 44 px`, async ({ page }) => {
    test.setTimeout(120_000)
    await page.setViewportSize({ width: ancho, height: alto })
    // La página pública y el inicio de sesión también.
    await page.goto(`/?optica=${SLUG_PRUEBAS}`)
    await expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible({ timeout: 20_000 })
    const sinScroll = () => page.evaluate(() => ({ ancho: window.innerWidth, doc: document.documentElement.scrollWidth, body: document.body.scrollWidth }))
    let m = await sinScroll()
    expect(m.doc, 'página pública').toBeLessThanOrEqual(m.ancho)
    await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
    const dialogo = page.getByRole('dialog').first()
    await expect(page.getByPlaceholder('Cédula o nombre de usuario')).toBeVisible()
    m = await sinScroll()
    expect(m.doc, 'ventana de inicio de sesión').toBeLessThanOrEqual(m.ancho)
    await expect(page.getByText('¿Olvidaste tu contraseña? Comunícate con la óptica')).toBeVisible()
    void dialogo
    await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.E2E_PORTAL_CEDULA)
    await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })

    for (const seccion of SECCIONES) {
      await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: seccion, exact: true }).click()
      await page.waitForTimeout(500)
      m = await page.evaluate(() => {
        const cont = document.querySelector('main > div.overflow-y-auto')
        return { ancho: window.innerWidth, doc: document.documentElement.scrollWidth, contenido: cont ? cont.scrollWidth - cont.clientWidth : 0 }
      })
      expect(m.doc, `${seccion}: la página`).toBeLessThanOrEqual(m.ancho)
      expect(m.contenido, `${seccion}: el contenido`).toBeLessThanOrEqual(0)
      // Texto del contenido ≥ 16 px (la barra de abajo usa 14 px: son etiquetas de un menú con ícono) y botones ≥ 44 px.
      const problemas = await page.evaluate(() => {
        const malos = []
        const cont = document.querySelector('main > div.overflow-y-auto')
        const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
        for (const e of cont.querySelectorAll('*')) {
          if (!visible(e)) continue
          const propio = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())
          if (propio && parseFloat(getComputedStyle(e).fontSize) < 16) malos.push('texto ' + parseFloat(getComputedStyle(e).fontSize) + 'px: ' + e.textContent.trim().slice(0, 40))
        }
        for (const b of cont.querySelectorAll('button, a[href]')) {
          if (!visible(b)) continue
          const r = b.getBoundingClientRect()
          if (r.height < 44 || r.width < 44) malos.push('toque ' + Math.round(r.width) + '×' + Math.round(r.height) + ': ' + (b.getAttribute('aria-label') || b.textContent.trim().slice(0, 30)))
        }
        return malos
      })
      expect(problemas, `${seccion}: texto y botones`).toEqual([])
    }

    // La ventana de agendar cabe en la pantalla (en el celular la ocupa toda).
    await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: 'Mis citas', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar cita' }).click()
    const ventana = page.getByRole('dialog', { name: 'Agendar cita' })
    await expect(ventana).toBeVisible()
    const caja = await ventana.boundingBox()
    expect(caja.x).toBeGreaterThanOrEqual(0)
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho)
    expect(caja.y + caja.height).toBeLessThanOrEqual(alto + 1)
    if (nombre === 'celular') expect(caja.width).toBeGreaterThan(ancho - 2)
    m = await sinScroll()
    expect(m.doc, 'ventana de agendar').toBeLessThanOrEqual(m.ancho)
  })
}
