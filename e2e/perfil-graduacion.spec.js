// La graduación del paciente en el perfil del personal (Resumen), la misma vista que ve el paciente en su portal, en su versión técnica. Demo, solo lectura.
// Solo la ven los roles con permiso de Ficha clínica «ver»: Administrador, Optómetra, Recepción y Ventas lo tienen en sus roles predefinidos.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

const PACIENTE = 'Paciente Demostración Portal'
test.use({ viewport: { width: 1366, height: 768 } })

for (const rol of ['ADMIN', 'OPTOMETRA', 'RECEPCION', 'VENTAS']) {
  test(`${rol}: el perfil trae la graduación vigente técnica, el antes → ahora, la lista de recetas y «Explicar al paciente»`, async ({ page }) => {
    await iniciarSesion(page, rol)
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(PACIENTE)
    await page.getByRole('row').filter({ hasText: PACIENTE }).getByRole('button', { name: /Ver perfil 360/ }).click()
    await page.getByRole('tab', { name: /Resumen/ }).click()
    const seccion = page.getByRole('region', { name: 'Graduación del paciente' })
    await expect(seccion).toBeVisible({ timeout: 20_000 })
    await expect(seccion.getByRole('region', { name: 'Ojo derecho' })).toContainText('OD · Ojo derecho')
    await expect(seccion.getByRole('region', { name: 'Ojo derecho' })).toContainText('Cilindro')
    await expect(seccion.getByRole('region', { name: 'Cambio desde la consulta anterior' })).toBeVisible()
    await expect(seccion.getByRole('region', { name: 'Recetas del paciente' })).toContainText('3 recetas')
    // «Explicar al paciente»: la versión con palabras simples
    await seccion.getByRole('button', { name: 'Explicar al paciente' }).click()
    const ventana = page.getByRole('dialog', { name: 'Explicar al paciente' })
    await expect(ventana).toContainText('Tienes miopía leve')
    await page.keyboard.press('Escape')
    // Comparar dos recetas
    await seccion.getByRole('button', { name: 'Comparar dos recetas' }).click()
    await expect(page.getByRole('dialog', { name: 'Comparar dos recetas' })).toContainText(/Cambiaron|Las dos recetas/)
    // sin desplazamiento horizontal
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })
}
