// Comunicación interna por niveles, de punta a punta con varias sesiones (migración 0116):
//   1. Recepción reporta un problema con un PDF adjunto → el administrador lo ve → lo escala al superadmin → el superadmin responde → Recepción ve la respuesta.
//   2. El administrador publica un aviso para el rol Optómetra y ve quién lo leyó.
// ESCRIBE datos: corre en la óptica de pruebas (E2E); las consultas y avisos "E2E " se borran al terminar (e2e/limpiar-soporte.js), también si falla.
// Necesita la migración 0116 aplicada y SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en el entorno (o en .env.test); sin ellas, se omite.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto } from './ayudas.js'
import { limpiarSoporteDePruebas } from './limpiar-soporte.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.beforeAll(limpiarSoporteDePruebas)
test.afterAll(limpiarSoporteDePruebas)

// Un PDF mínimo: el documento de prueba.
const PDF = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n')

async function entrarComoSuperadmin(page) {
  await page.goto('/?sitio=admin')
  await escribirSecreto(page, page.locator('#usuario-solo'), process.env.SUPERADMIN_EMAIL)
  await escribirSecreto(page, page.locator('#password-solo'), process.env.SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Soporte', exact: true }).first()).toBeVisible({ timeout: 30_000 })
}
const irASoporte = (page) => page.getByRole('button', { name: 'Soporte', exact: true }).first().click()

test('Recepción reporta con un PDF; el administrador la escala; el superadmin responde; Recepción ve la respuesta', async ({ browser }) => {
  test.skip(!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD, 'Faltan SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD')
  test.setTimeout(300_000)
  const asunto = `E2E Comunicación ${Date.now().toString(36)}`

  // ── 1. Recepción escribe a su administrador, con un PDF
  const ctxRecepcion = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const recepcion = await ctxRecepcion.newPage()
  await iniciarSesion(recepcion, 'RECEPCION', 'E2E')
  await irASoporte(recepcion)
  await expect(recepcion.getByRole('tab', { name: /Mis consultas/ })).toHaveAttribute('aria-selected', 'true')
  // Recepción no tiene "Soporte del sistema": escribe a su administrador
  await expect(recepcion.getByRole('tab', { name: /Soporte del sistema/ })).toHaveCount(0)
  await recepcion.getByRole('button', { name: /Nueva consulta/ }).first().click()
  const v = recepcion.getByRole('dialog', { name: 'Nueva consulta' })
  await expect(v.getByText('Cuéntale a tu administrador qué pasa')).toBeVisible()
  await v.getByLabel('¿De qué módulo es?').selectOption('ventas')
  await v.getByLabel('Asunto').fill(asunto)
  await v.getByLabel('Descripción').fill('No puedo emitir el comprobante de una venta. Adjunto el informe.')
  await v.locator('input[type=file]').setInputFiles({ name: 'informe.pdf', mimeType: 'application/pdf', buffer: PDF })
  await expect(v.getByText('informe.pdf')).toBeVisible()
  await v.getByRole('button', { name: 'Enviar consulta' }).click()
  const enviada = recepcion.getByRole('dialog', { name: 'Consulta enviada' })
  await expect(enviada.getByText(/^SOP-\d{4}$/)).toBeVisible({ timeout: 30_000 })
  await expect(enviada.getByText(/Tu administrador la verá y te responderá/)).toBeVisible()
  const codigo = (await enviada.getByText(/^SOP-\d{4}$/).textContent()).trim()
  await enviada.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  const fila = recepcion.getByRole('listitem').filter({ hasText: asunto })
  await expect(fila).toContainText('Con tu administrador')

  // ── 2. El administrador la ve en "Consultas del personal", con el PDF para descargar, y la escala
  const ctxAdmin = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const admin = await ctxAdmin.newPage()
  await iniciarSesion(admin, 'ADMIN', 'E2E')
  await irASoporte(admin)
  await expect(admin.getByRole('tab', { name: /Consultas del personal/ })).toHaveAttribute('aria-selected', 'true')
  await admin.getByRole('button', { name: asunto }).click({ timeout: 30_000 })
  const ventanaAdmin = admin.getByRole('dialog')
  await expect(ventanaAdmin.getByText('La atiendes tú')).toBeVisible()
  await expect(ventanaAdmin.getByRole('link', { name: /Descargar informe\.pdf/ })).toBeVisible({ timeout: 20_000 })
  await ventanaAdmin.getByRole('button', { name: /Escalar al soporte del sistema/ }).click()
  await ventanaAdmin.getByLabel('Escalar al soporte del sistema').fill('E2E nota: no logro reproducirlo')
  await ventanaAdmin.getByRole('button', { name: 'Escalar consulta' }).click()
  await expect(ventanaAdmin.getByText('Escalé esta consulta al soporte del sistema.')).toBeVisible({ timeout: 20_000 })
  await expect(ventanaAdmin.getByText('Escalada al soporte del sistema')).toBeVisible()
  await expect(ventanaAdmin.getByRole('button', { name: /Escalar al soporte del sistema/ })).toHaveCount(0)
  await ventanaAdmin.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  // ── 3. El superadmin la ve con toda la conversación y el PDF, y responde
  const ctxSuper = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const superadmin = await ctxSuper.newPage()
  await entrarComoSuperadmin(superadmin)
  await irASoporte(superadmin)
  // QA Test Claude es un entorno de prueba: el Soporte del superadmin lo oculta por defecto.
  await superadmin.getByRole('checkbox', { name: /Incluir entornos de prueba/ }).check({ force: true })
  const lista = superadmin.getByRole('list', { name: 'Consultas de soporte' })
  await lista.getByRole('button', { name: asunto }).click({ timeout: 30_000 })
  const ventanaSuper = superadmin.getByRole('dialog')
  await expect(ventanaSuper.getByText(/La escaló el administrador/)).toBeVisible()
  await expect(ventanaSuper.getByRole('link', { name: /Descargar informe\.pdf/ })).toBeVisible({ timeout: 20_000 })
  await expect(ventanaSuper.getByText('E2E nota: no logro reproducirlo')).toBeVisible()
  await ventanaSuper.getByLabel('Tu respuesta').fill('E2E respuesta del soporte: ya corregimos el comprobante.')
  await ventanaSuper.getByRole('button', { name: 'Enviar respuesta' }).click()
  await expect(ventanaSuper.getByText('E2E respuesta del soporte: ya corregimos el comprobante.')).toBeVisible({ timeout: 20_000 })
  await ventanaSuper.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  // ── 4. Recepción ve la respuesta en la campanita y en su conversación
  await recepcion.reload()
  await recepcion.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(recepcion.getByText(`Respondieron tu consulta ${codigo}`)).toBeVisible({ timeout: 30_000 })
  await recepcion.getByText(`Respondieron tu consulta ${codigo}`).click()
  const conversacion = recepcion.getByRole('dialog')
  await expect(conversacion.getByText('E2E respuesta del soporte: ya corregimos el comprobante.')).toBeVisible({ timeout: 20_000 })
  await expect(conversacion.getByText('E2E nota: no logro reproducirlo')).toBeVisible()

  // Sin desplazamiento horizontal a 1366×768
  await conversacion.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  expect(await recepcion.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await ctxRecepcion.close()
  await ctxAdmin.close()
  await ctxSuper.close()
})

test('El administrador publica un aviso para el rol Optómetra y ve quién lo leyó', async ({ browser }) => {
  test.setTimeout(240_000)
  const titulo = `E2E Aviso ${Date.now().toString(36)}`

  const ctxAdmin = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const admin = await ctxAdmin.newPage()
  await iniciarSesion(admin, 'ADMIN', 'E2E')
  await irASoporte(admin)
  await admin.getByRole('tab', { name: /^Avisos/ }).click()
  await admin.getByRole('button', { name: /Nuevo aviso/ }).first().click()
  const v = admin.getByRole('dialog', { name: 'Nuevo aviso' })
  await v.getByLabel('Título').fill(titulo)
  await v.getByLabel('Mensaje').fill('E2E: reunión de optómetras el lunes a las 8.')
  await v.getByLabel('Para').selectOption('rol')
  await v.getByLabel('Rol').selectOption({ label: 'Optómetra' })
  await v.getByRole('button', { name: 'Publicar aviso' }).click()
  await expect(admin.getByRole('dialog', { name: 'Nuevo aviso' })).toHaveCount(0, { timeout: 20_000 })
  const aviso = admin.getByRole('list', { name: 'Avisos' }).getByRole('listitem').filter({ hasText: titulo }).first()
  await expect(aviso).toContainText('Para: Rol Optómetra')
  await expect(aviso).toContainText(/Leído por 0 de \d+/)

  // Paula (Optómetra) lo ve en la campanita y en Avisos; Recepción no es destinataria
  const ctxPaula = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const paula = await ctxPaula.newPage()
  await iniciarSesion(paula, 'OPTOMETRA', 'E2E')
  await paula.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(paula.getByText(/aviso de tu administrador sin leer|avisos de tu administrador sin leer/)).toBeVisible({ timeout: 30_000 })
  await paula.keyboard.press('Escape')
  await irASoporte(paula)
  await paula.getByRole('tab', { name: /^Avisos/ }).click()
  const suyo = paula.getByRole('list', { name: 'Avisos' }).getByRole('listitem').filter({ hasText: titulo })
  await expect(suyo).toContainText('De tu administrador')
  await expect(suyo).toContainText('Nuevo')
  await suyo.getByRole('button', { name: 'Marcar como leído' }).click()
  await expect(suyo.getByRole('button', { name: 'Marcar como leído' })).toHaveCount(0, { timeout: 20_000 })

  const ctxRecepcion = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const recepcion = await ctxRecepcion.newPage()
  await iniciarSesion(recepcion, 'RECEPCION', 'E2E')
  await irASoporte(recepcion)
  await recepcion.getByRole('tab', { name: /^Avisos/ }).click()
  await expect(recepcion.getByText(titulo)).toHaveCount(0)

  // El administrador ve quién lo leyó
  await admin.reload()
  await admin.getByRole('tab', { name: /^Avisos/ }).click()
  const despues = admin.getByRole('list', { name: 'Avisos' }).getByRole('listitem').filter({ hasText: titulo }).first()
  await expect(despues).toContainText(/Leído por 1 de \d+/, { timeout: 20_000 })
  await despues.getByText(/Leído por 1 de/).click()
  const quien = despues.getByRole('list', { name: `Quién leyó «${titulo}»` })
  await expect(quien.getByRole('listitem').filter({ hasText: 'Paula' })).toContainText('Leído')
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await ctxAdmin.close()
  await ctxPaula.close()
  await ctxRecepcion.close()
})
