// Ventas, en la Óptica Demo (SOLO LECTURA: abre pantallas y ventanas, no guarda nada).
// Dos pestañas («Ventas» y «Pedidos»); a 1366×768 ninguna lista ni ventana tiene desplazamiento horizontal; los números de Pedidos son los de su lista;
// la lista de Ventas lleva su columna «Entrega»; el comprobante se puede reimprimir y muestra quién registró cada pago.
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

test.describe('Ventas (Demo, solo lectura)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'DEMO')
    await page.getByRole('button', { name: /^Ventas/ }).first().click()
    await expect(page.getByRole('tab', { name: /^Pedidos/ })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 20_000 })
  })

  test('dos pestañas con su número, sin tarjetas que hagan de pestañas, y la cabecera como la de Citas', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Ventas' })).toBeVisible()
    const nombres = await page.getByRole('tab').allTextContents()
    expect(nombres.map((t) => t.replace(/\d+$/, '').trim())).toEqual(['Ventas', 'Pedidos'])
    await expect(page.getByRole('button', { name: /Requieren atención|Todo en orden/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Nueva venta' })).toBeVisible()
  })

  test('la lista de Ventas lleva Fecha, Paciente, Detalle, Total, Pagado, Estado del pago y Entrega', async ({ page }) => {
    const encabezado = page.getByRole('tabpanel').locator('div[aria-hidden="true"]').first()
    for (const columna of ['Fecha', 'Paciente', 'Detalle', 'Total', 'Pagado', 'Estado del pago', 'Entrega']) await expect(encabezado).toContainText(columna)
  })

  test('ninguna lista ni ventana tiene desplazamiento horizontal', async ({ page }) => {
    for (const nombre of [/^Ventas/, /^Pedidos/]) {
      await page.getByRole('tab', { name: nombre }).click()
      await page.waitForTimeout(400)
      expect(await desplazamientoHorizontal(page), `pestaña ${nombre}`).toEqual([])
    }
    // Las ventanas de detalle: la venta y el pedido
    await page.getByRole('tab', { name: /^Ventas/ }).click()
    await page.getByRole('list', { name: 'Ventas' }).getByRole('button', { name: /^Ver la venta/ }).first().click()
    expect(await desplazamientoHorizontal(page), 'detalle de la venta').toEqual([])
    await page.keyboard.press('Escape')
    await page.getByRole('tab', { name: /^Pedidos/ }).click()
    await page.getByRole('group', { name: 'Estado de los pedidos' }).getByRole('button', { name: /^Todos/ }).click()
    await page.getByRole('list', { name: 'Pedidos' }).getByRole('button', { name: /^Ver el pedido/ }).first().click()
    expect(await desplazamientoHorizontal(page), 'detalle del pedido').toEqual([])
    await page.keyboard.press('Escape')
    // Nueva venta (se abre, no se guarda)
    await page.getByRole('button', { name: 'Nueva venta' }).click()
    await expect(page.getByRole('dialog').last()).toBeVisible()
    expect(await desplazamientoHorizontal(page), 'nueva venta').toEqual([])
    await page.keyboard.press('Escape')
  })

  test('los números de Pedidos son los de su lista: la pestaña, la píldora «En proceso» y las filas', async ({ page }) => {
    // Los datos de Ventas cargan después de pintar las pestañas: se lee el conteo cuando ya no hay esqueletos y los números dejaron de cambiar.
    await expect(page.locator('.animate-pulse')).toHaveCount(0, { timeout: 20_000 })
    let previo = ''
    await expect.poll(async () => { const t = (await page.getByRole('tab').allTextContents()).join('|'); const igual = t === previo; previo = t; return igual }, { timeout: 20_000, intervals: [500] }).toBe(true)
    const enPestana = Number((await page.getByRole('tab', { name: /^Pedidos/ }).textContent()).match(/(\d+)$/)[1])
    await page.getByRole('tab', { name: /^Pedidos/ }).click()
    const pildora = page.getByRole('group', { name: 'Estado de los pedidos' }).getByRole('button', { name: /^En proceso/ })
    expect(Number((await pildora.textContent()).match(/(\d+)\s*$/)[1]), 'la píldora «En proceso» cuenta lo mismo que la pestaña').toBe(enPestana)
    if (enPestana > 0) await expect(page.getByRole('list', { name: 'Pedidos' }).getByRole('listitem')).toHaveCount(enPestana)
    else await expect(page.getByText('No hay pedidos en proceso')).toBeVisible()
  })

  test('el detalle de la venta se puede reimprimir y muestra quién registró cada pago', async ({ page }) => {
    await page.getByRole('list', { name: 'Ventas' }).getByRole('button', { name: /^Ver la venta/ }).first().click()
    const d = page.getByRole('dialog', { name: /^Venta CV-/ })
    await expect(d.getByRole('button', { name: /Imprimir comprobante/ })).toBeVisible()
    await expect(d.getByText('Registrada por')).toBeVisible()
    await expect(d.getByText('Detalle de la venta')).toBeVisible()
  })
})
