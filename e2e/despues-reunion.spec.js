// Cambios de la rama despues-reunion, SOLO LECTURA en la Óptica Demo (no guarda nada):
// aviso de citas canceladas por pacientes con "Reagendar", texto de la agudeza visual con lentes y ausencia del 401
// de opticas_publicas al abrir la app con una sesión guardada y vencida.
import { test, expect } from '@playwright/test'
import { iniciarSesion, SLUG_DEMO } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('«Contactar al paciente»: una tarjetita que abre su ventana, con Reagendar, Escribir por WhatsApp y Descartar en cada caso', async ({ page }) => {
  await iniciarSesion(page, 'RECEPCION')
  // Recepción ve el mismo bloque Citas que el administrador.
  const bloque = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  const tarjeta = bloque.getByRole('button', { name: /por contactar$/ })
  test.skip((await tarjeta.count()) === 0, 'La Demo no tiene pacientes por contactar')
  await tarjeta.click()
  const ventana = page.getByRole('dialog')
  const caso = ventana.getByRole('listitem').first()
  await expect(caso.getByRole('button', { name: /^Descartar el aviso de / })).toBeVisible()
  await expect(ventana.getByRole('button', { name: /^Abrir en Citas · Contactar al paciente \(\d+\)/ })).toBeVisible()
  if (await caso.getByRole('button', { name: 'Reagendar' }).count()) {
    await caso.getByRole('button', { name: 'Reagendar' }).click()
    const dialogo = page.getByRole('dialog')
    await expect(dialogo).toBeVisible({ timeout: 20_000 })
    // Paciente y motivo vienen puestos; no se guarda nada.
    await expect(dialogo).not.toContainText('Selecciona un paciente')
    await page.keyboard.press('Escape')
  }
})

test('el administrador abre «Contactar al paciente» en Citas desde la ventana de su tarjetita', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  const bloque = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  const tarjeta = bloque.getByRole('button', { name: /por contactar$/ })
  test.skip((await tarjeta.count()) === 0, 'La Demo no tiene pacientes por contactar')
  await tarjeta.click()
  await page.getByRole('dialog').getByRole('button', { name: /^Abrir en Citas · Contactar al paciente/ }).click()
  await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('main').getByText('Contactar al paciente').first()).toBeVisible({ timeout: 15_000 })
})

test('agudeza visual: el estado se llama "Sin agudeza visual con corrección registrada" y se explica al pasar el cursor', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  const tarjeta = page.getByRole('button', { name: /Sin agudeza visual con corrección registrada/ }).first()
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  await expect(tarjeta).toHaveAttribute('title', /agudeza visual con lentes/)
  await expect(page.getByText('AV sin evaluar')).toHaveCount(0)
})

test('abrir la app con una sesión guardada e inválida no da 401 en opticas_publicas', async ({ page }) => {
  const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0]
  // Token con forma de JWT, sin vencer según el navegador, pero con firma inválida (como uno revocado): el servidor lo rechaza con 401.
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const futuro = Math.floor(Date.now() / 1000) + 3600
  const token = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ role: 'authenticated', aud: 'authenticated', sub: '00000000-0000-0000-0000-000000000000', exp: futuro })}.firmainvalida`
  const caducado = { access_token: token, refresh_token: 'invalido', token_type: 'bearer', expires_in: 3600, expires_at: futuro, user: { id: '00000000-0000-0000-0000-000000000000', aud: 'authenticated' } }
  await page.addInitScript(([clave, valor]) => localStorage.setItem(clave, valor), [`sb-${ref}-auth-token`, JSON.stringify(caducado)])
  const respuestas = []
  page.on('response', (r) => { if (r.url().includes('/opticas_publicas')) respuestas.push(r.status()) })
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await expect.poll(() => respuestas.length, { timeout: 20_000 }).toBeGreaterThan(0)
  expect(respuestas.filter((s) => s === 401)).toEqual([])
  expect(respuestas.every((s) => s === 200)).toBe(true)
})
