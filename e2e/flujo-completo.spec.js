// Recorrido completo de la óptica, de punta a punta, en la Óptica Demo (solo ella). Crea sus propios datos con el
// prefijo "E2E " (los nombres de paciente, "E Dos E ") y no depende de la hora del día ni de citas sembradas: la cita se
// agenda en el primer día con cupo y Paula la atiende hoy.
import { test, expect } from '@playwright/test'
import { llenarFichaObligatoria, iniciarSesion, PREFIJO, nombrePrueba, cedulaValida, telefonoPrueba, agendarCitaParaPaula, crearCitaDeHoyParaPaula, elegirFecha } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'serial' })

// Fecha ISO dentro de n días (local), para la fecha aproximada en que estará listo el pedido.
function fechaEn(dias) {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const datos = { nombre: nombrePrueba(), cedula: cedulaValida(), telefono: telefonoPrueba() }

// Lee del Reportes del administrador (este mes) lo que el recorrido debe mover. Se compara antes y después, así que
// no depende de los datos que ya haya en la Óptica Demo.
async function leerReportes(page) {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Reportes', exact: true }).first().click()
  const cuerpo = page.locator('main')
  // Las tarjetas del Resumen dicen su número en su nombre accesible ("Vendido: $1,234.50. Ver la lista"); la cantidad de ventas
  // está en el título de la lista que abre ("Vendido: 3 ventas").
  const leer = async () => {
    const num = (t) => Number(t.replace(/[^\d.]/g, ''))
    const consultas = num((await cuerpo.getByRole('button', { name: /^Consultas realizadas: / }).getAttribute('aria-label')).match(/: (\d+)\./)[1])
    const vendido = cuerpo.getByRole('button', { name: /^Vendido: / })
    const ingresos = num((await vendido.getAttribute('aria-label')).match(/\$([\d.,]*\d)/)[1])
    await vendido.click()
    const ventana = page.getByRole('dialog', { name: /^Vendido: / })
    const ventas = Number((await ventana.getAttribute('aria-label')).match(/(\d+) venta/)[1])
    await page.keyboard.press('Escape')
    await expect(ventana).toHaveCount(0)
    return { consultas, ingresos, ventas }
  }
  // Los indicadores arrancan en 0 mientras cargan los datos, y en una óptica vacía 0 es un valor legítimo: no se puede esperar
  // "una cifra mayor que cero". Se espera a que el Reportes termine de cargar (sin esqueletos, con las tarjetas pintadas) y a que
  // la lectura se mantenga igual durante un par de segundos.
  await expect(cuerpo.getByRole('button', { name: /^Vendido: / })).toBeVisible({ timeout: 25_000 })
  await expect(cuerpo.locator('.animate-pulse')).toHaveCount(0, { timeout: 25_000 })
  let previa = JSON.stringify(await leer())
  await expect(async () => {
    await page.waitForTimeout(1500)
    const actual = JSON.stringify(await leer())
    const estable = actual === previa
    previa = actual
    expect(estable, 'el Reportes sigue cargando').toBe(true)
  }).toPass({ timeout: 25_000 })
  return JSON.parse(previa)
}
let antes

test('0 · Reportes antes del recorrido (administrador)', async ({ page }) => {
  antes = await leerReportes(page)
  expect(Object.values(antes).every(Number.isFinite), JSON.stringify(antes)).toBe(true)
})

test('1 · Recepción agenda una cita para Paula con un paciente nuevo', async ({ page }) => {
  await agendarCitaParaPaula(page, datos)
})

test('2 · Paula atiende al paciente: ficha, diagnóstico y control', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(datos.nombre)
  await page.getByText(datos.nombre).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 20_000 })
  // La cita actual o próxima trae "Ingresar": entra directo a su ficha.
  await page.getByRole('button', { name: 'Atender' }).first().click()
  // Si Recepción agendó la cita para otro día (de noche no hay cupo hoy), la ficha pregunta si se atiende hoy
  const pregunta = page.getByRole('dialog', { name: 'Atender una cita de otro día' })
  if (await pregunta.waitFor({ timeout: 4_000 }).then(() => true, () => false)) await pregunta.getByRole('button', { name: 'Atenderla hoy' }).click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Entendido, completar antecedentes' }).click()
  await llenarFichaObligatoria(page) // agudeza sin corrección y refracción de los dos ojos (el examen es opcional); queda en Diagnóstico y receta
  // La lista de diagnósticos rápidos es de cada óptica (la de pruebas conserva «Miopia» sin tilde): vale cualquiera de las dos.
  await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
  await page.getByLabel(/Añadir recomendación de lente/).check()
  await page.getByLabel('Lente a recomendar').fill(`${PREFIJO}Monofocal con antirreflejo`)
  await page.getByRole('radio', { name: /Agendar después/ }).check()
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  const confirmarFicha = page.getByRole('dialog').last()
  await confirmarFicha.getByRole('button', { name: 'Terminar atención' }).click()
  // Al terminar se abre el documento del diagnóstico (Descargar PDF, Imprimir y Cerrar)
  const documento = page.getByRole('dialog', { name: /Atención terminada/ })
  await expect(documento.getByRole('button', { name: /Descargar PDF/ })).toBeVisible({ timeout: 20_000 })
  await documento.getByRole('button', { name: 'Cerrar' }).last().click()
  const terminada = page.getByRole('status').filter({ hasText: 'Atención terminada' })
  await expect(terminada).toContainText('la cita quedó atendida', { timeout: 20_000 })
  await terminada.getByRole('button', { name: 'Pasar a la óptica' }).click()
  await expect(page.getByText(/Listo para venta/).first()).toBeVisible({ timeout: 15_000 })
})

test('3 · Vera vende desde «Nueva venta» con el último diagnóstico como guía, un abono dividido (efectivo y tarjeta) y luna: se crea el pedido', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('button', { name: 'Nueva venta' }).first().click()
  const venta = page.getByRole('dialog').last()
  await venta.getByLabel('Paciente').fill(datos.nombre)
  await venta.getByRole('button', { name: new RegExp(datos.nombre) }).click()
  // Su último diagnóstico se ve en la venta y «Usar como guía» lleva a la luna lo que recomendó el optómetra.
  await expect(venta.getByText(/Último diagnóstico/)).toBeVisible({ timeout: 20_000 })
  await venta.getByRole('button', { name: 'Usar como guía' }).click()
  await expect(venta.getByText('Usado como guía')).toBeVisible()
  await venta.locator('#luna-precio').fill('80')
  await venta.getByRole('button', { name: '+ Agregar luna' }).click()
  // La consulta, como servicio.
  await venta.getByRole('button', { name: 'Servicio', exact: true }).click()
  await venta.getByPlaceholder(/Descripción del servicio/).fill(PREFIJO + 'Consulta')
  await venta.getByPlaceholder('0.00').last().fill('20')
  await venta.getByRole('button', { name: '+ Agregar línea' }).click()
  await expect(venta.getByText('$100.00').first()).toBeVisible()
  // Con lunas se crea el pedido: cómo lo recibe el paciente y la fecha aproximada en que estará listo.
  await expect(venta.getByText('Incluye lunas: se creará el pedido.')).toBeVisible()
  await expect(venta.getByRole('button', { name: 'Retira en la óptica' })).toHaveAttribute('aria-pressed', 'true')
  // El campo de fecha es el calendario del sistema y conserva su etiqueta para lectores de pantalla.
  await elegirFecha(venta, 'venta-fecha-pedido', fechaEn(7))
  // Pago de hoy: $30, repartido en $20 en efectivo y $10 con tarjeta; lo demás queda como saldo.
  await venta.getByLabel('Pago hoy').fill('30')
  await venta.getByRole('button', { name: /Dividir el pago/ }).click()
  await venta.getByLabel('Monto del pago 1').fill('20')
  await venta.getByLabel('Método del pago 2').selectOption('tarjeta')
  await venta.getByLabel('Monto del pago 2').fill('10')
  await expect(venta.getByText('Todo repartido')).toBeVisible()
  await venta.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(venta).toHaveCount(0, { timeout: 20_000 })
})

test('4 · Vera sigue el pedido: marcar listo, avisar al paciente, cobrar el saldo y entregar', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('tab', { name: /^Pedidos/ }).click()
  await page.getByLabel('Buscar por paciente o número de pedido').fill(datos.nombre)
  const lista = page.getByRole('list', { name: 'Pedidos' })
  const fila = lista.getByRole('listitem').filter({ hasText: datos.nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await expect(fila).toContainText('En proceso')
  await expect(fila).toContainText('Retira en la óptica')

  // Cada fila lleva UNA acción: la siguiente del proceso.
  await fila.getByRole('button', { name: 'Marcar listo' }).click()
  await expect(page.getByText(/OL-\d+ listo para entregar. Contacta al paciente para avisarle./)).toBeVisible({ timeout: 15_000 })
  // Ya no está «En proceso»: se sigue desde «Listos para entregar».
  await page.getByRole('group', { name: 'Estado de los pedidos' }).getByRole('button', { name: /^Listos para entregar/ }).click()
  await expect(fila).toContainText('Listo · sin avisar', { timeout: 15_000 })

  // «Avisar al paciente» abre la ventana única de Contactar con la plantilla «Pedido listo (retira)»; WhatsApp se abre al enviar. Se cierra enseguida.
  await fila.getByRole('button', { name: 'Avisar al paciente' }).click()
  const contactar = page.getByRole('dialog', { name: 'Contactar' })
  await expect(contactar.getByLabel(/Mensaje/)).toHaveValue(/ya está listo\. Te esperamos en la óptica para retirarlo\./)
  const [whatsapp] = await Promise.all([page.waitForEvent('popup'), contactar.getByRole('button', { name: /Enviar por WhatsApp/ }).click()])
  await whatsapp.close()
  await expect(fila).toContainText('Listo · avisado', { timeout: 15_000 })

  // Con saldo, entregar pide cobrarlo antes.
  await fila.getByRole('button', { name: 'Entregar', exact: true }).click()
  const saldo = page.getByRole('dialog', { name: 'Hay un saldo por cobrar' })
  await expect(saldo).toContainText('$70.00') // $100 - abono inicial de $30
  await saldo.getByRole('button', { name: 'Cobrar abono' }).click()
  const abono = page.getByRole('dialog', { name: 'Registrar abono' })
  await abono.getByRole('button', { name: /Pagar el saldo completo/ }).click()
  await abono.getByLabel('Nota (opcional)').fill(`${PREFIJO}saldo`)
  await abono.getByRole('button', { name: 'Registrar abono', exact: true }).click()
  await expect(abono).toHaveCount(0, { timeout: 20_000 })

  // Sin saldo, entregar es directo.
  await fila.getByRole('button', { name: 'Entregar', exact: true }).click()
  await expect(page.getByText(/OL-\d+: entregado\./)).toBeVisible({ timeout: 15_000 })
  // Sale de los listos; aparece con «Entregados».
  await page.getByRole('group', { name: 'Estado de los pedidos' }).getByRole('button', { name: /^Entregados/ }).click()
  await expect(fila).toContainText('Entregado', { timeout: 15_000 })
})

test('4b · La venta en la lista de Ventas: su entrega y el comprobante con sus abonos', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByLabel('Buscar paciente o comprobante').fill(datos.nombre)
  const lista = page.getByRole('list', { name: 'Ventas' })
  const fila = lista.getByRole('listitem').filter({ hasText: datos.nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await expect(fila).toContainText('Pagada') // el saldo se cobró al entregar
  await expect(fila).toContainText('Entregado') // la columna «Entrega» dice cómo va su pedido
  await fila.getByRole('button', { name: /^Ver la venta CV-/ }).click()
  const detalle = page.getByRole('dialog', { name: /^Comprobante CV-/ })
  await expect(detalle).toContainText('Pagos')
  await expect(detalle).toContainText('Efectivo $20.00 + Tarjeta $10.00')
  await expect(detalle.getByRole('button', { name: /Imprimir comprobante/ })).toBeVisible()
})

test('5 · El administrador ve el resultado en Reportes y la cita quedó atendida', async ({ page }) => {
  const despues = await leerReportes(page)
  expect(despues.consultas, 'una ficha clínica más').toBe(antes.consultas + 1)
  expect(despues.ventas, 'una venta más').toBe(antes.ventas + 1)
  expect(Math.round((despues.ingresos - antes.ingresos) * 100) / 100, 'ingresos: consulta $20 + luna $80').toBe(100)

  // La cita del paciente quedó "Atendida" (Paula al terminar la atención).
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(datos.nombre)
  // Con el filtro de estado en 'Atendidas' (panel Filtrar), la cita del paciente tiene que seguir apareciendo.
  await page.getByRole('button', { name: /Filtrar/ }).click()
  await page.locator('#citas-filtrar-panel').getByRole('group', { name: 'Estado' }).getByRole('button', { name: 'Atendidas' }).click()
  await expect(page.locator('main').getByText(datos.nombre).first()).toBeVisible({ timeout: 20_000 })
})

// Va aparte del recorrido: necesita una cita suya DE HOY (no de otro día), que se crea por API para no depender de la hora.
test('6 · Paula ve "Siguiente paciente" con "Atender", que entra directo a la ficha clínica', async ({ page }) => {
  await crearCitaDeHoyParaPaula('E2E')
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  const tarjeta = page.locator('main').first().getByLabel('Siguiente paciente')
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  // Sin el modal "Resumen de la cita": Atender lleva directo a la ficha (reunión 7 oct., C16).
  await expect(page.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Resumen de la cita')).toHaveCount(0)
})
