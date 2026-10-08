// "Atender" una cita de OTRO día (ajuste del 8 oct. a C16) en la óptica de pruebas (E2E): ESCRIBE datos (un paciente y una
// cita de mañana para Paula, que termina "En atención"). Las citas de hoy entran directo a la ficha (lo cubre
// llego-en-espera.spec.js); la de otro día abre su detalle con "¿Atenderla hoy?" y un clic más.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('una cita de otro día pregunta "¿Atenderla hoy?" antes de entrar a la ficha', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: 1 })
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  const tarjeta = page.locator('main .rounded-2xl').filter({ has: page.getByRole('button', { name: nombre }) }).first()

  // "Atender" en la tarjeta abre el detalle con la pregunta; "No" la descarta y no se entra a ninguna ficha.
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  const detalle = page.getByRole('dialog')
  const pregunta = detalle.getByRole('group', { name: 'Atender una cita de otro día' })
  await expect(pregunta).toContainText('Esta cita es del')
  await expect(pregunta).toContainText('¿Atenderla hoy?')
  await pregunta.getByRole('button', { name: 'No' }).click()
  await expect(pregunta).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toHaveCount(0)

  // "Atender" dentro del detalle plantea lo mismo; confirmar entra a la ficha.
  await detalle.getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(pregunta).toBeVisible()
  await pregunta.getByRole('button', { name: 'Atenderla hoy' }).click()
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })
})
