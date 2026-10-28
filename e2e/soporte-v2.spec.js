// Soporte v2, de punta a punta con dos sesiones: la óptica escribe una consulta URGENTE con una captura; el superadmin la ve primero, deja una nota interna y responde;
// la óptica la ve en la campanita y en "Mis consultas" (sin la nota interna), responde; el superadmin la resuelve; la óptica la califica.
// ESCRIBE datos: corre en la óptica de pruebas (E2E) y la limpia scripts/limpiar-optica-pruebas.mjs antes de la próxima corrida.
// Necesita la migración 0115 aplicada y SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en el entorno (o en .env.test); sin ellas, se omite.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto } from './ayudas.js'
import { limpiarSoporteDePruebas } from './limpiar-soporte.js'

test.use({ viewport: { width: 1366, height: 768 } })

// Las consultas de la prueba se borran al terminar, también si falla (y antes, por si una corrida anterior se cortó).
test.beforeAll(limpiarSoporteDePruebas)
test.afterAll(limpiarSoporteDePruebas)

// Un PNG de 1×1 píxel: la captura de prueba.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')

async function entrarComoSuperadmin(page) {
  await page.goto('/?sitio=admin')
  await escribirSecreto(page, page.locator('#usuario-solo'), process.env.SUPERADMIN_EMAIL)
  await escribirSecreto(page, page.locator('#password-solo'), process.env.SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Soporte', exact: true }).first()).toBeVisible({ timeout: 30_000 })
}

test('La óptica escribe una consulta urgente con captura; el superadmin la atiende; la óptica responde y califica', async ({ browser }) => {
  test.skip(!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD, 'Faltan SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD')
  test.setTimeout(300_000)
  const asunto = `E2E Soporte urgente ${Date.now().toString(36)}`
  const asuntoNormal = `E2E Soporte normal ${Date.now().toString(36)}`

  // ── 1. La óptica escribe dos consultas: una normal (primero) y una urgente con captura
  const contextoOptica = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const optica = await contextoOptica.newPage()
  await iniciarSesion(optica, 'ADMIN', 'E2E')
  await optica.getByRole('button', { name: 'Soporte', exact: true }).first().click()
  await expect(optica.getByRole('heading', { level: 1, name: 'Soporte' })).toBeVisible()
  // La ayuda: las preguntas por módulo, con buscador (es la última pestaña; el administrador abre en "Consultas del personal")
  await optica.getByRole('tab', { name: 'Ayuda' }).click()
  await expect(optica.getByRole('group', { name: 'Ayuda de Citas' })).toBeVisible()
  await optica.getByLabel('Buscar en la ayuda').fill('abono')
  await expect(optica.getByText('¿Cómo registro, corrijo o anulo un abono?')).toBeVisible()
  await optica.getByLabel('Buscar en la ayuda').fill('')
  // El administrador escribe al soporte del sistema desde su pestaña
  await optica.getByRole('tab', { name: /Soporte del sistema/ }).click()

  const escribir = async (texto, urgente, conCaptura) => {
    await optica.getByRole('button', { name: /Nueva consulta/ }).first().click()
    const v = optica.getByRole('dialog', { name: 'Nueva consulta' })
    await v.getByLabel('¿De qué módulo es?').selectOption('ventas')
    if (urgente) await v.getByLabel(/^Urgente/).check({ force: true })
    await v.getByLabel('Asunto').fill(texto)
    await v.getByLabel('Descripción').fill('Al cobrar un abono la pantalla se queda cargando y no puedo entregar los lentes.')
    if (conCaptura) await v.locator('input[type=file]').setInputFiles({ name: 'captura.png', mimeType: 'image/png', buffer: PNG })
    await v.getByRole('button', { name: 'Enviar consulta' }).click()
    const c = optica.getByRole('dialog', { name: 'Consulta enviada' })
    await expect(c.getByText(/^SOP-\d{4}$/)).toBeVisible({ timeout: 30_000 })
    await expect(c.getByText(urgente ? /el mismo día hábil/ : /1 día hábil/)).toBeVisible()
    const codigo = (await c.getByText(/^SOP-\d{4}$/).textContent()).trim()
    await c.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
    return codigo
  }
  await escribir(asuntoNormal, false, false)
  const codigo = await escribir(asunto, true, true)

  // Mis consultas: la fila muestra urgencia y estado (el número y el módulo salen al enviarla y en la campanita, más abajo)
  await optica.getByRole('tab', { name: /Soporte del sistema/ }).click()
  const fila = optica.getByRole('listitem').filter({ hasText: asunto })
  await expect(fila).toContainText('Urgente')
  await expect(fila).toContainText('Recibida')

  // ── 2. El superadmin la ve primero (urgente), con su contexto y su captura; deja una nota interna y responde
  const contextoSuper = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const superadmin = await contextoSuper.newPage()
  await entrarComoSuperadmin(superadmin)
  await superadmin.getByRole('button', { name: 'Soporte', exact: true }).first().click()
  // QA Test Claude es un entorno de prueba: el Soporte del superadmin lo oculta por defecto.
  await superadmin.getByRole('checkbox', { name: /Incluir entornos de prueba/ }).check({ force: true })
  const lista = superadmin.getByRole('list', { name: 'Consultas de soporte' })
  await expect(lista.getByRole('listitem').first()).toContainText(asunto, { timeout: 30_000 })
  await expect(lista.getByRole('listitem').first()).toContainText('Urgente')
  await lista.getByRole('button', { name: asunto }).click()
  const ventanaSuper = superadmin.getByRole('dialog')
  await ventanaSuper.getByText('Contexto que envió el sistema').click()
  await expect(ventanaSuper.getByText('Ventas', { exact: true }).first()).toBeVisible()
  await expect(ventanaSuper.getByRole('img', { name: /Captura: captura\.png/ })).toBeVisible({ timeout: 20_000 })
  await ventanaSuper.getByLabel('Nota interna (la óptica no la ve)').check()
  await ventanaSuper.getByLabel('Nota interna', { exact: true }).fill('E2E nota interna: revisar el abono')
  await ventanaSuper.getByRole('button', { name: 'Guardar nota interna' }).click()
  await expect(ventanaSuper.getByText('E2E nota interna: revisar el abono')).toBeVisible({ timeout: 20_000 })
  await ventanaSuper.getByLabel('Tu respuesta').fill('E2E respuesta del soporte: recarga la página e intenta de nuevo.')
  await ventanaSuper.getByRole('button', { name: 'Enviar respuesta' }).click()
  await expect(ventanaSuper.getByText('E2E respuesta del soporte: recarga la página e intenta de nuevo.')).toBeVisible({ timeout: 20_000 })
  await expect(ventanaSuper.getByRole('combobox', { name: /^Estado/ })).toHaveValue('respondida')
  await ventanaSuper.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  // ── 3. La óptica la ve en la campanita y en Mis consultas, sin la nota interna; responde
  await optica.reload()
  await optica.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(optica.getByText(`Respondieron tu consulta ${codigo}`)).toBeVisible({ timeout: 30_000 })
  await optica.getByText(`Respondieron tu consulta ${codigo}`).click()
  const conversacion = optica.getByRole('dialog')
  await expect(conversacion.getByText('E2E respuesta del soporte: recarga la página e intenta de nuevo.')).toBeVisible({ timeout: 20_000 })
  await expect(conversacion.getByText('E2E nota interna')).toHaveCount(0)
  await expect(conversacion.getByText('Nota interna: la óptica no la ve')).toHaveCount(0)
  await conversacion.getByLabel('Tu mensaje').fill('E2E: ya probé y sigue igual')
  await conversacion.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(conversacion.getByText('E2E: ya probé y sigue igual')).toBeVisible({ timeout: 20_000 })
  await expect(conversacion.getByText('En revisión').first()).toBeVisible()
  await conversacion.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  await optica.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(optica.getByText(`Respondieron tu consulta ${codigo}`)).toHaveCount(0) // ya la leyó: la campanita bajó
  await optica.keyboard.press('Escape')

  // ── 4. El superadmin la resuelve; la óptica la califica
  await superadmin.reload()
  await superadmin.getByRole('button', { name: 'Soporte', exact: true }).first().click()
  await superadmin.getByRole('checkbox', { name: /Incluir entornos de prueba/ }).check({ force: true })
  await superadmin.getByRole('list', { name: 'Consultas de soporte' }).getByRole('button', { name: asunto }).click()
  const v2 = superadmin.getByRole('dialog')
  await v2.getByRole('combobox', { name: /^Estado/ }).selectOption('resuelta')
  await expect(v2.getByText('Resuelta').first()).toBeVisible({ timeout: 20_000 })
  await v2.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  await optica.getByRole('tab', { name: /Soporte del sistema/ }).click()
  await optica.reload()
  await optica.getByRole('tab', { name: /Soporte del sistema/ }).click()
  await optica.getByRole('button', { name: asunto }).click()
  const fin = optica.getByRole('dialog')
  await expect(fin.getByText(/Consulta resuelta/)).toBeVisible({ timeout: 20_000 })
  await fin.getByRole('radio', { name: '5 estrellas' }).click()
  await fin.getByLabel('Comentario sobre la atención').fill('E2E atención rápida')
  await fin.getByRole('button', { name: 'Enviar calificación' }).click()
  await expect(fin.getByText(/Calificaste la atención con 5 de 5/)).toBeVisible({ timeout: 20_000 })

  // Sin desplazamiento horizontal a 1366×768
  await fin.getByRole('button', { name: 'Cerrar', exact: true }).last().click()
  expect(await optica.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await contextoOptica.close()
  await contextoSuper.close()
})
