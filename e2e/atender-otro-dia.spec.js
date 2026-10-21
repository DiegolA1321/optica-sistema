// "Atender" una cita de OTRO día en la óptica de pruebas (E2E): ESCRIBE datos (un paciente y una cita para Paula).
// Regla del 21 oct. (Ronda 2, punto 11): «Atender» aparece en TODA cita abierta, también en una futura (el paciente llegó antes), en la Agenda y en el perfil.
// Las citas de hoy entran directo a la ficha (lo cubre llego-en-espera.spec.js); la de otro día pregunta «Esta cita es del … ¿Atenderla hoy?» y, al confirmar, se mueve a hoy.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('una cita futura también se atiende (llegó antes): «Atender» pregunta «¿Atenderla hoy?» en la Agenda, en el detalle y en el perfil, y «No» no hace nada', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: 3 })
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  const tarjeta = page.locator('main .rounded-2xl').filter({ has: page.getByRole('button', { name: nombre }) }).first()
  await expect(tarjeta).not.toContainText('Próxima cita:')
  // En la Agenda
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  const pregunta = page.getByRole('dialog', { name: 'Atender una cita de otro día' })
  await expect(pregunta).toContainText('Esta cita es del')
  await expect(pregunta).toContainText('¿Atenderla hoy?')
  await expect(pregunta).toContainText('La cita se moverá a hoy, a la hora actual.')
  await pregunta.getByRole('button', { name: 'No' }).click()
  await expect(pregunta).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toHaveCount(0)
  // En el detalle
  await tarjeta.getByRole('button', { name: nombre }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Atender una cita de otro día' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Atender una cita de otro día' }).getByRole('button', { name: 'No' }).click()
  // En el perfil del paciente
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 45_000 })
  await page.getByText(nombre).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Atender', exact: true }).first().click()
  await expect(page.getByRole('dialog', { name: 'Atender una cita de otro día' })).toBeVisible()
})

test('una cita de un día anterior pregunta "¿Atenderla hoy?" antes de entrar a la ficha', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: -1 })
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  const tarjeta = page.locator('main .rounded-2xl').filter({ has: page.getByRole('button', { name: nombre }) }).first()

  // "Atender" en la tarjeta pregunta; "No" la descarta y no se entra a ninguna ficha.
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  const pregunta = page.getByRole('dialog', { name: 'Atender una cita de otro día' })
  await expect(pregunta).toContainText('Esta cita es del')
  await expect(pregunta).toContainText('¿Atenderla hoy?')
  await pregunta.getByRole('button', { name: 'No' }).click()
  await expect(pregunta).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toHaveCount(0)

  // "Atender" dentro del detalle plantea lo mismo; confirmar entra a la ficha.
  await tarjeta.getByRole('button', { name: nombre }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(pregunta).toBeVisible()
  await pregunta.getByRole('button', { name: 'Atenderla hoy' }).click()
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })
})

test('al atender una cita pendiente de un día anterior se mueve al día de hoy (con la hora real)', async ({ page }) => {
  const { createClient } = await import('@supabase/supabase-js')
  const { credencial } = await import('./ayudas.js')
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: -3 })
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  const tarjeta = page.locator('main .rounded-2xl').filter({ has: page.getByRole('button', { name: nombre }) }).first()
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  await page.getByRole('dialog', { name: 'Atender una cita de otro día' }).getByRole('button', { name: 'Atenderla hoy' }).click()
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })

  const { correo, clave } = credencial('RECEPCION', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  await cliente.auth.signInWithPassword({ email: correo, password: clave })
  const { data } = await cliente.from('citas').select('fecha, hora, estado').eq('paciente', nombre).single()
  const hoy = new Date()
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  expect(String(data.fecha).slice(0, 10)).toBe(iso)
  expect(data.estado).toBe('En Atención')
  expect(data.hora).toMatch(/^\d{2}:\d{2} (AM|PM)$/)
})
