// Crea (una sola vez) las cuentas de prueba de Optómetra, Recepción y Ventas desde Usuarios y guarda sus credenciales en
// .env.test sin imprimirlas. Se ejecuta con E2E_CREAR_CUENTAS=E2E (óptica de pruebas, la normal) o E2E_CREAR_CUENTAS=DEMO.
// Necesita las credenciales del administrador de esa óptica (E2E_ADMIN_* o DEMO_ADMIN_*) y no repite las cuentas que ya existen.
import { test, expect } from '@playwright/test'
import crypto from 'node:crypto'
import { iniciarSesion, escribirSecreto, guardarEnEnv, cedulaValida } from './ayudas.js'

const ENTORNO = process.env.E2E_CREAR_CUENTAS === 'DEMO' ? 'DEMO' : 'E2E'
test.skip(!process.env.E2E_CREAR_CUENTAS, 'Solo con E2E_CREAR_CUENTAS=E2E (o DEMO)')

const SUFIJO = ENTORNO === 'E2E' ? 'Pruebas' : 'Demo'
const DOMINIO = ENTORNO === 'E2E' ? 'pruebas-e2e.test' : 'opticademo.test'
const CUENTAS = [
  { prefijo: 'OPTOMETRA', rol: /^Optómetra/, nombre: `Paula Optómetra ${SUFIJO}`, correo: `optometra@${DOMINIO}` },
  { prefijo: 'RECEPCION', rol: /^Recepci[oó]n/, nombre: `Rosa Recepción ${SUFIJO}`, correo: `recepcion@${DOMINIO}` },
  { prefijo: 'VENTAS', rol: /^Ventas/, nombre: `Vera Ventas ${SUFIJO}`, correo: `ventas@${DOMINIO}` },
]

const claveNueva = () => `Demo-${crypto.randomBytes(5).toString('hex')}-${crypto.randomInt(10, 99)}Zq`

test(`crear Optómetra, Recepción y Ventas desde Usuarios (${ENTORNO})`, async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', ENTORNO)
  await page.getByRole('button', { name: /Usuarios y permisos/ }).first().click()
  await expect(page.getByRole('heading', { name: 'Usuarios y permisos' })).toBeVisible()

  for (const c of CUENTAS) {
    if (process.env[`${ENTORNO}_${c.prefijo}_EMAIL`] && process.env[`${ENTORNO}_${c.prefijo}_PASSWORD`]) continue
    const clave = claveNueva()
    guardarEnEnv({ [`${ENTORNO}_${c.prefijo}_EMAIL`]: c.correo, [`${ENTORNO}_${c.prefijo}_PASSWORD`]: clave })
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
