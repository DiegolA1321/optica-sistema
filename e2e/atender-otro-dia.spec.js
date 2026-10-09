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

test('al atender una cita de otro día se mueve al día de hoy (con la hora real)', async ({ page }) => {
  const { createClient } = await import('@supabase/supabase-js')
  const { credencial } = await import('./ayudas.js')
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: 3 })
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  const tarjeta = page.locator('main .rounded-2xl').filter({ has: page.getByRole('button', { name: nombre }) }).first()
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  await page.getByRole('dialog').getByRole('group', { name: 'Atender una cita de otro día' }).getByRole('button', { name: 'Atenderla hoy' }).click()
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
