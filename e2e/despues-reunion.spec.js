// Cambios de la rama despues-reunion, SOLO LECTURA en la Óptica Demo (no guarda nada):
// aviso de citas canceladas por pacientes con "Reagendar", texto de la agudeza visual con lentes y ausencia del 401
// de opticas_publicas al abrir la app con una sesión guardada y vencida.
import { test, expect } from '@playwright/test'
import { iniciarSesion, SLUG_DEMO } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('el aviso de citas canceladas por pacientes ofrece Reagendar y abre el formulario precargado', async ({ page }) => {
  await iniciarSesion(page, 'RECEPCION')
  // Recepción ve el mismo bloque Citas que el administrador: sus tres avisos más importantes, y el resto tras "Ver todo".
  const bloque = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  const fila = bloque.getByRole('listitem').filter({ hasText: 'todavía sin reagendar' }).first()
  await expect(fila).toBeVisible()
  await expect(fila).toContainText('todavía sin reagendar')
  await expect(fila.getByRole('button', { name: 'Ver en Citas' })).toBeVisible()
  await fila.getByRole('button', { name: 'Reagendar' }).click()
  const dialogo = page.getByRole('dialog')
  await expect(dialogo).toBeVisible({ timeout: 20_000 })
  // Paciente y motivo vienen puestos; no se guarda nada.
  await expect(dialogo).not.toContainText('Selecciona un paciente')
  await page.keyboard.press('Escape')
})

test('el administrador ve las citas por reagendar desde el "Ver todo" del bloque Citas', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  const bloque = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  // El bloque muestra solo los tres avisos más importantes; el resto está tras "Ver todo", que abre Citas en "Para reagendar".
  await bloque.getByRole('button', { name: /^Ver todo/ }).click()
  await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('main').getByText('Para reagendar').first()).toBeVisible({ timeout: 15_000 })
})

test('agudeza visual: el estado se llama "Sin agudeza visual con lentes registrada" y se explica al pasar el cursor', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  const tarjeta = page.getByRole('button', { name: /Sin agudeza visual con lentes registrada/ }).first()
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
