// Perfil del paciente reorganizado (reunión del 7 oct., puntos del ingeniero sobre Pacientes) en la óptica de pruebas (E2E):
// ESCRIBE datos (crea pacientes y citas "E Dos E ..."). Sin botón "Ficha clínica" en la cabecera, alertas arriba de las pestañas,
// Citas con la cita actual/próxima y "+N citas pendientes más", pestaña Resumen, y atender a quien llega sin cita desde "Agendar cita".
// Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/perfil-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearCitaDeHoyParaPaula, cancelarCitasDePrueba } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync('docs/perfil-capturas', { recursive: true })
  await page.waitForTimeout(700) // deja terminar las animaciones
  await page.screenshot({ path: `docs/perfil-capturas/${nombre}.png` })
}

// El de la cabecera del perfil (con texto); el de la fila de la lista, detrás, solo tiene ícono.
const botonAgendar = (page) => page.getByRole('button', { name: 'Agendar cita' }).filter({ hasText: 'Agendar cita' })

async function abrirPerfil(page, nombre, prefijo = 'OPTOMETRA') {
  await iniciarSesion(page, prefijo, 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Nombre, cédula, teléfono/).fill(nombre)
  await page.getByText(nombre).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 30_000 })
}

test('cabecera, alertas arriba de las pestañas, Citas y Resumen', async ({ page }) => {
  // Paciente con una cita de hoy y otro con una atención que quedó abierta desde ayer (genera una alerta).
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  const conAlerta = await crearCitaDeHoyParaPaula('E2E', { diasDespues: -1, estado: 'En Atención' })

  await abrirPerfil(page, nombre)
  const cabecera = page.getByRole('heading', { level: 1, name: nombre })
  await expect(cabecera).toBeVisible()
  // Sin "Ficha clínica" en la cabecera; "Crear acceso" porque todavía no tiene acceso
  await expect(page.getByRole('button', { name: 'Ficha clínica' })).toHaveCount(0)
  await expect(botonAgendar(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar mensaje' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Crear acceso' })).toBeVisible()
  // Pestañas en orden: Citas, Resumen, Productos y servicios...
  const pestanas = page.getByRole('tablist', { name: 'Secciones del paciente' }).getByRole('tab')
  await expect(pestanas.nth(0)).toContainText('Citas')
  await expect(pestanas.nth(1)).toContainText('Resumen')
  await expect(pestanas.nth(2)).toContainText('Productos y servicios')
  // Citas: la próxima con "Ingresar", y nada clínico mezclado
  await expect(page.getByRole('region', { name: 'Próxima cita' }).getByRole('button', { name: 'Ingresar' })).toBeVisible()
  await expect(page.getByText('Tendencia de graduación medida')).toHaveCount(0)
  await expect(page.getByText('Puntaje de fidelidad')).toHaveCount(0)
  await foto(page, 'reorganizado-1-citas')

  // Segunda cita desde el perfil → "+1 cita pendiente más", que despliega la otra
  await botonAgendar(page).click()
  const form = page.locator('form').filter({ has: page.getByLabel('Motivo del examen') })
  await form.locator('select').first().selectOption({ index: 1 })
  const dias = form.locator('button[title="Disponible"]')
  if (!(await dias.count())) await form.getByRole('button', { name: 'Mes siguiente' }).click()
  await dias.last().click()
  await form.locator('button:enabled').filter({ hasText: /^\d{2}:\d{2} (AM|PM)$/ }).first().click()
  await form.getByRole('button', { name: 'Confirmar cita' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByText(`Cita agendada para ${nombre}.`)).toBeVisible({ timeout: 15_000 })
  const masPendientes = page.getByRole('button', { name: /\+1 cita pendiente más/ })
  await expect(masPendientes).toBeVisible()
  await expect(masPendientes).toHaveAttribute('aria-expanded', 'false')
  await masPendientes.click()
  await expect(page.getByRole('region', { name: 'Otras citas pendientes' }).getByRole('button', { name: 'Ingresar' })).toBeVisible()
  await foto(page, 'reorganizado-2-mas-pendientes')

  // "Cuenta Portal" abre las opciones de la cuenta
  await page.getByRole('button', { name: /Cuenta Portal: Sin cuenta/ }).click()
  await expect(page.getByRole('heading', { name: /Crear cuenta de acceso/ })).toBeVisible()
  await foto(page, 'reorganizado-3-cuenta-portal')
  await page.getByRole('button', { name: 'Cerrar' }).last().click()

  // Resumen: información general, conteos, gráfico por mes
  await page.getByRole('tab', { name: /Resumen/ }).click()
  const conteos = page.getByRole('region', { name: 'Citas del paciente' })
  await expect(conteos.getByText('Pendientes')).toBeVisible()
  await expect(conteos.locator('dd').nth(0)).toHaveText('2') // pendientes
  await expect(conteos.locator('dd').nth(1)).toHaveText('0') // atendidas
  await expect(page.getByRole('img', { name: /^Citas por mes:/ })).toBeVisible()
  await expect(page.getByText('Última consulta')).toBeVisible()
  await expect(page.getByText('Puntaje de fidelidad')).toBeVisible()
  await foto(page, 'reorganizado-4-resumen')
  await page.getByRole('img', { name: /^Citas por mes:/ }).scrollIntoViewIfNeeded()
  await foto(page, 'reorganizado-4b-resumen-grafico')

  // Alertas: debajo de la cabecera y antes de las pestañas
  await page.goto('/?optica=v8twzq')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Nombre, cédula, teléfono/).fill(conAlerta)
  await page.getByText(conAlerta).first().click()
  const alertas = page.getByLabel('Alertas del paciente')
  await expect(alertas).toBeVisible({ timeout: 30_000 })
  const yAlertas = (await alertas.boundingBox()).y
  const yPestanas = (await page.getByRole('tablist', { name: 'Secciones del paciente' }).boundingBox()).y
  const yCabecera = (await page.getByRole('heading', { level: 1, name: conAlerta }).boundingBox()).y
  expect(yCabecera).toBeLessThan(yAlertas)
  expect(yAlertas).toBeLessThan(yPestanas)
  await foto(page, 'reorganizado-5-alertas-arriba')
})

test('atender a un paciente sin cita desde su perfil con "Llegó en un horario diferente"', async ({ page }) => {
  // Paciente sin ninguna cita pendiente: se crea con una cita y se cancela.
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await cancelarCitasDePrueba([nombre])

  await abrirPerfil(page, nombre)
  await expect(page.getByRole('button', { name: 'Ficha clínica' })).toHaveCount(0)
  await expect(page.getByText('Sin cita')).toBeVisible()
  await botonAgendar(page).click()
  const form = page.locator('form').filter({ has: page.getByLabel('Motivo del examen') })
  await form.locator('select').first().selectOption({ index: 1 })
  await form.getByLabel('Llegó en un horario diferente al de la grilla').check()
  await expect(form.getByText('Es de hoy: al confirmar pasa directo a la ficha clínica.')).toBeVisible()
  // Una hora que no se cruce con las citas de hoy de las demás pruebas (la hora real se escribe a mano).
  const minuto = String(Math.floor(Math.random() * 60)).padStart(2, '0')
  await form.getByLabel('Hora real').fill('06:' + minuto)
  await form.getByLabel('Duración estimada (min)').fill('5')
  await foto(page, 'reorganizado-6-atender-ahora')
  await form.getByRole('button', { name: 'Atender ahora' }).click()

  // Entra directo a la ficha clínica, con la cita recién creada
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await foto(page, 'reorganizado-7-ficha')
})

// Solo lectura, en la Demo: un paciente con historial muestra los conteos, el gráfico por mes y la tendencia de graduación.
test('Resumen de un paciente con historial (Demo, solo lectura)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Nombre, cédula, teléfono/).fill('Karla Párraga Vera')
  await page.getByText('Karla Párraga Vera').first().click()
  await expect(page.getByRole('tab', { name: /Resumen/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('tab', { name: /Resumen/ }).click()
  await expect(page.getByRole('region', { name: 'Citas del paciente' })).toBeVisible()
  await expect(page.getByText('Estado de corrección')).toBeVisible()
  await expect(page.getByText('Tendencia de graduación medida')).toBeVisible()
  await foto(page, 'reorganizado-8-resumen-demo')
  await page.getByRole('img', { name: /^Citas por mes:/ }).scrollIntoViewIfNeeded().catch(() => {})
  await foto(page, 'reorganizado-8b-resumen-demo-abajo')
})
