// En Semana y en Mes, el clic en una cita abre el MISMO detalle que en la Lista (tres columnas, estado y acciones), no una
// tarjeta flotante aparte. SOLO LECTURA en la Óptica Demo: se omite si el periodo visible no tiene citas.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

for (const vista of ['Semana', 'Mes']) {
  test(`${vista}: el clic en una cita abre el detalle de la cita`, async ({ page }) => {
    const errores = []
    page.on('pageerror', (e) => errores.push(e.message))
    await iniciarSesion(page, 'ADMIN')
    await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
    await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
    await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: vista }).click()
    await page.waitForTimeout(1000)
    const cita = page.locator('main button[title*=" · "]').first()
    test.skip((await cita.count()) === 0, `No hay citas en la ${vista.toLowerCase()} visible`)
    await cita.click()
    const detalle = page.getByRole('dialog')
    await expect(detalle.getByRole('region', { name: 'La cita', exact: true })).toBeVisible()
    await expect(detalle.getByRole('region', { name: 'Seguimiento', exact: true })).toBeVisible()
    await expect(detalle.getByRole('region', { name: 'Estado de la cita' })).toBeVisible()
    expect(errores, 'sin errores de JavaScript').toEqual([])
  })
}
