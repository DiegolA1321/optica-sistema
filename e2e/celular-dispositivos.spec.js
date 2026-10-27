// Panel del personal en celular y tablet, parte 5: varios dispositivos con la emulación de Playwright (iPhone SE, iPhone 15, iPhone 15 Pro Max, Samsung Galaxy S24, Pixel 7 y iPad en
// vertical y en horizontal). La emulación pone el tamaño, la densidad de píxeles, el agente de usuario y el toque de cada aparato (en Chromium: no es Safari real).
//   * Óptica Demo, SOLO LECTURA, con el administrador y el optómetra: Inicio, Agenda (el «+» abre «Gestionar cita»), un perfil con sus cuatro pestañas, Contactar (si el rol lo tiene)
//     y un módulo de computadora desde «Más».
//   * Óptica de PRUEBAS (la ficha escribe: abrirla pasa la cita a «En atención»), con el optómetra: la ficha clínica, sus tres pasos.
// En cada pantalla: sin desplazamiento horizontal, lo que se toca mide 44 px o más y lo que se escribe, 16 px o más.
import { test, expect, devices } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula } from './ayudas.js'

const APARATOS = [
  ['iPhone SE (3rd gen)', 'iPhone SE'],
  ['iPhone 15', 'iPhone 15'],
  ['iPhone 15 Pro Max', 'iPhone 15 Pro Max'],
  ['Galaxy S24', 'Samsung Galaxy S24'],
  ['Pixel 7', 'Pixel 7'],
  ['iPad (gen 7)', 'iPad en vertical'],
  ['iPad (gen 7) landscape', 'iPad en horizontal'],
]
// El descriptor trae `defaultBrowserType` (el aparato real usa WebKit); aquí se prueba en Chromium con lo demás del aparato.
const aparato = (clave) => { const { defaultBrowserType, ...resto } = devices[clave]; return resto }

const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')
const limpio = { desborda: false, chicos: [], letra: [] }

async function medir(page, raiz = 'body') {
  return page.evaluate((sel) => {
    const base = document.querySelector(sel)
    const visible = (e) => { const c = e.getBoundingClientRect(); const s = getComputedStyle(e); return c.width > 0 && c.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const chicos = [], letra = []
    for (const e of base.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary')) {
      if (!visible(e)) continue
      const casilla = e.tagName === 'INPUT' && /^(checkbox|radio)$/.test(e.type)
      const c = (casilla ? (e.closest('label') || e) : e).getBoundingClientRect()
      const nombre = (e.getAttribute('aria-label') || e.textContent || e.placeholder || e.id || e.tagName).trim().slice(0, 40)
      if (c.height < 43.5 || c.width < 43.5) chicos.push(`${nombre} (${Math.round(c.width)}x${Math.round(c.height)})`)
      if (!casilla && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) letra.push(nombre)
    }
    return { desborda: document.documentElement.scrollWidth > window.innerWidth + 1 || base.scrollWidth > base.clientWidth + 1 && sel !== 'body', chicos, letra }
  }, raiz)
}
const revisar = async (page, donde, raiz) => { const m = await medir(page, raiz); expect(m, `${donde}: ${JSON.stringify(m)}`).toEqual(limpio) }

for (const [clave, nombreAparato] of APARATOS) {
  test.describe(`${nombreAparato}`, () => {
    test.use({ ...aparato(clave), actionTimeout: 15_000 })

    for (const [rol, nombreRol] of [['ADMIN', 'administrador'], ['OPTOMETRA', 'optómetra']]) {
      test(`${nombreRol} (Demo): Inicio, Agenda con «+», perfil con sus pestañas, Contactar y módulo de computadora`, async ({ page }) => {
        test.setTimeout(240_000)
        await iniciarSesion(page, rol, 'DEMO')
        await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Nivel de Zoom No Soportado')).toHaveCount(0)

        // Inicio
        await expect(page.locator('#requiere-atencion')).toBeVisible({ timeout: 30_000 })
        await revisar(page, 'Inicio')

        // Agenda y el «+»
        await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
        await expect(page.getByRole('group', { name: 'Días' })).toBeVisible({ timeout: 20_000 })
        await revisar(page, 'Agenda')
        await page.getByRole('button', { name: 'Agendar cita', exact: true }).click()
        const gestionar = page.getByRole('dialog', { name: 'Gestionar cita' })
        await expect(gestionar).toBeVisible()
        await expect(gestionar.getByPlaceholder(/Escriba para buscar/)).toBeVisible()
        await page.waitForTimeout(500)
        await revisar(page, 'Gestionar cita')
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)

        // Perfil con las cuatro pestañas
        await barra(page).getByRole('button', { name: 'Pacientes', exact: true }).click()
        await expect(page.locator('[data-paciente-id]').first()).toBeVisible({ timeout: 30_000 })
        await revisar(page, 'Pacientes')
        await page.getByPlaceholder(/Buscar paciente/).fill('Demostración')
        const demo = page.locator('[data-paciente-id]', { hasText: 'Paciente Demostración Portal' })
        const objetivo = (await demo.count()) ? demo.first() : page.locator('[data-paciente-id]').first()
        await expect(objetivo).toBeVisible({ timeout: 20_000 })
        await objetivo.getByRole('button', { name: /^Ver el perfil de/ }).click()
        const cabecera = page.locator('header[aria-label="Perfil del paciente"]')
        await expect(cabecera).toBeVisible({ timeout: 20_000 })
        await revisar(page, 'Perfil · Resumen')
        for (const pestana of ['Citas', 'Diagnóstico', 'Compras']) {
          const tab = cabecera.getByRole('tab', { name: new RegExp(`^${pestana}`) })
          await expect(tab).toBeAttached()
          await tab.click()
          await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 15_000 })
          await page.waitForTimeout(600)
          await revisar(page, `Perfil · ${pestana}`)
        }

        // Contactar (el optómetra de la Demo no tiene el permiso de crear en el CRM: ve la lista sin el botón)
        await barra(page).getByRole('button', { name: 'Contactar', exact: true }).click()
        await expect(page.getByRole('group', { name: 'Filtrar por motivo' })).toBeVisible({ timeout: 20_000 })
        await revisar(page, 'Contactar')
        const contactar = page.locator('[data-paciente-id]').first().getByRole('button', { name: /^Contactar a/ })
        if (await contactar.count()) {
          await contactar.click()
          const hoja = page.getByRole('dialog', { name: 'Contactar' })
          await expect(hoja).toBeVisible()
          await page.waitForTimeout(500)
          await revisar(page, 'Hoja de Contactar')
          await hoja.getByRole('button', { name: 'Cancelar' }).click()
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }

        // Un módulo de computadora desde «Más»
        await barra(page).getByRole('button', { name: 'Más', exact: true }).click()
        await revisar(page, 'Más')
        const modulo = page.getByText('Solo en computadora', { exact: true }).locator('xpath=following::button[1]')
        await modulo.click()
        await expect(page.getByRole('heading', { name: 'Este módulo se usa desde la computadora' })).toBeVisible()
        await expect(barra(page)).toBeVisible()
        await revisar(page, 'Módulo de computadora')
      })
    }

    test('optómetra (óptica de pruebas): la ficha clínica, sus tres pasos', async ({ page }) => {
      test.setTimeout(240_000)
      const nombre = await crearCitaDeHoyParaPaula('E2E')
      await iniciarSesion(page, 'OPTOMETRA', 'E2E')
      await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
      await barra(page).getByRole('button', { name: 'Pacientes', exact: true }).click()
      await page.getByPlaceholder(/Buscar paciente/).fill(nombre)
      await page.locator('[data-paciente-id]').first().locator('button').first().click()
      await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
      await page.getByRole('button', { name: /^(Atender|Seguir atendiendo)/ }).first().click()
      await expect(page.locator('.ficha-celular')).toBeVisible({ timeout: 20_000 })
      const primera = page.getByRole('button', { name: 'Entendido, completar antecedentes' })
      if (await primera.waitFor({ timeout: 4_000 }).then(() => true, () => false)) await primera.click()

      const ficha = page.locator('.ficha-celular')
      const ancho = page.viewportSize().width
      expect(Math.round((await ficha.boundingBox()).width)).toBe(ancho)
      await revisar(page, 'Ficha · paso 1', '.ficha-celular')
      await page.getByRole('button', { name: 'Borrosidad de cerca' }).click()
      await page.getByRole('button', { name: 'Siguiente' }).click()
      for (const b of ['Agudeza visual', 'Lentes actuales y distancia pupilar', 'Refracción', 'Cover test y motilidad', 'Salud ocular']) await page.getByRole('button', { name: new RegExp(`^${b}`) }).click()
      await revisar(page, 'Ficha · paso 2 (bloques abiertos)', '.ficha-celular')
      await page.locator('#odEsfera').fill('-1.75')
      await expect(page.locator('#odEsfera')).toHaveValue('-1.75')
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await expect(page.getByRole('button', { name: /Terminar atención/ })).toBeVisible()
      await revisar(page, 'Ficha · paso 3', '.ficha-celular')
    })
  })
}
