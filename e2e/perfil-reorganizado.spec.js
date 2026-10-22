// Perfil del paciente (reunión del 20 oct., Ronda 3a) en la óptica de pruebas (E2E): ESCRIBE datos (crea pacientes y citas "E Dos E ...").
// Cabecera sin graduación, con los botones de dos en dos y «Atender» siempre disponible; el Resumen con los avisos arriba; la pestaña Citas con los conteos y la tendencia de línea;
// y atender a quien llega sin cita («Atender ahora»: crea la cita presencial y abre la ficha).
// Con E2E_CAPTURAS=1 guarda capturas a 1093 px en docs/ronda3a-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearCitaDeHoyParaPaula, cancelarCitasDePrueba } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 768 } })

const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync('docs/ronda3a-capturas', { recursive: true })
  await page.waitForTimeout(700) // deja terminar las animaciones
  await page.screenshot({ path: `docs/ronda3a-capturas/${nombre}.png` })
}

// El de la cabecera del perfil (con texto); el de la fila de la lista, detrás, solo tiene ícono.
const botonAgendar = (page) => page.getByRole('button', { name: 'Agendar cita' }).filter({ hasText: 'Agendar cita' }).first()

async function abrirPerfil(page, nombre, prefijo = 'OPTOMETRA') {
  await iniciarSesion(page, prefijo, 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  // La lista se vuelve a dibujar cuando llegan los datos y un clic dado justo en ese momento se pierde: si el perfil no abre, se vuelve a pulsar (pasa en cuanto abre, sin esperas fijas).
  await expect(async () => {
    await page.getByText(nombre).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
}

test('cabecera con los botones de dos en dos, Resumen con avisos arriba, Citas con conteos y tendencia', async ({ page }) => {
  test.setTimeout(240_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await abrirPerfil(page, nombre)
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible()

  // Cabecera: sin la graduación, sin «Ficha clínica»; botones de dos en dos (Historia clínica | Datos, Agendar cita | Enviar mensaje); el acceso al portal es una sola etiqueta
  await expect(page.getByRole('button', { name: 'Ficha clínica' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Graduación vigente del/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Crear acceso', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Cuenta Portal: Sin cuenta · Crear acceso/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar mensaje' }), 'el optómetra no tiene CRM: crear').toHaveCount(0)
  const historia = page.getByRole('button', { name: 'Historia clínica' })
  const datos = page.getByRole('button', { name: 'Datos', exact: true })
  await expect(historia).toBeVisible()
  const [bh, bd, ba] = [await historia.boundingBox(), await datos.boundingBox(), await botonAgendar(page).boundingBox()]
  expect(Math.abs(bh.y - bd.y), 'Historia clínica y Datos van en la misma fila').toBeLessThan(2)
  expect(bd.x).toBeGreaterThan(bh.x)
  expect(ba.y, 'Agendar cita va en la fila de abajo').toBeGreaterThan(bh.y + 20)
  // Atender, siempre disponible: con cita de hoy es «Atender»; no hay «Atender ahora» ni líneas de «Abierto hace…»
  await expect(page.getByRole('button', { name: 'Atender', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atender ahora' })).toHaveCount(0)
  await expect(page.getByText(/Abierta hace/)).toHaveCount(0)
  await foto(page, 'perfil-cabecera-con-cita-de-hoy')

  // Pestañas: Resumen, Citas, Diagnóstico y Compras (sin «Órdenes de laboratorio»)
  const pestanas = page.getByRole('tablist', { name: 'Secciones del paciente' }).getByRole('tab')
  await expect(pestanas).toHaveCount(4)
  await expect(pestanas.nth(0)).toContainText('Resumen')
  await expect(pestanas.nth(1)).toContainText('Citas')
  await expect(pestanas.nth(2)).toContainText('Diagnóstico')
  await expect(pestanas.nth(3)).toContainText('Compras')
  await expect(page.getByText('Órdenes de laboratorio')).toHaveCount(0)
  await expect(pestanas.nth(0)).toHaveAttribute('aria-selected', 'true')

  // Resumen: sin los conteos de citas ni la gráfica; sin «Estado de corrección» (no tiene refracción); «Compras» (no «Compras / lentes»); la fidelización al final, una sola vez
  await expect(page.getByRole('region', { name: 'Citas del paciente' })).toHaveCount(0)
  await expect(page.getByText('Estado de corrección')).toHaveCount(0)
  await expect(page.getByText('Compras / lentes')).toHaveCount(0)
  await expect(page.getByText('Última consulta')).toBeVisible()
  await expect(page.getByText('Puntaje de fidelidad'), 'la fidelidad aparece una sola vez, en Resumen').toHaveCount(1)
  await foto(page, 'perfil-resumen')

  // Citas: dos bloques lado a lado (conteos y tendencia) y debajo el historial con todas las citas
  await pestanas.nth(1).click()
  const conteos = page.getByRole('region', { name: 'Citas del paciente' })
  const tendencia = page.getByRole('region', { name: 'Tendencia de las citas' })
  await expect(conteos).toBeVisible()
  await expect(tendencia).toBeVisible()
  const [bc, bt] = [await conteos.boundingBox(), await tendencia.boundingBox()]
  expect(Math.abs(bc.y - bt.y), 'los conteos y la tendencia van lado a lado').toBeLessThan(4)
  expect(bt.x).toBeGreaterThan(bc.x)
  await expect(conteos.locator('dd').nth(0)).toHaveText('1') // pendientes
  for (const t of ['Pendientes', 'Atendidas', 'No efectuadas', 'Canceladas']) await expect(conteos.getByText(t, { exact: true })).toBeVisible()
  // la gráfica es de línea, con selector de semana, mes y año (por defecto, mes)
  await expect(tendencia.getByRole('button', { name: 'Mes' })).toHaveAttribute('aria-pressed', 'true')
  await expect(tendencia.getByRole('img', { name: /^Citas por mes:/ })).toBeVisible()
  await expect(tendencia.locator('svg path[stroke]').first()).toBeVisible() // la línea de la evolución
  await tendencia.getByRole('button', { name: 'Semana' }).click()
  await expect(tendencia.getByRole('img', { name: /^Citas por semana:/ })).toBeVisible()
  await tendencia.getByRole('button', { name: 'Año' }).click()
  await expect(tendencia.getByRole('img', { name: /^Citas por año:/ })).toBeVisible()
  await tendencia.getByRole('button', { name: 'Mes' }).click()
  // el historial trae la cita pendiente y abre su detalle completo (con el seguimiento)
  const historial = page.getByRole('region', { name: 'Historial de citas' })
  await expect(historial).toContainText('Pendiente')
  await historial.getByRole('button', { name: /Ver el detalle de la cita/ }).first().click()
  await expect(page.getByRole('dialog').getByText('Seguimiento')).toBeVisible()
  await expect(page.getByRole('dialog')).toContainText('Agendada')
  await page.keyboard.press('Escape')
  await foto(page, 'perfil-citas')

  // Segunda cita desde el perfil: guarda, avisa y se cuenta
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
  await expect(page.getByRole('region', { name: 'Citas del paciente' }).locator('dd').nth(0)).toHaveText('2')

  // «Cuenta Portal: Sin cuenta · Crear acceso» abre la creación de la cuenta
  await page.getByRole('button', { name: /Crear acceso/ }).click()
  await expect(page.getByRole('heading', { name: /Crear cuenta de acceso/ })).toBeVisible()
  await page.getByRole('button', { name: 'Cerrar' }).last().click()
  await cancelarCitasDePrueba([nombre])
})

test('atención abierta: «Seguir atendiendo» y «Dejar de atender» en la cabecera, sin la línea de «Abierto hace…»; el aviso va en el Resumen', async ({ page }) => {
  test.setTimeout(240_000)
  const abierta = await crearCitaDeHoyParaPaula('E2E', { diasDespues: -1, estado: 'En Atención' })
  await abrirPerfil(page, abierta)
  await expect(page.getByRole('button', { name: 'Seguir atendiendo' }).first()).toBeVisible()
  const dejar = page.getByRole('button', { name: 'Dejar de atender' })
  await expect(dejar).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ingresar' })).toHaveCount(0)
  // la cabecera no lleva la línea «Abierta hace N días»; el aviso de la cita en atención está en el Resumen
  const cabecera = page.getByRole('heading', { level: 1, name: abierta }).locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]')
  await expect(cabecera.getByText(/Abierta hace/)).toHaveCount(0)
  const avisos = page.getByRole('region', { name: 'Avisos del paciente' })
  await expect(avisos).toContainText('Cita en atención')
  await expect(avisos).toContainText('Abierta hace 1 día')
  await foto(page, 'perfil-cabecera-atencion-abierta')
  // día pasado: la ventana explica que queda «No efectuada» y pasa a «Contactar al paciente»
  await dejar.click()
  const ventana = page.getByRole('dialog', { name: /Dejar de atender/ })
  await expect(ventana).toContainText('«No efectuada»')
  await expect(ventana).toContainText('La atención se interrumpió')
  await expect(ventana).toContainText('Contactar al paciente')
  await expect(ventana).toContainText('borrador de la ficha')
  await ventana.getByRole('button', { name: 'Sí, dejar de atender' }).click()
  await expect(page.getByText(/Su cita quedó «No efectuada» y pasó a «Contactar al paciente»/)).toBeVisible({ timeout: 15_000 })
  // la cita quedó «No efectuada» con su motivo en el seguimiento, y la cabecera ya ofrece «Atender ahora»
  await page.getByRole('tab', { name: /Citas/ }).click()
  const historial = page.getByRole('region', { name: 'Historial de citas' })
  await expect(historial).toContainText('No efectuada')
  await historial.getByRole('button', { name: /Ver el detalle de la cita/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('La atención se interrumpió')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Atender ahora' }).first()).toBeVisible()
  // (la cita quedó «No efectuada»: ya no se puede cancelar; la limpieza de la óptica de pruebas la borra)
})

test('«Atender ahora» desde la cabecera: crea la cita presencial para este momento, la deja en Citas y abre la ficha', async ({ page }) => {
  test.setTimeout(240_000)
  // Paciente sin ninguna cita pendiente: se crea con una cita y se cancela.
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await cancelarCitasDePrueba([nombre])
  await abrirPerfil(page, nombre, 'ADMIN')
  await expect(page.getByRole('button', { name: 'Atender', exact: true })).toHaveCount(0)
  await foto(page, 'perfil-cabecera-sin-cita-de-hoy')
  await page.getByRole('button', { name: 'Atender ahora' }).first().click()
  // entra directo a la ficha clínica, con la cita recién creada
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('Paso 1 de 5')).toBeVisible()
  await expect(page.getByText(/Cita presencial creada para/)).toBeVisible()
  // sin historial previo la ficha avisa que es su primera consulta
  await page.getByRole('button', { name: 'Entendido, completar antecedentes' }).click()
  // la cita está en Citas (Lista) con su origen «Presencial» en el seguimiento
  await page.getByRole('button', { name: 'Dejar de atender' }).click()
  await page.getByRole('dialog', { name: /Dejar de atender/ }).getByRole('button', { name: 'Sí, dejar de atender' }).click()
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  await page.getByTitle('Ver el detalle de la cita').first().click()
  const detalle = page.getByRole('dialog')
  await expect(detalle).toContainText('Presencial')
  await expect(detalle).toContainText('Volvió a la sala de espera')
  await page.keyboard.press('Escape')
  await cancelarCitasDePrueba([nombre])
})

// Solo lectura, en la Demo: un paciente con historial muestra su Resumen, sus conteos en Citas y su Diagnóstico.
test('Resumen, Citas y Diagnóstico de un paciente con historial (Demo, solo lectura)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill('Paciente Demostración Portal')
  await expect(async () => {
    await page.getByText('Paciente Demostración Portal').first().click()
    await expect(page.getByRole('tab', { name: /Resumen/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })
  await page.getByRole('tab', { name: /Resumen/ }).click()
  await expect(page.getByText('Última consulta')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Citas del paciente' })).toHaveCount(0)
  await page.getByRole('tab', { name: /Citas/ }).click()
  await expect(page.getByRole('region', { name: 'Citas del paciente' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Tendencia de las citas' })).toBeVisible()
  await page.getByRole('tab', { name: /Diagnóstico/ }).click()
  await expect(page.getByRole('heading', { name: 'Diagnóstico', exact: true, level: 1 })).toBeVisible()
})

// El menú ⋮ de la lista de Pacientes: «Atender ahora» crea la cita y abre la ficha (un paso, no un formulario).
test('«Atender ahora» del menú de la lista entra a la ficha', async ({ page }) => {
  test.setTimeout(240_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await cancelarCitasDePrueba([nombre])
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Nueva ficha clínica' })).toHaveCount(0)
  await page.locator('tr', { hasText: nombre }).getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Atender ahora' }).click()
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('Paso 1 de 5')).toBeVisible()
  await cancelarCitasDePrueba([nombre])
})
