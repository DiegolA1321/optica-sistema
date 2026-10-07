// Ayudas compartidas. SOLO la Óptica Demo (slug qu7u2j); nunca otra óptica.
import { expect } from '@playwright/test'

export const SLUG_DEMO = 'qu7u2j'

export function credencial(prefijo) {
  const correo = process.env[`DEMO_${prefijo}_EMAIL`]
  const clave = process.env[`DEMO_${prefijo}_PASSWORD`]
  if (!correo || !clave) throw new Error(`Faltan DEMO_${prefijo}_EMAIL / DEMO_${prefijo}_PASSWORD en .env.test`)
  return { correo, clave }
}

export async function iniciarSesion(page, prefijo) {
  const { correo, clave } = credencial(prefijo)
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await page.getByPlaceholder('Cédula o nombre de usuario').fill(correo)
  await page.getByPlaceholder('Tu contraseña').fill(clave)
  await page.getByRole('button', { name: /^Iniciar sesión$|^Entrar$|^Ingresar$/ }).last().click()
  await expect(page.getByPlaceholder('Tu contraseña')).toBeHidden({ timeout: 20_000 })
}
