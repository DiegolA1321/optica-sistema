// Crea (una sola vez) las cuentas de prueba de la Óptica Demo desde Usuarios y guarda sus
// credenciales en .env.test sin imprimirlas. Se ejecuta con E2E_CREAR_CUENTAS=1.
import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { iniciarSesion, escribirSecreto, guardarEnEnv } from './ayudas.js'

test.skip(!process.env.E2E_CREAR_CUENTAS, 'Solo con E2E_CREAR_CUENTAS=1')

const CUENTAS = [
  { prefijo: 'OPTOMETRA', rol: /^Optómetra/, nombre: 'Paula Optómetra Demo', correo: 'optometra@opticademo.test' },
  { prefijo: 'RECEPCION', rol: /^Recepci[oó]n/, nombre: 'Rosa Recepción Demo', correo: 'recepcion@opticademo.test' },
  { prefijo: 'VENTAS', rol: /^Ventas/, nombre: 'Vera Ventas Demo', correo: 'ventas@opticademo.test' },
]

const claveNueva = () => `Demo-${crypto.randomBytes(5).toString('hex')}-${crypto.randomInt(10, 99)}Zq`
// Cédula ecuatoriana válida (provincia 17, persona natural), con verificador calculado.
function cedulaValida() {
  const base = '170' + String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  let suma = 0
  for (let i = 0; i < 9; i++) { let v = Number(base[i]) * (i % 2 === 0 ? 2 : 1); if (v >= 10) v -= 9; suma += v }
  return base + String((10 - (suma % 10)) % 10)
}

test('crear Optómetra, Recepción y Ventas desde Usuarios', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: /Usuarios y permisos/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Usuarios y permisos' })).toBeVisible()

  for (const c of CUENTAS) {
    if (process.env[`DEMO_${c.prefijo}_EMAIL`] && process.env[`DEMO_${c.prefijo}_PASSWORD`]) continue
    const clave = claveNueva()
    guardarEnEnv({ [`DEMO_${c.prefijo}_EMAIL`]: c.correo, [`DEMO_${c.prefijo}_PASSWORD`]: clave })
    await page.getByRole('button', { name: 'Crear usuario' }).first().click()
    const modal = page.getByRole('dialog')
    await modal.getByPlaceholder('Ej. Ana Torres').fill(c.nombre)
    await modal.getByPlaceholder('10 dígitos').fill(cedulaValida())
    await modal.getByPlaceholder('ana.torres@correo.com').fill(c.correo)
    await escribirSecreto(page, modal.getByPlaceholder('8 o más, con letra y número'), clave)
    await modal.getByRole('checkbox', { name: c.rol }).check()
    await modal.getByRole('button', { name: 'Crear usuario' }).click()
    await expect(page.getByText(/creado correctamente/)).toBeVisible({ timeout: 20_000 })
    await expect(modal).toBeHidden()
  }
})
