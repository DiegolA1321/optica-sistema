// Perfil del paciente, pestaña Citas: el diagnóstico se abre en una ventana (no empuja la lista) y el historial
// se puede acotar por fechas y texto. Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/perfil-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearPacienteConHistorial } from './ayudas.js'

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
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await page.getByText(nombre, { exact: false }).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 20_000 })
}

test.describe('Perfil del paciente: pestaña Citas', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('la atención se abre en una ventana y el historial lleva siempre su buscador', async ({ page }) => {
    await abrirPerfil(page, 'Karla Párraga Vera')
    await foto(page, 'perfil-1')
    // Aunque tenga pocas citas, el historial lleva siempre su buscador y sus filtros
    await expect(page.getByRole('search', { name: 'Buscar en el historial de citas' })).toBeVisible()

    // Ver atención: ventana encima, la lista no cambia de alto
    await page.getByRole('button', { name: /Ver la atención del/ }).first().click()
    const ventana = page.getByRole('dialog', { name: /^Atención del/ })
    await expect(ventana).toBeVisible()
    await foto(page, 'perfil-2-ventana')
    await page.keyboard.press('Escape')
    await expect(ventana).toHaveCount(0)
  })

  // Escribe datos: corre en la óptica de pruebas con un paciente de 6 citas atendidas.
  test('el historial largo trae buscador, con el calendario de fechas de Citas', async ({ page }) => {
    const nombre = await crearPacienteConHistorial(6)
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
    await page.getByText(nombre).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 30_000 })
    const buscador = page.getByRole('search', { name: 'Buscar en el historial de citas' })
    await expect(buscador).toBeVisible()
    // Búsqueda por texto
    await buscador.getByPlaceholder('Motivo o diagnóstico').fill('zzzz-no-existe')
    await expect(page.getByText('Ninguna cita coincide con esa búsqueda.')).toBeVisible()
    await buscador.getByRole('button', { name: 'Limpiar' }).click()
    await expect(page.getByText('Ninguna cita coincide con esa búsqueda.')).toHaveCount(0)
    // Atajo "Último año": queda el rango y se ve en el botón de fechas
    await buscador.getByRole('button', { name: 'Último año' }).click()
    await expect(buscador.getByRole('button', { name: /–/ })).toBeVisible()
    await buscador.getByRole('button', { name: 'Limpiar' }).click()
    // El calendario de fechas se abre desde "Elegir rango de fechas…"
    await buscador.getByRole('button', { name: /Elegir rango de fechas/ }).click()
    await expect(buscador.getByRole('button', { name: 'Mes siguiente' })).toBeVisible()
  })

  // Con historial y sin cita pendiente no sobra ningún bloque vacío; agendar sigue a un clic, en la cabecera del perfil.
  test('con historial y sin cita pendiente no hay bloques vacíos y "Agendar cita" sigue a un clic', async ({ page }) => {
    await abrirPerfil(page, 'Karla Párraga Vera')
    await expect(page.getByRole('region', { name: 'Próxima cita' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Sin citas pendientes' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Sin citas' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Agendar cita' }).first()).toBeVisible()
  })

  // Un paciente que no tiene ninguna cita (ni pasada ni pendiente): un mensaje con la acción de agendar. Escribe datos: corre en la óptica de pruebas.
  test('un paciente sin ninguna cita tiene un mensaje con la acción de agendar', async ({ page }) => {
    const nombre = await crearPacienteConHistorial(0)
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
    await page.getByText(nombre).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 30_000 })
    const aviso = page.getByRole('region', { name: 'Sin citas' })
    await expect(aviso.getByText('Este paciente no tiene citas')).toBeVisible()
    await expect(aviso.getByRole('button', { name: 'Agendar cita' })).toBeVisible()
  })
})
