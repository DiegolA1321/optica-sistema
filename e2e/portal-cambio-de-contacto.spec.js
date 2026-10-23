// El paciente cambia su teléfono desde «Mis datos» (óptica de pruebas): se actualiza en la ficha y la óptica recibe el aviso en «Requiere tu atención» del Inicio («… actualizó su teléfono»);
// quien lo ve lo marca como visto.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

test('el paciente cambia su teléfono: la ficha lo muestra y la óptica recibe el aviso', async ({ browser }) => {
  test.setTimeout(240_000)
  const nuevo = '09' + String(Date.now()).slice(-8)
  const portal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await portal.goto(`/?optica=${SLUG_PRUEBAS}`)
  await portal.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(portal, portal.getByPlaceholder('Ej. 0912345678 o tu usuario'), process.env.E2E_PORTAL_CEDULA)
  await escribirSecreto(portal, portal.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
  await portal.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(portal.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis datos', exact: true }).click()
  await portal.getByRole('button', { name: 'Cambiar teléfono y whatsapp' }).click()
  const campo = portal.getByLabel('Teléfono y WhatsApp')
  await campo.fill(nuevo)
  await portal.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(portal.getByText('Listo: actualizamos tu teléfono.')).toBeVisible({ timeout: 20_000 })

  const personal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await iniciarSesion(personal, 'ADMIN', 'E2E')
  await expect(personal.getByRole('button', { name: /actualizó? su contacto desde su portal|actualizaron su contacto desde su portal/ }).first()).toBeVisible({ timeout: 40_000 })
  // la ficha del paciente tiene el teléfono nuevo
  await personal.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await personal.getByRole('textbox', { name: /buscar paciente/i }).fill('E Dos E Portal Auditoria')
  await expect(personal.getByRole('row').filter({ hasText: 'E Dos E Portal Auditoria' }).first()).toContainText(nuevo, { timeout: 30_000 })
  // el aviso se marca como visto
  await personal.getByRole('button', { name: 'Inicio', exact: true }).first().click()
  // (las corridas anteriores pueden haber dejado avisos: se marcan todos)
  const grupo = personal.getByRole('button', { name: /actualizó su contacto desde su portal|actualizaron su contacto desde su portal/ })
  for (let n = 0; n < 6 && (await grupo.count()); n++) {
    await grupo.first().click()
    await personal.getByRole('button', { name: 'Visto' }).first().click()
    await personal.keyboard.press('Escape')
    await personal.waitForTimeout(500)
  }
  await expect(grupo).toHaveCount(0, { timeout: 15_000 })
})
