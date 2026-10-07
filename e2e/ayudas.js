// Ayudas compartidas. SOLO la Óptica Demo (slug qu7u2j); nunca otra óptica.
import { expect } from '@playwright/test'
import fs from 'node:fs'

export const SLUG_DEMO = 'qu7u2j'

export function credencial(prefijo) {
  const correo = process.env[`DEMO_${prefijo}_EMAIL`]
  const clave = process.env[`DEMO_${prefijo}_PASSWORD`]
  if (!correo || !clave) throw new Error(`Faltan DEMO_${prefijo}_EMAIL / DEMO_${prefijo}_PASSWORD en .env.test`)
  return { correo, clave }
}

// Escribe un valor sensible sin pasar por fill(): el registro de llamadas de Playwright no lo repite en errores.
export async function escribirSecreto(page, locator, valor) {
  await locator.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(valor)
}

export async function iniciarSesion(page, prefijo) {
  const { correo, clave } = credencial(prefijo)
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), correo)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), clave)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  // No se aserta sobre el campo de contraseña: el registro de Playwright volcaría su HTML con el valor.
  // Sesión iniciada = desaparece la página pública (y su botón "Iniciar sesión"); si falla, se muestra el alert.
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toHaveCount(0, { timeout: 25_000 })
}

// Agrega o reemplaza claves en .env.test sin imprimirlas.
export function guardarEnEnv(pares) {
  let texto = fs.existsSync('.env.test') ? fs.readFileSync('.env.test', 'utf8') : ''
  if (texto && !texto.endsWith('\n')) texto += '\n'
  for (const [k, v] of Object.entries(pares)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    texto = re.test(texto) ? texto.replace(re, () => `${k}=${v}`) : texto + `${k}=${v}\n`
    process.env[k] = v
  }
  fs.writeFileSync('.env.test', texto)
}
