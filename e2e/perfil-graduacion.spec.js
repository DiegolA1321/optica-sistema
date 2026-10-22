// La pestaña «Diagnóstico» del perfil del paciente del personal (antes «Graduación»): todo el diagnóstico de la consulta elegida, con los ojos de la refracción ilustrados. Demo, solo lectura.
// Solo la ven los roles con permiso de Ficha clínica «ver»: Administrador, Optómetra, Recepción y Ventas lo tienen en sus roles predefinidos.
// Y la receta del portal: «Descargar receta» baja el PDF directamente (sin el diálogo de impresión).
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'
import { escribirSecreto, SLUG_DEMO } from './ayudas.js'
import { protegerDemo } from './guardia-demo.js'
import fs from 'node:fs'

const PACIENTE = 'Paciente Demostración Portal'
test.use({ viewport: { width: 1366, height: 768 } })

async function abrirPerfil(page, rol) {
  await iniciarSesion(page, rol)
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(PACIENTE)
  const fila = page.getByRole('row').filter({ hasText: PACIENTE })
  await expect(fila.getByRole('button', { name: /Ver perfil 360/ })).toBeVisible({ timeout: 30_000 })
  // La lista se vuelve a dibujar cuando llegan las consultas y un clic dado justo en ese momento se pierde: se espera a que la fila tenga sus datos y, si aun así el perfil no abre,
  // se vuelve a pulsar. No depende de cuánto tarde la carga: pasa en cuanto abre.
  await expect(fila).toContainText('20 abr 2026', { timeout: 45_000 }) // su última visita
  await expect(async () => {
    await fila.getByRole('button', { name: /Ver perfil 360/ }).click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
}

for (const rol of ['ADMIN', 'OPTOMETRA', 'RECEPCION', 'VENTAS']) {
  test(`${rol}: el perfil trae la pestaña Diagnóstico con todo el diagnóstico de la consulta, en vista técnica y para el paciente`, async ({ page }) => {
    test.setTimeout(120_000)
    await abrirPerfil(page, rol)
    // El Resumen ya no lleva los conteos de citas ni la gráfica (están en la pestaña Citas) y la cabecera ya no lleva el panel de la graduación
    await page.getByRole('tab', { name: /Resumen/ }).click()
    await expect(page.getByRole('region', { name: 'Citas del paciente' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Graduación vigente del/ })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toHaveCount(0)
    // La pestaña se llama «Diagnóstico»
    await expect(page.getByRole('tab', { name: /Graduación/ })).toHaveCount(0)
    await page.getByRole('tab', { name: /Diagnóstico/ }).click()
    await expect(page.getByRole('tab', { name: /Diagnóstico/ })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('heading', { name: 'Diagnóstico', exact: true, level: 1 })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(/20 abr 2026 · vigente/).first()).toBeVisible()
    // todo el diagnóstico de la consulta: diagnóstico, agudeza visual, los ojos de la refracción e indicaciones
    await expect(page.getByText('Agudeza visual').first()).toBeVisible()
    const od = page.getByRole('region', { name: 'Ojo derecho' })
    await expect(od).toContainText('OD · Ojo derecho')
    for (const t of ['Cil', 'Eje']) await expect(od).toContainText(t)
    for (const t of ['Sin corrección', 'Con su corrección actual']) await expect(page.getByRole('region', { name: 'Agudeza visual' })).toContainText(t)
    await expect(page.getByLabel('Medidas de la receta')).toContainText('Distancia pupilar')
    await expect(page.getByRole('region', { name: 'Diagnóstico', exact: true })).toContainText('Indicaciones')
    // el ojo izquierdo a la izquierda y el derecho a la derecha, también en la vista técnica
    const x = async (n) => (await page.getByRole('region', { name: n }).boundingBox()).x
    expect(await x('Ojo izquierdo')).toBeLessThan(await x('Ojo derecho'))
    // toda la tarjeta del ojo abre «Historia de este ojo»
    const caja = await od.boundingBox()
    await od.click({ position: { x: caja.width / 2, y: caja.height / 2 } })
    await expect(page.getByRole('dialog', { name: /Historia de este ojo/ })).toBeVisible()
    await page.keyboard.press('Escape')
    // el selector de consulta cambia toda la vista
    await page.locator('#diagnostico-consulta').click()
    await page.getByRole('option', { name: /21 nov 2025/ }).click()
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('−1.25')
    // el interruptor de dos opciones: Vista técnica | Para el paciente
    await expect(page.getByRole('button', { name: 'Explicar al paciente' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Para el paciente' }).click()
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('Tienes miopía leve')
    expect(await x('Ojo derecho')).toBeGreaterThan(await x('Ojo izquierdo'))
    await page.getByRole('button', { name: 'Vista técnica' }).click()
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('OD · Ojo derecho')
    // Comparar e Imprimir diagnóstico (no «recetas»)
    await page.getByRole('button', { name: 'Comparar', exact: true }).click()
    await expect(page.getByRole('dialog', { name: 'Comparar diagnósticos' })).toContainText(/Refracción · OD/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Imprimir diagnóstico' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Comparar dos recetas|Imprimir receta/ })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}

test('portal: «Descargar receta» baja el PDF directamente, sin el diálogo de impresión, con la receta elegida', async ({ page }) => {
  test.setTimeout(120_000)
  await protegerDemo(page)
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.DEMO_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mi receta', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mi receta' })).toBeVisible()
  // una receta anterior
  await page.getByRole('button', { name: /Elegir otra receta/ }).click()
  await page.getByRole('option', { name: /21 de noviembre de 2025/ }).click()
  let imprimio = false
  await page.exposeFunction('avisarImpresion', () => { imprimio = true })
  await page.evaluate(() => { window.print = () => window.avisarImpresion() })
  const descarga = page.waitForEvent('download', { timeout: 30_000 })
  await page.getByRole('button', { name: 'Descargar receta' }).click()
  const archivo = await descarga
  expect(archivo.suggestedFilename()).toMatch(/^receta-paciente-demostracion-portal-2025-11-21\.pdf$/)
  const ruta = await archivo.path()
  const bytes = fs.readFileSync(ruta)
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
  // Texto real (se puede seleccionar), no una imagen de la hoja
  const pdf = bytes.toString('latin1')
  expect(pdf).not.toContain('/DCTDecode')
  expect(pdf).not.toContain('/Subtype /Image')
  // WinAnsi: la «ó» es el byte 0xF3. Cada palabra de la hoja es un texto del PDF.
  for (const palabra of ['Paciente', 'Demostraci\xF3n', '0934070830', 'RECETA', 'ESFERA', '-1.25', 'Paula', 'Reg.']) expect(pdf, `el PDF tiene el texto «${palabra}»`).toContain(`(${palabra})`)
  expect(pdf).toMatch(/BT \/F\d [\d.]+ Tf [\d.]+ Tz [\d.]+ [\d.]+ Td \(/)
  expect(bytes.length).toBeGreaterThan(2_000)
  expect(imprimio, 'no abre el diálogo de impresión').toBe(false)
  await expect(page.getByText('Descargamos tu receta del')).toBeVisible()
})
