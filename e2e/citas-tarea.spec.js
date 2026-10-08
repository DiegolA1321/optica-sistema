// Grupo "Tarea" del panel Filtrar (atajos por tarea de recepción): "por confirmar" y "Para reagendar". Reemplazan al periodo
// de la Lista mientras están elegidos, el conteo coincide con las citas que se ven y otro clic los quita (vuelve a Hoy).
// SOLO LECTURA en la Óptica Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('el grupo Tarea filtra por tarea, cuenta bien y se quita con otro clic', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1200)
  const periodoActivo = page.getByRole('group', { name: 'Periodo de las citas' }).locator('[aria-pressed=true]')
  const numero = async () => Number(((await page.getByRole('status').first().innerText()).match(/\d+/) || [])[0])

  await page.getByRole('button', { name: /Filtrar/ }).click()
  const tarea = page.locator('#citas-filtrar-panel').getByRole('group', { name: 'Tarea' })
  await expect(tarea.getByRole('button')).toHaveText([/Todas/, /· por confirmar$/, /Para reagendar/])

  await tarea.getByRole('button', { name: 'Para reagendar' }).click()
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea: Para reagendar/ })).toBeVisible()
  await expect(periodoActivo).toHaveCount(0)
  await page.waitForTimeout(500)
  const n = await numero()
  expect(n).toBeGreaterThan(0)
  if (n <= 30) expect(await page.getByTitle('Ver el detalle de la cita').count(), 'conteo = citas en pantalla (sin "Anteriores" escondidas)').toBe(n)

  await tarea.getByRole('button', { name: 'Para reagendar' }).click() // otro clic la quita
  await expect(periodoActivo).toHaveText('Hoy')
  await expect(page.getByRole('button', { name: /Quitar el filtro Tarea/ })).toHaveCount(0)
})
