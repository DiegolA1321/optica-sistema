// «Solicitar lentes nuevos» de punta a punta, en la óptica de pruebas (migración 0129): el paciente pide desde su portal; la solicitud llega a Ventas («Por vender», «Desde el portal») y al Inicio
// («Requiere tu atención»); el personal la toma («En atención») y la cierra («No compró»); y el paciente ve cada estado en su portal: Recibida · En atención · Atendida.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function entrarPaciente(page) {
  await page.goto(`/?optica=${SLUG_PRUEBAS}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.E2E_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mis compras' })).toBeVisible()
}

test('el paciente solicita lentes, el personal la atiende y el paciente ve su estado', async ({ browser }) => {
  test.setTimeout(240_000)
  const portal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await entrarPaciente(portal)

  // 1. El paciente pide: una opción y un comentario. Sin elegir, no deja enviar.
  await portal.getByRole('button', { name: 'Solicitar lentes nuevos' }).click()
  const ventana = portal.getByRole('dialog', { name: 'Solicitar lentes nuevos' })
  await ventana.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(ventana.getByRole('alert')).toContainText('Elige qué te interesa.')
  await ventana.getByRole('radio', { name: /Lentes de sol/ }).click()
  await ventana.getByRole('textbox').fill('Los quiero con marco oscuro')
  await ventana.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(ventana).toHaveCount(0, { timeout: 20_000 })
  const filaPaciente = portal.getByRole('list', { name: 'Tus solicitudes de lentes' }).getByRole('listitem').first()
  await expect(filaPaciente).toContainText('Lentes de sol')
  await expect(filaPaciente).toContainText('Recibida')
  await expect(portal.getByRole('button', { name: 'Solicitar lentes nuevos' })).toBeDisabled() // una sola en curso

  // 2. El personal la ve en Inicio («Requiere tu atención») y en Ventas · Por vender, marcada «Desde el portal»
  const personal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await iniciarSesion(personal, 'ADMIN', 'E2E')
  await expect(personal.getByText(/pidió lentes nuevos desde su portal/)).toBeVisible({ timeout: 30_000 })
  await personal.getByRole('button', { name: /^Ventas/ }).first().click()
  await expect(personal.getByRole('tab', { name: /Por vender/ })).toBeVisible({ timeout: 20_000 })
  const fila = personal.getByRole('listitem').filter({ hasText: 'Desde el portal' }).first()
  await expect(fila).toContainText('Lentes de sol')
  await expect(fila).toContainText('Los quiero con marco oscuro')

  // 3. «Tomar datos del diagnóstico» la pasa a «En atención» y el paciente lo ve
  await fila.getByRole('button', { name: 'Tomar datos del diagnóstico' }).click()
  await expect(personal.getByRole('dialog').first()).toBeVisible({ timeout: 20_000 })
  await personal.keyboard.press('Escape')
  await portal.reload()
  await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  await expect(portal.getByRole('list', { name: 'Tus solicitudes de lentes' })).toContainText('En atención', { timeout: 30_000 })

  // 4. «No compró» la cierra y el paciente la ve «Atendida» (sin el motivo, que es de la óptica); ya puede pedir otra
  await personal.getByRole('listitem').filter({ hasText: 'Desde el portal' }).first().getByRole('button', { name: /E Dos E|Paciente/ }).first().click()
  const detalle = personal.getByRole('dialog', { name: /Por vender/ })
  await expect(detalle).toContainText('Desde el portal')
  await detalle.getByRole('button', { name: 'No compró' }).click()
  const noCompro = personal.getByRole('dialog', { name: 'No compró' })
  await noCompro.getByLabel('Por el precio').check()
  await noCompro.getByRole('button', { name: 'Guardar' }).click()
  await expect(noCompro).toHaveCount(0, { timeout: 20_000 })
  await portal.reload()
  await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  const lista = portal.getByRole('list', { name: 'Tus solicitudes de lentes' })
  await expect(lista).toContainText('Atendida', { timeout: 30_000 })
  await expect(lista).not.toContainText('precio')
  await expect(portal.getByRole('button', { name: 'Solicitar lentes nuevos' })).toBeEnabled()
})
