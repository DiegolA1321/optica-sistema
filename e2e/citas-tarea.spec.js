// Tareas de recepción en Citas ("por confirmar" y "Para reagendar"): ya no hay un grupo "Tarea" en el panel Filtrar; se llega a
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

test('"Para reagendar" desde Inicio filtra la Lista, cuenta bien y se quita con la x de su etiqueta', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await expect(page.getByText('Requiere tu atención').first()).toBeVisible({ timeout: 20_000 })
  const fila = page.locator('li, div').filter({ hasText: /No asistió a su cita|Cita cancelada por el paciente/ }).filter({ has: page.getByRole('button', { name: 'Ver en Citas' }) }).last()
  await fila.getByRole('button', { name: 'Ver en Citas' }).click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  const periodoActivo = page.getByRole('group', { name: 'Periodo de las citas' }).locator('[aria-pressed=true]')
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea: Para reagendar/ })).toBeVisible()
  await expect(periodoActivo).toHaveCount(0)
  const n = Number(((await page.getByRole('status').first().innerText()).match(/\d+/) || [])[0])
  expect(n).toBeGreaterThan(0)
  if (n <= 30) expect(await page.getByTitle('Ver el detalle de la cita').count(), 'conteo = citas en pantalla').toBe(n)

  await page.getByRole('button', { name: /Quitar el filtro Tarea/ }).click()
  await expect(periodoActivo).toHaveText('Hoy')
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea/ })).toHaveCount(0)
})
