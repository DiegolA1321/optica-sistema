// Lo que la óptica cambia en «Datos de la óptica» (Configuración → Página pública) se ve en su página pública, y al cambiarlo de nuevo, también.
// Corre en la óptica de pruebas (QA Test Claude) y la deja como estaba (también si la prueba falla).
//   Local:       npx playwright test e2e/datos-optica-publica.spec.js
//   Publicada:   E2E_BASE_URL=https://optica-sistema-zeta.vercel.app npx playwright test e2e/datos-optica-publica.spec.js
//   (el enlace de Google Maps necesita /api/resolver-mapa, que solo existe en el sitio publicado: esa prueba se omite en local)
import { test, expect } from '@playwright/test'
import { iniciarSesion, slugDe, PREFIJO } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const ENLACE = 'https://maps.app.goo.gl/ZMMY8KdKNcP67PAB7'
const sufijo = () => Math.random().toString(36).slice(2, 7)
const GUARDADO = 'Datos de la óptica guardados correctamente.'

async function abrirDatos(page) {
  await page.getByRole('button', { name: 'Configuración', exact: true }).first().click()
  await page.getByRole('tab', { name: 'Página pública' }).click()
  await expect(page.getByLabel('Dirección')).toBeVisible({ timeout: 20_000 })
}
// Guarda y espera el aviso. El aviso dura pocos segundos: se espera en la misma llamada que el clic.
async function guardar(page) {
  await page.getByRole('button', { name: 'Guardar datos de la óptica' }).click()
  await expect(page.getByText(GUARDADO)).toBeVisible({ timeout: 25_000 })
  await expect(page.getByRole('button', { name: 'Guardar datos de la óptica' })).toBeDisabled() // sin cambios pendientes
}
// La página pública, vista por un paciente: otra sesión, sin haber iniciado sesión.
async function verPublica(browser) {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })
  const pagina = await contexto.newPage()
  await pagina.goto(`/?optica=${slugDe('E2E')}`)
  await expect(pagina.getByRole('button', { name: 'Agenda tu cita en línea' }).first()).toBeVisible({ timeout: 30_000 })
  return { pagina, cerrar: () => contexto.close() }
}
const contacto = (pagina) => pagina.locator('#contacto')
const mapa = (pagina) => contacto(pagina).locator('iframe')

test('dirección y teléfono: lo que se guarda aparece en la página pública, y al cambiarlo, el cambio también', async ({ page, browser }) => {
  const marca = sufijo()
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirDatos(page)
  const original = { direccion: await page.getByLabel('Dirección').inputValue(), telefono: await page.getByLabel('Teléfono (WhatsApp)').inputValue() }
  try {
    // 1) Primer valor.
    const dir1 = `${PREFIJO}Av. Primera ${marca}`
    await page.getByLabel('Dirección').fill(dir1)
    await page.getByLabel('Teléfono (WhatsApp)').fill('0991112233')
    await guardar(page)
    let publica = await verPublica(browser)
    await expect(contacto(publica.pagina)).toContainText(dir1)
    await expect(contacto(publica.pagina)).toContainText('0991112233')
    await expect(contacto(publica.pagina).getByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:+593991112233')
    await expect(mapa(publica.pagina)).toHaveAttribute('src', new RegExp(encodeURIComponent(dir1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await publica.cerrar()

    // 2) Se cambia otra vez: el nuevo valor se ve y el anterior ya no.
    const dir2 = `${PREFIJO}Calle Segunda ${marca}`
    await page.getByLabel('Dirección').fill(dir2)
    await page.getByLabel('Teléfono (WhatsApp)').fill('0984445566')
    await guardar(page)
    publica = await verPublica(browser)
    await expect(contacto(publica.pagina)).toContainText(dir2)
    await expect(contacto(publica.pagina)).not.toContainText(dir1)
    await expect(contacto(publica.pagina).getByRole('link', { name: 'Llamar' })).toHaveAttribute('href', 'tel:+593984445566')
    await publica.cerrar()
  } finally {
    // Se devuelve la óptica de pruebas a como estaba.
    if (!page.isClosed()) {
      await page.reload()
      await abrirDatos(page)
      const d = page.getByLabel('Dirección'), t = page.getByLabel('Teléfono (WhatsApp)')
      if ((await d.inputValue()) !== original.direccion || (await t.inputValue()) !== original.telefono) {
        await d.fill(original.direccion)
        await t.fill(original.telefono)
        await guardar(page)
      }
    }
  }
})

test('enlace de Google Maps: pegarlo y guardarlo cambia el mapa y «Cómo llegar» de la página pública; quitarlo los devuelve a la dirección', async ({ page, browser }) => {
  test.skip(!process.env.E2E_BASE_URL, 'Necesita /api/resolver-mapa: córrela con E2E_BASE_URL (el sitio publicado).')
  const marca = sufijo()
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirDatos(page)
  const original = { direccion: await page.getByLabel('Dirección').inputValue(), enlace: await page.getByLabel('Enlace de Google Maps').inputValue() }
  try {
    const dir = `${PREFIJO}Dirección con mapa ${marca}`
    await page.getByLabel('Dirección').fill(dir)
    await page.getByLabel('Enlace de Google Maps').fill(ENLACE)
    await guardar(page)
    await expect(page.getByText(/Ubicada: ÒPTICA SOLNA-VISIÒN/)).toBeVisible()

    // El paciente ve: la dirección escrita, el mapa del enlace (coordenadas del lugar) y «Cómo llegar» abriendo el enlace.
    let publica = await verPublica(browser)
    await expect(contacto(publica.pagina)).toContainText(dir)
    await expect(mapa(publica.pagina)).toHaveAttribute('src', /q=-0\.7862109,-80\.2346583/)
    await expect(contacto(publica.pagina).getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', ENLACE)
    await publica.cerrar()

    // Un enlace que no es de Google Maps no se guarda y la página sigue igual.
    await page.getByLabel('Enlace de Google Maps').fill('https://ejemplo.com/mi-optica')
    await page.getByRole('button', { name: 'Guardar datos de la óptica' }).click()
    await expect(page.getByRole('alert').filter({ hasText: /enlace de Google Maps/ })).toBeVisible({ timeout: 15_000 })
    publica = await verPublica(browser)
    await expect(mapa(publica.pagina)).toHaveAttribute('src', /q=-0\.7862109,-80\.2346583/)
    await publica.cerrar()

    // Se quita el enlace: el mapa y «Cómo llegar» vuelven a salir de la dirección escrita.
    await page.getByLabel('Enlace de Google Maps').fill('')
    await guardar(page)
    publica = await verPublica(browser)
    await expect(mapa(publica.pagina)).toHaveAttribute('src', new RegExp(encodeURIComponent(dir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await expect(contacto(publica.pagina).getByRole('link', { name: /Cómo llegar/ })).toHaveAttribute('href', new RegExp(encodeURIComponent(dir).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    await publica.cerrar()
  } finally {
    if (!page.isClosed()) {
      await page.reload()
      await abrirDatos(page)
      const d = page.getByLabel('Dirección'), e = page.getByLabel('Enlace de Google Maps')
      if ((await d.inputValue()) !== original.direccion || (await e.inputValue()) !== original.enlace) {
        await d.fill(original.direccion)
        await e.fill(original.enlace)
        await guardar(page)
      }
    }
  }
})
