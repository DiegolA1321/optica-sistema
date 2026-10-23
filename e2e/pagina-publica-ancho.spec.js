// El contenido de TODAS las secciones de la página pública mide lo mismo y lo que debe: el ancho de la ventana menos 48 px de margen a cada lado, con máximo 1200 px.
// Se mide el ancho real (en el navegador) del contenido de cada sección: el contenedor interno menos su relleno.
//   npx playwright test e2e/pagina-publica-ancho.spec.js
import { test, expect } from '@playwright/test'
import { slugDe } from './ayudas.js'

const ANCHOS = [1093, 1366, 1920]
const SECCIONES = ['header', '#inicio', '#quienes-somos', '#servicios', '#como-agendar', '#opiniones', '#preguntas', '#contacto', 'footer']

// Ancho del contenido de una sección: el del primer contenedor que fija el ancho (descendiente directo o la propia sección), sin su relleno lateral.
const medir = (page, selector) => page.evaluate((sel) => {
  const raiz = document.querySelector(sel)
  if (!raiz) return null
  const candidatos = [raiz, ...raiz.querySelectorAll(':scope > *, :scope > * > *')]
  const contenedor = candidatos.find((el) => /max-w-\[/.test(el.className?.toString() || '')) || raiz
  const c = getComputedStyle(contenedor)
  const caja = contenedor.getBoundingClientRect()
  const relleno = parseFloat(c.paddingLeft) + parseFloat(c.paddingRight)
  return { ancho: Math.round((caja.width - relleno) * 10) / 10, izquierda: Math.round((caja.left + parseFloat(c.paddingLeft)) * 10) / 10, clases: (contenedor.className?.toString() || '').slice(0, 90) }
}, selector)

for (const ancho of ANCHOS) {
  test(`página pública a ${ancho} px: todas las secciones miden el ancho de la ventana menos 96 px (máximo 1200)`, async ({ page }) => {
    await page.setViewportSize({ width: ancho, height: 900 })
    await page.goto(`/?optica=${slugDe('demo')}`)
    await page.locator('#inicio').waitFor()
    const ventana = await page.evaluate(() => document.documentElement.clientWidth)
    const esperado = Math.min(1200, ventana - 96)
    const medidas = {}
    for (const sel of SECCIONES) medidas[sel] = await medir(page, sel)
    console.log(`\n== ${ancho} px (ventana ${ventana}, esperado ${esperado}) ==\n` + Object.entries(medidas).map(([s, m]) => `${s.padEnd(15)} ${m ? `${m.ancho} px · empieza en ${m.izquierda}` : '(no se dibuja)'}`).join('\n'))

    const presentes = Object.entries(medidas).filter(([, m]) => m)
    expect(presentes.length).toBeGreaterThanOrEqual(7)
    for (const [sel, m] of presentes) expect(m.ancho, `${sel} a ${ancho} px`).toBeCloseTo(esperado, 0)
    // Alineadas entre sí: todas empiezan en el mismo punto.
    const izquierdas = new Set(presentes.map(([, m]) => Math.round(m.izquierda)))
    expect(izquierdas.size, 'todas las secciones empiezan en el mismo borde izquierdo').toBe(1)
    // Sin desplazamiento horizontal.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}
