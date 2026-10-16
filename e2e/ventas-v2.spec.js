// Ventas v2, en la Óptica Demo (SOLO LECTURA: abre pantallas y ventanas, no guarda nada).
// A 1366×768 ninguna lista ni ventana de Ventas tiene desplazamiento horizontal, y los números de las pestañas son los de las listas.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

// ¿Hay algún desplazamiento horizontal? La página o cualquier elemento que lo permita (overflow-x auto o scroll) con más ancho que su caja.
async function desplazamientoHorizontal(page) {
  return page.evaluate(() => {
    const culpables = []
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) culpables.push('la página')
    for (const el of document.querySelectorAll('main *, [role="dialog"], [role="dialog"] *')) {
      const o = getComputedStyle(el).overflowX
      if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 1) culpables.push((el.getAttribute('aria-label') || el.className || el.tagName).toString().slice(0, 60))
    }
    return culpables
  })
}

test.describe('Ventas v2 (Demo, solo lectura)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'DEMO')
    await page.getByRole('button', { name: /^Ventas/ }).first().click()
    await expect(page.getByRole('tab', { name: /Por vender/ })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 20_000 })
  })

  test('cuatro pestañas con su número, sin tarjetas que hagan de pestañas, y la cabecera como la de Citas', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible()
    const nombres = await page.getByRole('tab').allTextContents()
    expect(nombres.map((t) => t.replace(/\d+$/, '').trim())).toEqual(['Por vender', 'Comprobantes', 'Órdenes de laboratorio', 'Cobros y saldos'])
    await expect(page.getByRole('button', { name: /Requieren atención|Todo en orden/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva venta' })).toBeVisible()
  })

  test('ninguna lista ni ventana tiene desplazamiento horizontal', async ({ page }) => {
    for (const nombre of [/Por vender/, /Comprobantes/, /Órdenes de laboratorio/, /Cobros y saldos/]) {
      await page.getByRole('tab', { name: nombre }).click()
      await page.waitForTimeout(400)
      expect(await desplazamientoHorizontal(page), `pestaña ${nombre}`).toEqual([])
    }
    // Las ventanas de detalle
    await page.getByRole('tab', { name: /Por vender/ }).click()
    await page.getByRole('list', { name: 'Pacientes por vender' }).getByRole('button').first().click()
    expect(await desplazamientoHorizontal(page), 'detalle por vender').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /Comprobantes/ }).click()
    await page.getByRole('list', { name: 'Comprobantes de venta' }).getByRole('button', { name: /Ver el comprobante/ }).first().click()
    expect(await desplazamientoHorizontal(page), 'detalle del comprobante').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /Órdenes de laboratorio/ }).click()
    await page.getByRole('list', { name: 'Órdenes de laboratorio' }).getByRole('button', { name: /Ver la orden/ }).first().click()
    expect(await desplazamientoHorizontal(page), 'detalle de la orden').toEqual([])
    await page.keyboard.press('Escape')
    // Nueva venta y abono (se abren, no se guardan)
    await page.getByRole('button', { name: 'Nueva venta' }).click()
    await page.getByRole('button', { name: /Dividir el pago/ }).count()
    expect(await desplazamientoHorizontal(page), 'nueva venta').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /Comprobantes/ }).click()
    await page.getByRole('list', { name: 'Comprobantes de venta' }).getByRole('button', { name: 'Abonar' }).first().click()
    await page.getByRole('button', { name: /Dividir el pago/ }).click()
    expect(await desplazamientoHorizontal(page), 'abono dividido').toEqual([])
  })

  test('los números de las pestañas son los de sus listas', async ({ page }) => {
    // Los datos de Ventas cargan despues de pintar las pestañas: se lee el conteo solo cuando ya no hay esqueletos de carga y los numeros dejaron de cambiar.
    await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible()
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 20_000 })
    let previo = ''
    await expect.poll(async () => { const t = (await page.getByRole('tab').allTextContents()).join('|'); const igual = t === previo; previo = t; return igual }, { timeout: 20_000, intervals: [500] }).toBe(true)
    const cuenta = async (nombre) => Number((await page.getByRole('tab', { name: nombre }).textContent()).match(/(\d+)$/)[1])
    // Por vender
    const porVender = await cuenta(/Por vender/)
    await expect(page.getByRole('list', { name: 'Pacientes por vender' }).getByRole('listitem')).toHaveCount(porVender)
    // Comprobantes (todas las fechas, sin anuladas)
    const comprobantes = await cuenta(/Comprobantes/)
    await page.getByRole('tab', { name: /Comprobantes/ }).click()
    await expect(page.getByText(new RegExp(`^${comprobantes} comprobantes?$`))).toBeVisible()
    await expect(page.getByRole('list', { name: 'Comprobantes de venta' }).getByRole('listitem')).toHaveCount(Math.min(30, comprobantes))
    // Órdenes abiertas
    const ordenes = await cuenta(/Órdenes de laboratorio/)
    await page.getByRole('tab', { name: /Órdenes de laboratorio/ }).click()
    await expect(page.getByRole('list', { name: 'Órdenes de laboratorio' }).getByRole('listitem')).toHaveCount(ordenes)
    // Cobros y saldos: pacientes con saldo
    const conSaldo = await cuenta(/Cobros y saldos/)
    await page.getByRole('tab', { name: /Cobros y saldos/ }).click()
    await expect(page.getByRole('list', { name: 'Pacientes con saldo' }).locator(':scope > li')).toHaveCount(conSaldo)
  })

  test('en Cobros y saldos todos los botones Cobrar están en la misma columna', async ({ page }) => {
    await page.getByRole('tab', { name: /Cobros y saldos/ }).click()
    const izquierdas = await page.getByRole('button', { name: /^Cobrar CV-/ }).evaluateAll((bs) => bs.map((b) => Math.round(b.getBoundingClientRect().left)))
    expect(izquierdas.length).toBeGreaterThan(1)
    expect(new Set(izquierdas).size, 'posiciones: ' + izquierdas.join(',')).toBe(1)
  })

  test('el detalle del comprobante se puede reimprimir y muestra quién registró cada pago', async ({ page }) => {
    await page.getByRole('tab', { name: /Comprobantes/ }).click()
    await page.getByRole('list', { name: 'Comprobantes de venta' }).getByRole('button', { name: /Ver el comprobante/ }).first().click()
    const d = page.getByRole('dialog', { name: /^Comprobante CV-/ })
    await expect(d.getByRole('button', { name: /Imprimir comprobante/ })).toBeVisible()
    await expect(d.getByText('Registrada por')).toBeVisible()
    await expect(d.getByText('Detalle de la venta')).toBeVisible()
  })
})
