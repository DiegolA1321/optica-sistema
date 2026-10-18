// La pestaña «Graduación» del perfil del paciente del personal: la misma vista que «Mi receta» del portal, en su versión técnica. Demo, solo lectura.
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
  await expect(fila).toContainText('Graduación:', { timeout: 45_000 })
  await expect(async () => {
    await fila.getByRole('button', { name: /Ver perfil 360/ }).click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
}

for (const rol of ['ADMIN', 'OPTOMETRA', 'RECEPCION', 'VENTAS']) {
  test(`${rol}: el perfil trae la pestaña Graduación con la vista del portal en versión técnica`, async ({ page }) => {
    test.setTimeout(120_000)
    await abrirPerfil(page, rol)
    // La graduación salió del Resumen
    await page.getByRole('tab', { name: /Resumen/ }).click()
    await expect(page.getByRole('region', { name: 'Citas del paciente' })).toBeVisible()
    await expect(page.getByText('Tendencia de graduación medida')).toHaveCount(0)
    await expect(page.getByText('Graduación vigente')).toHaveCount(0)
    // La pestaña
    await page.getByRole('tab', { name: /Graduación/ }).click()
    await expect(page.getByRole('heading', { name: 'Graduación', exact: true })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('button', { name: /Elegir otra receta/ })).toContainText('Receta del 20 de abril de 2026 · vigente')
    const od = page.getByRole('region', { name: 'Ojo derecho' })
    await expect(od).toContainText('OD · Ojo derecho')
    for (const t of ['Esfera', 'Cilindro', 'Eje', 'AV sin lentes', 'AV con lentes']) await expect(od).toContainText(t)
    await expect(page.getByLabel('Medidas de la receta')).toContainText('Distancia pupilar (DP)')
    await expect(page.getByRole('region', { name: 'Cambio desde la consulta anterior' })).toBeVisible()
    await expect(page.getByText('Tendencia de graduación medida')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Indicaciones' })).toBeVisible()
    // el OD a la izquierda del OI en la vista técnica
    const x = async (n) => (await page.getByRole('region', { name: n }).boundingBox()).x
    expect(await x('Ojo derecho')).toBeLessThan(await x('Ojo izquierdo'))
    // el selector cambia toda la vista
    await page.getByRole('button', { name: /Elegir otra receta/ }).click()
    await page.getByRole('option', { name: /21 de noviembre de 2025/ }).click()
    await expect(page.getByRole('button', { name: /Elegir otra receta/ })).not.toContainText('vigente')
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('−1.25')
    // «Explicar al paciente»: palabras simples, con el ojo derecho a la derecha
    await page.getByRole('button', { name: 'Explicar al paciente' }).click()
    await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('Tienes miopía leve')
    expect(await x('Ojo derecho')).toBeGreaterThan(await x('Ojo izquierdo'))
    await page.getByRole('button', { name: 'Volver a la vista técnica' }).click()
    // Comparar dos recetas
    await page.getByRole('button', { name: 'Comparar dos recetas' }).click()
    await expect(page.getByRole('dialog', { name: 'Comparar dos recetas' })).toContainText(/Cambiaron|Las dos recetas/)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Imprimir receta' })).toBeVisible()
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
  expect(bytes.toString('latin1')).toContain('/DCTDecode')
  expect(bytes.length).toBeGreaterThan(8_000)
  expect(imprimio, 'no abre el diálogo de impresión').toBe(false)
  await expect(page.getByText('Descargamos tu receta del')).toBeVisible()
})
