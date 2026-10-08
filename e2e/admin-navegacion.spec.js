// Administrador de la Óptica Demo: la cabecera no tiene buscador global ni paleta de comandos (decisión del 8 oct 2026;
// cada módulo tiene su propio buscador) y Citas ya no muestra el aviso de atenciones abiertas.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test('cabecera: sin buscador global y Ctrl+K no abre ninguna paleta', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await expect(page.getByRole('heading', { name: /Buenos|Buenas/ }).or(page.getByText(/Buenos días|Buenas tardes|Buenas noches/)).first()).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText('Buscar paciente...')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Buscar paciente' })).toHaveCount(0)
  await page.keyboard.press('Control+k')
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('Citas: sin el aviso de atenciones abiertas de días anteriores', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('heading', { name: 'Citas médicas' }).waitFor({ timeout: 15_000 })
  await page.waitForTimeout(2000)
  await expect(page.getByRole('status').filter({ hasText: /atenci(ón|ones) abiertas? de/ })).toHaveCount(0)
})
