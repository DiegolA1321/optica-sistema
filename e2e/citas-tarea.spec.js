// Tarea de recepción en Citas ("Contactar al paciente"; ya no existe «por confirmar»): ya no hay un grupo "Tarea" en el panel Filtrar; se llega a
// ellas desde las filas de "Requiere tu atención" de Inicio. Mientras están activas reemplazan al periodo de la Lista, el conteo
// coincide con las citas que se ven y la etiqueta con su "x" las quita (vuelve a Hoy). SOLO LECTURA en la Óptica Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('el panel Filtrar ya no tiene el grupo Tarea', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.getByRole('button', { name: /Filtrar/ }).click()
  const panel = page.locator('#citas-filtrar-panel')
  await expect(panel.getByRole('group', { name: 'Estado' })).toBeVisible()
  await expect(panel.getByRole('group', { name: 'Tarea' })).toHaveCount(0)
})

test('"Contactar al paciente" desde Inicio filtra la Lista, cuenta bien y se quita con la x de su etiqueta', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await expect(page.getByText('Requiere tu atención').first()).toBeVisible({ timeout: 20_000 })
  // La tarjetita «por contactar» del área Citas abre su ventana y su enlace «Abrir en Citas · Contactar al paciente (n)» abre la lista ya filtrada.
  const citas = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(citas).toContainText(/por contactar/)
  await citas.getByRole('button', { name: /por contactar$/ }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Abrir en Citas · Contactar al paciente/ }).click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  const periodoActivo = page.getByRole('group', { name: 'Periodo de las citas' }).locator('[aria-pressed=true]')
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea: Contactar al paciente/ })).toBeVisible()
  await expect(periodoActivo).toHaveCount(0)
  // «17 citas · 2 canceladas»: el total de la lista es la suma (las canceladas se cuentan aparte y también se ven).
  const n = ((await page.getByRole('status').first().innerText()).match(/\d+/g) || []).reduce((s, x) => s + Number(x), 0)
  expect(n).toBeGreaterThan(0)
  if (n <= 30) expect(await page.getByTitle('Ver el detalle de la cita').count(), 'conteo = citas en pantalla').toBe(n)

  await page.getByRole('button', { name: /Quitar el filtro Tarea/ }).click()
  await expect(periodoActivo).toHaveText('Hoy')
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea/ })).toHaveCount(0)
})
