// Inicio rediseñado (R52 a R56): una línea de resumen, Totales, Desenlace con período, un solo bloque
// "Requiere tu atención", Hoy sin citas pasadas y registro de actividad compacto.
// Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/inicio-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion } from './ayudas.js'

const CARPETA = 'docs/inicio-capturas'
// El Inicio se desplaza dentro de un contenedor propio: se captura el tope y, si hay más, cada tramo siguiente (1366x768).
async function capturar(page, nombre) {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync(CARPETA, { recursive: true })
  const mover = (y) => page.evaluate((top) => {
    const el = [...document.querySelectorAll('*')]
      .filter((e) => e.scrollHeight > e.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && !e.className.toString().includes('sidebar'))
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
    if (el) el.scrollTop = top
    return el ? [el.scrollHeight, el.clientHeight] : [0, 0]
  }, y)
  const [alto, visible] = await mover(0)
  const tramos = Math.max(1, Math.ceil((alto - 80) / (visible - 80)))
  for (let i = 0; i < tramos; i++) {
    await mover(i * (visible - 80))
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${CARPETA}/${nombre}-${i + 1}.png` })
  }
  await mover(0)
}
const main = (page) => page.locator('main').first()

test.describe('Inicio del administrador', () => {
  test('estructura nueva, sin saludo ni bloques sueltos', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    await expect(page.getByRole('region', { name: 'Resumen del día' }).or(page.getByLabel('Resumen del día'))).toBeVisible({ timeout: 20_000 })
    const cuerpo = main(page)
    // Lo que se quitó
    await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
    await expect(cuerpo.getByText('Módulo clínico activo')).toHaveCount(0)
    await expect(cuerpo.getByText('Reabastecimiento', { exact: true })).toHaveCount(0)
    await expect(cuerpo.getByText('Últimas citas / Agenda cercana')).toHaveCount(0)
    // Lo que debe estar, en orden
    const titulos = await cuerpo.locator('h2').allInnerTexts()
    const esperado = ['TOTALES', 'DESENLACE DE LAS CITAS · ESTE MES', 'REQUIERE TU ATENCIÓN', 'HOY']
    const pos = esperado.map((t) => titulos.findIndex((x) => x.toUpperCase() === t))
    expect.soft(pos.every((p) => p >= 0), `faltan secciones: ${JSON.stringify(titulos)}`).toBe(true)
    expect.soft([...pos].sort((a, b) => a - b), 'orden de las secciones').toEqual(pos)
    await capturar(page, 'admin-demo')
  })

  test('el desenlace indica su período y lo cambia', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const cuerpo = main(page)
    await expect(cuerpo.getByRole('heading', { name: /Desenlace de las citas · este mes/i })).toBeVisible({ timeout: 20_000 })
    await cuerpo.getByRole('button', { name: 'Desde siempre' }).click()
    await expect(cuerpo.getByRole('heading', { name: /Desenlace de las citas · desde siempre/i })).toBeVisible()
    await expect(cuerpo.getByRole('button', { name: 'Desde siempre' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('cada tarjeta del desenlace abre Citas con ese filtro', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const cuerpo = main(page)
    await cuerpo.getByRole('button', { name: 'Desde siempre' }).click()
    await cuerpo.getByRole('button', { name: /^Atendidas:/ }).click()
    await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Estado: Atendidas')).toBeVisible()
  })

  test('"Requiere tu atención" reúne todo con el stock bajo una sola vez', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const bloque = page.getByRole('region', { name: 'Requiere tu atención' })
    await expect(bloque).toBeVisible({ timeout: 20_000 })
    await expect(bloque.getByText(/productos? con stock bajo/)).toHaveCount(1)
    await expect(main(page).getByText(/productos? con stock bajo/)).toHaveCount(1)
    for (const fila of await bloque.locator('li').all()) {
      expect.soft(await fila.getByRole('button').count(), 'cada fila lleva su botón de acción').toBeGreaterThan(0)
    }
  })

  test('"Hoy" no mezcla citas pasadas', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const hoy = page.getByRole('region', { name: 'Hoy' })
    await expect(hoy).toBeVisible({ timeout: 20_000 })
    await expect(hoy.getByText(/Anteriores|Últimas citas/)).toHaveCount(0)
  })
})

test('Inicio de Paula (optómetra): un solo bloque Requiere tu atención', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  const cuerpo = main(page)
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
  await expect(cuerpo.getByText(/stock bajo/)).toHaveCount(0)
  await expect(cuerpo.getByText('Tu agenda del día')).toBeVisible()
  await capturar(page, 'paula-optometra')
})

test('Inicio de Recepción y de Ventas con su bloque único', async ({ page }) => {
  await iniciarSesion(page, 'RECEPCION')
  await expect(main(page).getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(main(page).getByText(/stock bajo/)).toHaveCount(0)
  await capturar(page, 'recepcion')
})

test('Inicio de Ventas', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS')
  const cuerpo = main(page)
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/productos? con stock bajo/)).toHaveCount(1)
  await expect(cuerpo.getByText(/órdenes? atrasadas?/).first()).toBeVisible()
  await capturar(page, 'ventas')
})
