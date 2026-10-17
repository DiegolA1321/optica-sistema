// Prueba de DISEÑO del portal del paciente (regla 48), con el paciente de demostración de la Óptica Demo (solo lectura): en laptop de 1366, 1280, 1093 (una laptop de 1366 con la
// escala de pantalla al 125 %) y 1024 px, en tablet y en celular, en cada pantalla, FALLA si
//   · alguna tarjeta mide menos de 280 px de ancho,
//   · dos tarjetas se superponen,
//   · un título ocupa más de dos líneas, o
//   · algo se sale por los lados (desplazamiento horizontal) o se corta dentro de su tarjeta.
// Esta prueba existe porque una versión anterior se veía rota en laptop (tarjetas aplastadas, una palabra por línea, un saldo montado sobre otra tarjeta) y nada lo detectó.
import { test, expect } from '@playwright/test'
import { escribirSecreto, SLUG_DEMO } from './ayudas.js'
import { protegerDemo } from './guardia-demo.js'

const TAMANOS = [[1366, 768], [1280, 720], [1093, 614], [1024, 768], [768, 1024], [390, 844]]
const PANTALLAS = ['Resumen', 'Mis citas', 'Mi receta', 'Mis compras', 'Mis datos']

// Mide la pantalla actual y devuelve lo que está mal (lista vacía = bien).
const revisar = (page) => page.evaluate(() => {
  const malos = []
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
  const zona = document.querySelector('main > div.overflow-y-auto')
  const tarjetas = [...zona.querySelectorAll('section[aria-labelledby], section[aria-label], .pt-fila > li, ol.pt-fila > li')].filter(visible)
  // 1. Ninguna tarjeta de contenido mide menos de 280 px.
  for (const t of tarjetas) {
    const w = t.getBoundingClientRect().width
    if (w < 279.5) malos.push(`tarjeta de ${Math.round(w)} px (menos de 280): ${(t.getAttribute('aria-label') || t.querySelector('h2,h3')?.textContent || t.textContent).trim().slice(0, 40)}`)
  }
  // 2. Dos tarjetas no se superponen (las anidadas no cuentan).
  const raices = tarjetas.filter((t) => !tarjetas.some((o) => o !== t && o.contains(t)))
  for (let i = 0; i < raices.length; i++) {
    for (let j = i + 1; j < raices.length; j++) {
      const a = raices[i].getBoundingClientRect(), b = raices[j].getBoundingClientRect()
      const ancho = Math.min(a.right, b.right) - Math.max(a.left, b.left), alto = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
      if (ancho > 2 && alto > 2) malos.push(`se superponen «${(raices[i].getAttribute('aria-label') || raices[i].textContent).trim().slice(0, 25)}» y «${(raices[j].getAttribute('aria-label') || raices[j].textContent).trim().slice(0, 25)}»`)
    }
  }
  // 3. Ningún título ocupa más de dos líneas.
  for (const h of zona.querySelectorAll('h1, h2, h3')) {
    if (!visible(h)) continue
    const s = getComputedStyle(h)
    const linea = parseFloat(s.lineHeight) || parseFloat(s.fontSize) * 1.3
    const alto = h.getBoundingClientRect().height - parseFloat(s.paddingTop) - parseFloat(s.paddingBottom)
    if (alto > linea * 2 + 2) malos.push(`título de ${Math.round(alto / linea)} líneas: ${h.textContent.trim().slice(0, 40)}`)
  }
  // 4. Nada se sale por los lados ni queda cortado: ni la página, ni el texto dentro de su tarjeta.
  if (document.documentElement.scrollWidth > document.documentElement.clientWidth) malos.push('desplazamiento horizontal de la página')
  for (const t of raices) if (t.scrollWidth > t.clientWidth + 1) malos.push(`contenido cortado en «${(t.getAttribute('aria-label') || t.textContent).trim().slice(0, 30)}» (${t.scrollWidth} > ${t.clientWidth})`)
  for (const e of zona.querySelectorAll('button, a, p, li, span')) {
    if (!visible(e)) continue
    const r = e.getBoundingClientRect(), z = zona.getBoundingClientRect()
    if (r.right > z.right + 1 || r.left < z.left - 1) malos.push(`se sale de la zona de contenido: ${e.textContent.trim().slice(0, 30)}`)
  }
  return [...new Set(malos)]
})

for (const [ancho, alto] of TAMANOS) {
  test(`Portal a ${ancho}×${alto}: ninguna tarjeta de menos de 280 px, nada superpuesto, títulos de dos líneas como máximo`, async ({ page }) => {
    test.setTimeout(120_000)
    await protegerDemo(page)
    await page.setViewportSize({ width: ancho, height: alto })
    await page.goto(`/?optica=${SLUG_DEMO}&_muestra=detalle`)
    await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
    await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.DEMO_PORTAL_CEDULA)
    await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.DEMO_PORTAL_CLAVE)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Resumen' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
    for (const pantalla of PANTALLAS) {
      await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: pantalla, exact: true }).click()
      await page.waitForTimeout(700)
      expect(await revisar(page), `${pantalla} a ${ancho} px`).toEqual([])
    }
    // Las ventanas también caben.
    await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: 'Mis citas', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar cita' }).first().click()
    const ventana = page.getByRole('dialog', { name: 'Agendar cita' })
    await expect(ventana).toBeVisible()
    await page.waitForTimeout(500)
    const caja = await ventana.boundingBox()
    expect(caja.x).toBeGreaterThanOrEqual(-1)
    expect(caja.x + caja.width).toBeLessThanOrEqual(ancho + 1)
    expect(caja.y + caja.height).toBeLessThanOrEqual(alto + 1)
  })
}
