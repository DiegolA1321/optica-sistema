// Usuarios: el registro profesional sale en las recetas que firma quien atiende, así que es obligatorio para un rol que puede crear fichas clínicas (Optómetra) y opcional para los demás.
// Solo comprueba la validación del formulario y la edición de un usuario existente (Paula), a la que le devuelve su registro al terminar: NO crea cuentas.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, SLUG_PRUEBAS, cedulaValida } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 800 }, actionTimeout: 15_000 })
const bd = async (fn) => { const c = new pg.Client(); await c.connect(); try { return await fn(c) } finally { await c.end() } }

test('crear un usuario con rol de optómetra exige su registro profesional; uno sin atención no', async ({ page }) => {
  test.setTimeout(120_000)
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Usuarios y permisos', exact: true }).first().click()
  await page.getByRole('button', { name: 'Crear usuario' }).first().click()
  const ventana = page.getByRole('dialog').last()
  await ventana.getByPlaceholder('Ej. Ana Torres').fill('Prueba Registro')
  await ventana.getByPlaceholder('10 dígitos').fill(cedulaValida())
  await ventana.getByPlaceholder('ana.torres@correo.com').fill('registro.prueba@pruebas-e2e.test')
  // Sin un rol que atienda: el registro es opcional
  await expect(ventana.getByText('Registro profesional')).toBeVisible()
  await expect(ventana.getByPlaceholder('Opcional')).toBeVisible()
  // Con Optómetra (puede crear fichas clínicas): obligatorio
  await ventana.locator('label').filter({ hasText: /^Optómetra/ }).first().getByRole('checkbox').check()
  await expect(ventana.getByPlaceholder('Sale en la receta')).toBeVisible()
  await ventana.getByRole('button', { name: 'Crear usuario' }).click()
  await expect(ventana.getByRole('alert')).toContainText('Completa el registro profesional')
})

test('el registro profesional de un usuario se edita desde Usuarios y sale en su perfil', async ({ page }) => {
  test.setTimeout(120_000)
  const [paula] = await bd(async (c) => (await c.query("select p.id, p.registro_profesional from perfiles p join opticas o on o.id = p.optica_id where o.slug = $1 and p.nombre like 'Paula%'", [SLUG_PRUEBAS])).rows)
  try {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Usuarios y permisos', exact: true }).first().click()
    await page.getByRole('button', { name: 'Editar Paula Optómetra Pruebas' }).click()
    const ventana = page.getByRole('dialog').last()
    await expect(ventana.getByPlaceholder('Sale en la receta')).toHaveValue(paula.registro_profesional || '')
    await ventana.getByPlaceholder('Sale en la receta').fill('REG-OPT-EDITADO')
    await ventana.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText(/actualizado correctamente/)).toBeVisible({ timeout: 20_000 })
    const [despues] = await bd(async (c) => (await c.query('select registro_profesional from perfiles where id = $1', [paula.id])).rows)
    expect(despues.registro_profesional).toBe('REG-OPT-EDITADO')
  } finally {
    await bd(async (c) => c.query('update perfiles set registro_profesional = $2 where id = $1', [paula.id, paula.registro_profesional]))
  }
})
