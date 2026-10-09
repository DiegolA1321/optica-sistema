// Títulos de periodo de Citas con el formato único de fechas ("Hoy · jue 8 oct 2026", "5 – 11 oct 2026", "oct 2026") y
// controles que NO se mueven al cambiar entre Hoy, Semana y Mes (ni entre las vistas Lista, Semana y Mes).
// SOLO LECTURA en la Óptica Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('las flechas y el selector no se mueven y los títulos usan el formato único', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1200)

  const periodo = page.getByRole('group', { name: 'Periodo de las citas' })
  const anterior = page.getByRole('button', { name: /anterior$/ }).first()
  const posiciones = []
  const medir = async (nombre) => {
    const flecha = Math.round((await anterior.boundingBox()).x)
    const selector = (await periodo.count()) ? Math.round((await periodo.boundingBox()).x) : null
    const titulo = (await anterior.locator('xpath=ancestor::div[2]').innerText()).trim()
    posiciones.push({ nombre, flecha, selector, titulo })
    return titulo
  }

  await periodo.getByRole('button', { name: 'Hoy' }).click()
  expect(await medir('Lista · Hoy')).toMatch(/^Hoy · [a-zñé]{3} \d{1,2} [a-z]{3,4} \d{4}$/)
  await periodo.getByRole('button', { name: 'Semana' }).click()
  expect(await medir('Lista · Semana')).toMatch(/^\d{1,2} (\d{1,2} )?[a-z]{3,4} (– \d{1,2} [a-z]{3,4} )?\d{4}$|^\d{1,2} – \d{1,2} [a-z]{3,4} \d{4}$|^\d{1,2} [a-z]{3,4} – \d{1,2} [a-z]{3,4} \d{4}$/)
  await periodo.getByRole('button', { name: 'Mes' }).click()
  expect(await medir('Lista · Mes')).toMatch(/^[A-Za-zñé]+ \d{4}$/)
  await periodo.getByRole('button', { name: 'Hoy' }).click()
  await page.getByRole('button', { name: 'Periodo siguiente' }).click()
  expect(await medir('Lista · Hoy, un día después')).toMatch(/^[a-zñé]{3} \d{1,2} [a-z]{3,4} \d{4}$/) // sin "Hoy · "

  for (const vista of ['Semana', 'Mes']) {
    await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: vista }).click()
    await page.waitForTimeout(700)
    await medir(`Vista ${vista}`)
  }

  const flechas = new Set(posiciones.map((p) => p.flecha))
  const selectores = new Set(posiciones.filter((p) => p.selector !== null).map((p) => p.selector))
  expect([...flechas], `flechas: ${JSON.stringify(posiciones)}`).toHaveLength(1)
  expect([...selectores], `selector: ${JSON.stringify(posiciones)}`).toHaveLength(1)
})

test('la cabecera y los encabezados de día no ponen "De" con mayúscula', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.getByRole('group', { name: 'Periodo de las citas' }).getByRole('button', { name: 'Semana' }).click()
  await page.waitForTimeout(800)
  const cabecera = await page.locator('header').first().innerText()
  expect(cabecera).toMatch(/[A-ZÁÉÍÓÚ][a-zé]+, \d{1,2} de [a-zé]+ de \d{4}/)
  expect(cabecera).not.toMatch(/ De /)
  const dias = await page.locator('main h4').allInnerTexts()
  for (const d of dias) expect(d, 'encabezado de día').not.toMatch(/ De /)
})
