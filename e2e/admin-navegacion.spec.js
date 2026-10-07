// Administrador de la Óptica Demo: cabecera sin el botón "Comandos" (el atajo Ctrl+K sigue) y
// "Revisar" de las atenciones abiertas lleva directo a la cita, no a un calendario vacío.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test('cabecera: sin botón "Comandos", Ctrl+K abre la paleta', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await expect(page.getByText('Buscar paciente...').first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Abrir paleta de comandos' })).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
})

test('Citas: "Revisar" abre la atención abierta más antigua', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  const aviso = page.getByRole('status').filter({ hasText: /atenci(ón|ones) abiertas? de/ })
  // El aviso solo existe si hay una atención abierta de un día anterior; la Demo puede no tener ninguna.
  await page.getByRole('heading', { name: 'Citas médicas' }).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(3000)
  test.skip((await aviso.count()) === 0, 'No hay atenciones abiertas de días anteriores')
  await expect(aviso).toBeVisible({ timeout: 15_000 })
  const paciente = (await aviso.innerText()).match(/La más antigua: (.+?),/)?.[1]
  await aviso.getByRole('button', { name: 'Revisar' }).click()
  const detalle = page.getByRole('dialog')
  await expect(detalle).toBeVisible()
  await expect(detalle.getByText(paciente)).toBeVisible()
  await expect(detalle.getByRole('button', { name: /Dejar de atender/ })).toBeVisible()
  await expect(detalle.getByRole('button', { name: /Ingresar/ })).toBeVisible()
  await expect(page.getByText('No hay citas este mes')).toHaveCount(0)
})
