// Ficha clínica: el próximo control se decide explícitamente. Sin ninguna opción marcada, "Agendar ahora" abre el calendario
// con los horarios libres y una fecha recomendada, y "Agendar después" no pide nada. NO guarda la ficha (no deja datos clínicos).
// Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/perfil-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion } from './ayudas.js'

const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync('docs/perfil-capturas', { recursive: true })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `docs/perfil-capturas/${nombre}.png` })
}

test.use({ viewport: { width: 1366, height: 768 } })

test('ficha clínica: el control exige elegir agendar ahora o después', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Nombre, cédula, teléfono/).fill('Karla Párraga Vera')
  // Se espera a que los datos estén cargados (no un tiempo fijo): primero la fila del paciente y luego su perfil, con holgura para un equipo cargado.
  const fila = page.getByText('Karla Párraga Vera').first()
  await expect(fila).toBeVisible({ timeout: 45_000 })
  // El perfil ya no trae el botón "Ficha clínica" (se entra por la cita); sin cita se usa la acción de la lista.
  await page.locator('tr', { hasText: 'Karla Párraga Vera' }).getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Nueva ficha clínica' }).click()
  // Si el paciente tiene citas pendientes se pregunta por cuál entrar; Karla no tiene.
  await expect(page.getByLabel(/Motivo de la consulta/i)).toBeVisible({ timeout: 20_000 })
  await page.getByLabel(/Motivo de la consulta/i).selectOption({ index: 1 })
  await page.getByRole('button', { name: /^Siguiente$/i }).click()
  await page.getByRole('button', { name: /^Siguiente$/i }).click()
  await page.getByRole('button', { name: 'Miopía' }).first().click()

  const ahora = page.getByRole('radio', { name: /Agendar ahora/ })
  const despues = page.getByRole('radio', { name: /Agendar después/ })
  await expect(ahora).toBeVisible()
  await expect(ahora).not.toBeChecked()
  await expect(despues).not.toBeChecked()

  // Sin elegir, no deja terminar
  await page.getByRole('button', { name: /Terminar atención/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Elige si el próximo control se agenda ahora o después.' }).first()).toBeVisible()

  // Agendar ahora: fecha recomendada, calendario y horarios; sin fecha y hora tampoco deja terminar
  await ahora.check()
  await expect(page.getByText(/Fecha recomendada:/)).toBeVisible()
  await expect(page.getByText(/Horarios para el/i).or(page.getByText(/Elige un día/i)).first()).toBeVisible()
  await foto(page, 'ficha-control-ahora')
  await page.getByRole('button', { name: /Terminar atención/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Elige la fecha y la hora del control' }).first()).toBeVisible()

  // Elegir la fecha recomendada y una hora libre
  await page.getByRole('button', { name: /^Elegir (esa fecha|ese día)$/ }).click()
  await expect(page.getByText(/Horarios para el/i)).toBeVisible()
  if (process.env.E2E_CAPTURAS) { await page.waitForTimeout(500); await page.getByRole('group', { name: /Cuándo se agenda ese control/ }).screenshot({ path: 'docs/perfil-capturas/ficha-control-fecha.png' }) }

  // Agendar después: no pide nada más
  await despues.check()
  await expect(page.getByText(/Fecha recomendada:/)).toHaveCount(0)
  await foto(page, 'ficha-control-despues')
})
