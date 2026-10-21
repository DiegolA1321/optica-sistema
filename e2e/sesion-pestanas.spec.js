// La sesión con varias pestañas abiertas (Ronda 1, 21 oct. 2026). Corre en la óptica de pruebas, nunca en la Demo.
//
// Causa real (reproducida antes de corregir): la sesión de Supabase es una sola por navegador, pero el sistema trataba cada
// pestaña por separado. Si una pestaña cerraba la sesión (a mano, o por su propio temporizador de inactividad, que una pestaña
// olvidada cumple aunque se trabaje en otra), la pestaña en uso seguía dibujando el sistema mientras TODAS sus llamadas a la
// base salían como anónimas: "Ya no tienes permiso", "permission denied for table roles", "Sin rol", 0 roles. Al volver a
// ingresar todo funcionaba. Ahora las demás pestañas se enteran, lo dicen y llevan al ingreso.
import { test, expect } from '@playwright/test'
import { iniciarSesion, slugDe } from './ayudas.js'

const ENTORNO = 'E2E'
const MENSAJE_VENCIDA = 'Tu sesión venció, vuelve a ingresar'

const dentro = (page) => expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0, { timeout: 25_000 })
const enElIngreso = (page) => expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible({ timeout: 25_000 })

// Rol del token con el que la pestaña llama a la base: 'authenticated' (hay sesión) o 'anon' (sesión perdida).
function vigilarRoles(page) {
  const roles = []
  page.on('request', (req) => {
    if (!/\/rest\/v1\//.test(req.url())) return
    const token = (req.headers()['authorization'] || '').replace(/^Bearer\s+/i, '')
    try { roles.push(JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).role) } catch { /* sin token */ }
  })
  return roles
}

async function abrirPestana(context) {
  const page = await context.newPage()
  await page.goto(`/?optica=${slugDe(ENTORNO)}`)
  await dentro(page)
  return page
}

async function cerrarSesionDesdeElMenu(page) {
  await page.locator('header button').last().click()
  await page.getByRole('button', { name: /Cerrar sesión/ }).first().click()
}

test.describe('sesión con varias pestañas', () => {
  test('cerrar sesión en una pestaña lo dice y lleva al ingreso en las otras; ninguna sigue "dentro" sin sesión', async ({ page, context }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    const otra = await abrirPestana(context)
    await cerrarSesionDesdeElMenu(otra)
    await enElIngreso(otra)
    // La pestaña que seguía abierta se entera sola, lo dice y va al ingreso.
    await enElIngreso(page)
    await expect(page.getByText('Cerraste sesión en otra pestaña')).toBeVisible()
    // Nunca mostró "no tienes permiso" por un problema de sesión.
    await expect(page.getByText(/no tienes permiso|permission denied/i)).toHaveCount(0)
  })

  test('tres pestañas se renuevan a la vez con el token vencido y las tres siguen con sesión', async ({ page, context }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    const b = await abrirPestana(context)
    const c = await abrirPestana(context)
    const todas = [page, b, c]
    // Se vence el token de acceso guardado (queda solo la llave de renovación, que se usa una vez) y las tres recargan juntas.
    await page.evaluate(() => {
      const clave = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))
      const sesion = JSON.parse(localStorage.getItem(clave))
      sesion.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(clave, JSON.stringify(sesion))
    })
    const roles = todas.map(vigilarRoles)
    await Promise.all(todas.map((p) => p.reload()))
    for (const p of todas) await dentro(p)
    await Promise.all(todas.map((p) => p.waitForTimeout(3000)))
    // Las llamadas del arranque, mientras la sesión se recupera, pueden ser anónimas; las últimas de cada pestaña ya no.
    roles.forEach((r) => expect(r.at(-1)).toBe('authenticated'))
    for (const p of todas) await expect(p.getByText(/no tienes permiso|permission denied/i)).toHaveCount(0)
    // Siguen siendo la misma sesión: una acción real (abrir Usuarios y ver roles de verdad) funciona en cada una.
    for (const p of todas) {
      await p.getByRole('button', { name: /Usuarios y permisos/ }).first().click()
      await expect(p.getByText('Sin rol: no puede hacer nada')).toHaveCount(0)
    }
  })

  test('recargar, ir atrás y adelante no pierden la sesión', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    await page.reload()
    await dentro(page)
    await page.getByRole('button', { name: /Inventario/ }).first().click()
    await page.getByRole('button', { name: /Pacientes/ }).first().click()
    await page.goBack()
    await dentro(page)
    await page.goForward()
    await dentro(page)
    await page.reload()
    await dentro(page)
  })

  test('una sesión vencida lleva al ingreso con "Tu sesión venció, vuelve a ingresar", sin errores de permisos', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    // El servidor deja de reconocer la sesión: la base responde 401 y la comprobación de la sesión también.
    await page.route('**/auth/v1/user', (ruta) => ruta.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ msg: 'invalid JWT: token is expired' }) }))
    await page.route('**/rest/v1/**', (ruta) => ruta.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ code: 'PGRST301', message: 'JWT expired' }) }))
    // La siguiente llamada a la base (la actualización automática, cada 20 s) se entera sola; la pantalla no se queda "dentro".
    await enElIngreso(page)
    await expect(page.getByText(MENSAJE_VENCIDA)).toBeVisible()
    await expect(page.getByText(/no tienes permiso|permission denied|JWT/i)).toHaveCount(0)
  })

  test('al abrir con una sesión guardada que ya no sirve, dice que venció', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    await page.route('**/auth/v1/token**', (ruta) => ruta.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid Refresh Token: Already Used' }) }))
    await page.evaluate(() => {
      const clave = Object.keys(localStorage).find((k) => /^sb-.+-auth-token$/.test(k))
      const sesion = JSON.parse(localStorage.getItem(clave))
      sesion.expires_at = Math.floor(Date.now() / 1000) - 60
      localStorage.setItem(clave, JSON.stringify(sesion))
    })
    await page.reload()
    await enElIngreso(page)
    await expect(page.getByText(MENSAJE_VENCIDA)).toBeVisible()
  })
})
