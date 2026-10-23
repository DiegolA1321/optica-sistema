// Perfil del paciente, pestaña Citas: el diagnóstico se abre en una ventana (no empuja la lista) y el historial
// se puede acotar por fechas y texto. Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/perfil-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearPacienteConHistorial, crearCitaDeHoyParaPaula } from './ayudas.js'

const CARPETA = 'docs/perfil-capturas'
const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync(CARPETA, { recursive: true })
  await page.waitForTimeout(700) // deja terminar las animaciones
  await page.screenshot({ path: `${CARPETA}/${nombre}.png` })
}

// La lista se vuelve a dibujar cuando llegan los datos y un clic dado justo en ese momento se pierde: si el perfil no abre, se vuelve a pulsar (pasa en cuanto abre, sin esperas fijas).
async function abrirDesdeLaLista(page, nombre) {
  await expect(async () => {
    await page.getByText(nombre, { exact: false }).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
  // el perfil abre en el Resumen: estas pruebas son de la pestaña Citas
  await page.getByRole('tab', { name: /^Citas/ }).click()
}

async function abrirPerfil(page, nombre) {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  // La lista se vuelve a dibujar cuando llegan los datos y un clic dado justo en ese momento se pierde: si el perfil no abre, se vuelve a pulsar (pasa en cuanto abre, sin esperas fijas).
  await expect(async () => {
    await page.getByText(nombre, { exact: false }).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
  // el perfil abre en el Resumen: estas pruebas son de la pestaña Citas
  await page.getByRole('tab', { name: /^Citas/ }).click()
}

test.describe('Perfil del paciente: pestaña Citas', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('la atención se abre en una ventana y el historial lleva sus filtros', async ({ page }) => {
    await abrirPerfil(page, 'Karla Párraga Vera')
    await foto(page, 'perfil-1')
    // Con pocas citas el historial lleva sus filtros de siempre («Último año» y «Todas»); el buscador por texto y fechas aparece cuando el historial es largo
    const historial = page.getByRole('region', { name: 'Historial de citas' })
    await expect(historial.getByRole('button', { name: 'Último año' })).toBeVisible()
    await expect(historial.getByRole('button', { name: 'Todas' })).toBeVisible()

    // Ver atención: ventana encima, la lista no cambia de alto
    await page.getByRole('listitem').filter({ hasText: 'Atendida' }).getByRole('button', { name: /Ver el detalle de la cita del/ }).first().click()
    const ventana = page.getByRole('dialog', { name: /^Atención del/ })
    await expect(ventana).toBeVisible()
    await foto(page, 'perfil-2-ventana')
    await page.keyboard.press('Escape')
    await expect(ventana).toHaveCount(0)
  })

  // Escribe datos: corre en la óptica de pruebas con un paciente de 9 citas atendidas.
  test('el historial largo trae buscador, con el calendario de fechas de Citas', async ({ page }) => {
    const nombre = await crearPacienteConHistorial(9) // el buscador del historial aparece con más de 8 citas
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
    await abrirDesdeLaLista(page, nombre)
    const buscador = page.getByRole('search', { name: 'Buscar en el historial de citas' })
    await expect(buscador).toBeVisible()
    // Búsqueda por texto
    await buscador.getByPlaceholder('Motivo o diagnóstico').fill('zzzz-no-existe')
    await expect(page.getByText('Ninguna cita coincide con ese filtro.')).toBeVisible()
    await buscador.getByRole('button', { name: 'Limpiar' }).click()
    await expect(page.getByText('Ninguna cita coincide con ese filtro.')).toHaveCount(0)
    // Atajo "Último año" (en la cabecera del historial): queda marcado y «Todas» lo quita
    await page.getByRole('region', { name: 'Historial de citas' }).getByRole('button', { name: 'Último año' }).click()
    const historial = page.getByRole('region', { name: 'Historial de citas' })
    await expect(historial.getByRole('button', { name: 'Último año' })).toHaveAttribute('aria-pressed', 'true')
    await historial.getByRole('button', { name: 'Todas' }).click()
    await expect(historial.getByRole('button', { name: 'Todas' })).toHaveAttribute('aria-pressed', 'true')
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
    await abrirDesdeLaLista(page, nombre)
    const aviso = page.getByRole('region', { name: 'Sin citas' })
    await expect(aviso.getByText('Este paciente no tiene citas')).toBeVisible()
    await expect(aviso.getByRole('button', { name: 'Agendar cita' })).toBeVisible()
  })
})

// Atender desde el perfil: con una cita pendiente la cabecera ofrece «Ingresar» y abre la ficha clínica de esa cita; sin cita no hay botón nuevo («Agendar cita» sigue en su lugar).
test.describe('Perfil del paciente: atender desde la cabecera', () => {
  test.use({ viewport: { width: 1366, height: 768 } })

  test('con una cita de hoy, «Ingresar» abre la ficha clínica; sin cita no aparece', async ({ page }) => {
    test.setTimeout(150_000)
    const nombre = await crearCitaDeHoyParaPaula('E2E')
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
    await abrirDesdeLaLista(page, nombre)
    const ingresar = page.getByRole('button', { name: 'Atender', exact: true }).first() // el de la cabecera (la pestaña Citas lleva el suyo)
    await expect(ingresar).toBeVisible()
    await expect(page.getByRole('button', { name: 'Atender ahora' })).toHaveCount(0) // con cita de hoy se atiende esa, no se crea otra
    // el botón está en la cabecera, en la misma fila que las pestañas y a su derecha
    const caja = await ingresar.boundingBox()
    const pestanas = await page.getByRole('tablist', { name: 'Secciones del paciente' }).boundingBox()
    expect(Math.abs((caja.y + caja.height / 2) - (pestanas.y + pestanas.height / 2)), 'Atender en la fila de las pestañas').toBeLessThan(30)
    expect(caja.x, 'Atender a la derecha de las pestañas').toBeGreaterThan(pestanas.x + pestanas.width - 2)
    await ingresar.click()
    await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(nombre).first()).toBeVisible()
  })

  test('un paciente sin cita de hoy también tiene «Atender» (crea la cita presencial) y «Agendar cita» sigue en su lugar', async ({ page }) => {
    test.setTimeout(120_000)
    const nombre = await crearPacienteConHistorial(1)
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
    await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
    await abrirDesdeLaLista(page, nombre)
    await expect(page.getByRole('button', { name: 'Atender', exact: true }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Atender ahora' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Agendar cita' }).first()).toBeVisible()
  })
})
