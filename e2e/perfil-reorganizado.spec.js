// Perfil del paciente (reunión del 20 oct., Ronda 3a) en la óptica de pruebas (E2E): ESCRIBE datos (crea pacientes y citas "E Dos E ...").
// Cabecera única (los cuatro botones en una fila, las pestañas con línea azul y «Atender» al final de su fila); el Resumen con los avisos arriba y la franja de datos; la pestaña Citas con la franja de conteos y las gráficas de visitas;
// y atender a quien llega sin cita («Atender»: crea la cita presencial y abre la ficha).
// Con E2E_CAPTURAS=1 guarda capturas a 1093 px en docs/ronda3a-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearCitaDeHoyParaPaula, cancelarCitasDePrueba, liberarHoyDePaula } from './ayudas.js'

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

test('cabecera con los botones en una fila, Resumen con avisos arriba, Citas con la franja de conteos y las gráficas de visitas', async ({ page }) => {
  test.setTimeout(240_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await abrirPerfil(page, nombre)
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible()

  // Cabecera: sin la graduación, sin «Ficha clínica»; los cuatro botones en una sola fila junto al nombre; sin las etiquetas «Activo» ni «Portal activo»
  await expect(page.getByRole('button', { name: 'Ficha clínica' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Graduación vigente del/ })).toHaveCount(0)
  await expect(page.getByText('Cuenta Portal')).toHaveCount(0)
  await expect(page.getByText('Portal activo')).toHaveCount(0)
  await expect(page.getByLabel('Perfil del paciente').getByText('Activo', { exact: true })).toHaveCount(0) // (la lista de Pacientes, detrás, sí lo lleva en cada fila)
  await expect(page.getByRole('button', { name: 'Crear acceso al portal' }), 'sin cuenta: el acceso se crea desde la línea de datos').toBeVisible()
  await expect(page.getByRole('button', { name: 'Enviar mensaje' }), 'el optómetra no tiene CRM: crear').toHaveCount(0)
  const historia = page.getByRole('button', { name: 'Historia clínica' })
  const datos = page.getByRole('button', { name: 'Datos', exact: true })
  await expect(historia).toBeVisible()
  const [bh, bd, ba] = [await historia.boundingBox(), await datos.boundingBox(), await botonAgendar(page).boundingBox()]
  expect(Math.abs(bh.y - bd.y), 'Historia clínica y Datos van en la misma fila').toBeLessThan(2)
  expect(Math.abs(bh.y - ba.y), 'Agendar cita va en la misma fila').toBeLessThan(2)
  expect(bd.x).toBeGreaterThan(bh.x)
  // Atender, siempre disponible: con cita de hoy es «Atender»; no hay «Atender ahora» ni líneas de «Abierto hace…»
  await expect(page.getByRole('button', { name: 'Atender', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Atender ahora' })).toHaveCount(0)
  await expect(page.getByText(/Abierta hace/)).toHaveCount(0)
  await foto(page, 'perfil-cabecera-con-cita-de-hoy')

  // Pestañas: Resumen, Citas, Diagnóstico y Compras (los pedidos no son una pestaña: su estado va dentro de cada compra)
  const pestanas = page.getByRole('tablist', { name: 'Secciones del paciente' }).getByRole('tab')
  await expect(pestanas).toHaveCount(4)
  await expect(pestanas.nth(0)).toContainText('Resumen')
  await expect(pestanas.nth(1)).toContainText('Citas')
  await expect(pestanas.nth(2)).toContainText('Diagnóstico')
  await expect(pestanas.nth(3)).toContainText('Compras')
  await expect(page.getByText(/Órdenes de laboratorio|Pedidos de lentes/)).toHaveCount(0)
  await expect(pestanas.nth(0)).toHaveAttribute('aria-selected', 'true')
  const atender = await page.getByRole('button', { name: 'Atender', exact: true }).first().boundingBox()
  expect(Math.abs(atender.y - (await pestanas.nth(0).boundingBox()).y), 'Atender va en la misma fila que las pestañas').toBeLessThan(30)

  // Resumen: los avisos, la franja de datos (paciente desde, total comprado, saldo y cómo llegó), la última atención, la actividad reciente y la fidelización compacta
  await expect(page.getByRole('region', { name: 'Asistencia a sus citas' })).toHaveCount(0) // los conteos de las citas son de la pestaña Citas
  await expect(page.getByText('Estado de corrección')).toHaveCount(0)
  await expect(page.getByText('Compras / lentes')).toHaveCount(0)
  const franja = page.getByRole('region', { name: 'Datos del paciente' })
  for (const t of ['Paciente desde', 'Total comprado', 'Cómo llegó']) await expect(franja).toContainText(t)
  await expect(franja, 'cómo llegó nunca queda vacío').toContainText(/Por su cuenta|Por la web|Referido por/)
  await expect(page.getByRole('region', { name: 'Última atención' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Actividad reciente' })).toBeVisible()
  const fidelizacion = page.getByRole('region', { name: 'Fidelización' })
  await expect(fidelizacion, 'la fidelización aparece una sola vez, en Resumen').toHaveCount(1)
  await expect(fidelizacion).toContainText('Nivel y puntos')
  await expect(fidelizacion).toContainText('Referidos')
  await expect(fidelizacion).toContainText(/Cumplirá \d+( años?)? · en \d+ días?|Cumple \d+ años? · hoy|Sin fecha de nacimiento/)
  await foto(page, 'perfil-resumen')

  // Citas: dos tarjetas arriba («Asistencia a sus citas» con sus conteos y «Su ciclo de control») y debajo el historial
  await pestanas.nth(1).click()
  const asistencia = page.getByRole('region', { name: 'Asistencia a sus citas' })
  const ciclo = page.getByRole('region', { name: 'Su ciclo de control' })
  await expect(asistencia).toBeVisible()
  await expect(ciclo).toBeVisible()
  expect(Math.abs((await asistencia.boundingBox()).y - (await ciclo.boundingBox()).y), 'las dos tarjetas van lado a lado').toBeLessThan(4)
  await expect(asistencia.getByRole('button', { name: /^1 pendiente/ })).toBeVisible()
  for (const t of [/^0 atendidas/, /^0 no efectuadas/, /^0 canceladas/]) await expect(asistencia.getByRole('button', { name: t })).toBeVisible()
  await expect(ciclo).toContainText(/para su próximo control|Agendar control|Control/)
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
  await form.locator('button:enabled').filter({ hasText: /^\d{1,2}:\d{2} (AM|PM)$/ }).first().click()
  await form.getByRole('button', { name: 'Confirmar cita' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByText(`Cita agendada para ${nombre}.`)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Asistencia a sus citas' }).getByRole('button', { name: /^2 pendientes/ })).toBeVisible()

  // «Crear acceso al portal» (en la línea de datos) abre la creación de la cuenta
  await page.getByRole('button', { name: 'Crear acceso al portal' }).click()
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
  const cabecera = page.getByRole('banner', { name: 'Perfil del paciente' })
  await expect(cabecera.getByText(/Abierta hace/)).toHaveCount(0)
  const avisos = page.getByRole('list', { name: 'Avisos del paciente' })
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
  // la cita quedó «No efectuada» con su motivo en el seguimiento, y la cabecera vuelve a ofrecer «Atender» (sin cita de hoy, crea una cita presencial)
  await page.getByRole('tab', { name: /Citas/ }).click()
  const historial = page.getByRole('region', { name: 'Historial de citas' })
  await expect(historial).toContainText('No efectuada')
  await historial.getByRole('button', { name: /Ver el detalle de la cita/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('La atención se interrumpió')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Atender', exact: true }).first()).toBeVisible()
  // (la cita quedó «No efectuada»: ya no se puede cancelar; la limpieza de la óptica de pruebas la borra)
})

test('«Atender» sin cita de hoy, desde la cabecera: crea la cita presencial para este momento, la deja en Citas y abre la ficha', async ({ page }) => {
  test.setTimeout(240_000)
  // Paciente sin ninguna cita pendiente: se crea con una cita y se cancela.
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await cancelarCitasDePrueba([nombre])
  await liberarHoyDePaula() // sin otras citas de las pruebas anteriores: «Atender» crea la cita para este momento si la hora está libre
  await abrirPerfil(page, nombre, 'ADMIN')
  await foto(page, 'perfil-cabecera-sin-cita-de-hoy')
  await page.getByRole('button', { name: 'Atender', exact: true }).first().click()
  // entra directo a la ficha clínica, con la cita recién creada
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
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
  await expect(page.getByRole('region', { name: 'Fidelización' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Asistencia a sus citas' })).toHaveCount(0)
  await page.getByRole('tab', { name: /Citas/ }).click()
  await expect(page.getByRole('region', { name: 'Asistencia a sus citas' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Su ciclo de control' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Historial de citas' })).toBeVisible()
  await page.getByRole('tab', { name: /Diagnóstico/ }).click()
  await expect(page.getByRole('heading', { name: 'Diagnóstico', exact: true, level: 1 })).toBeVisible()
})

// El menú ⋮ de la lista de Pacientes: «Atender» crea la cita y abre la ficha (un paso, no un formulario).
test('«Atender» del menú de la lista entra a la ficha (sin cita de hoy crea la presencial)', async ({ page }) => {
  test.setTimeout(240_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  await cancelarCitasDePrueba([nombre])
  await liberarHoyDePaula() // sin otras citas de las pruebas anteriores: «Atender» crea la cita para este momento si la hora está libre
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Nueva ficha clínica' })).toHaveCount(0)
  await page.locator('tr', { hasText: nombre }).getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('Paso 1 de 3')).toBeVisible()
  await cancelarCitasDePrueba([nombre])
})
