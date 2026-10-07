// Perfil del paciente, pestaña Citas: el diagnóstico se abre en una ventana (no empuja la lista) y el historial
// se puede acotar por fechas y texto. Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/perfil-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion } from './ayudas.js'

const CARPETA = 'docs/perfil-capturas'
const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync(CARPETA, { recursive: true })
  await page.waitForTimeout(700) // deja terminar las animaciones
  await page.screenshot({ path: `${CARPETA}/${nombre}.png` })
}

async function abrirPerfil(page, nombre) {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Nombre, cédula, teléfono/).fill(nombre)
  await page.getByText(nombre, { exact: false }).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 20_000 })
}

test.describe('Perfil del paciente: pestaña Citas', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('el diagnóstico se abre en una ventana y el historial se filtra por fechas', async ({ page }) => {
    await abrirPerfil(page, 'Karla Párraga Vera')
    await foto(page, 'perfil-1')
    const buscador = page.getByRole('search', { name: 'Buscar en el historial de citas' })
    await expect(buscador).toBeVisible()

    // Ver diagnóstico: ventana encima, la lista no cambia de alto
    await page.getByRole('button', { name: /Ver el diagnóstico de la cita/ }).first().click()
    const ventana = page.getByRole('dialog', { name: 'Diagnóstico de la cita' })
    await expect(ventana).toBeVisible()
    await foto(page, 'perfil-2-ventana')
    await page.keyboard.press('Escape')
    await expect(ventana).toHaveCount(0)

    // Filtro por fechas: un rango en el futuro no deja ninguna cita; limpiar las devuelve
    await buscador.getByLabel('Desde').fill('2030-01-01')
    await expect(page.getByText('Ninguna cita coincide con esa búsqueda.')).toBeVisible()
    await buscador.getByRole('button', { name: 'Limpiar' }).click()
    await expect(page.getByText('Ninguna cita coincide con esa búsqueda.')).toHaveCount(0)

    // Atajo "Último año" y búsqueda por texto
    await buscador.getByRole('button', { name: 'Último año' }).click()
    await expect(buscador.getByLabel('Hasta')).not.toHaveValue('')
    await buscador.getByRole('button', { name: 'Limpiar' }).click()
    await buscador.getByPlaceholder('Motivo o diagnóstico').fill('zzzz-no-existe')
    await expect(page.getByText('Ninguna cita coincide con esa búsqueda.')).toBeVisible()
  })

  test('sin cita pendiente solo hay una etiqueta pequeña, sin el recuadro grande', async ({ page }) => {
    await abrirPerfil(page, 'Karla Párraga Vera')
    await expect(page.getByText('Este paciente no tiene citas pendientes.')).toHaveCount(0)
  })
})
