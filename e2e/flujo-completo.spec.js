// Recorrido completo de la óptica, de punta a punta, en la Óptica Demo (solo ella). Crea sus propios datos con el
// prefijo "E2E " (los nombres de paciente, "E Dos E ") y no depende de la hora del día ni de citas sembradas: la cita se
// agenda en el primer día con cupo y Paula la atiende hoy.
import { test, expect } from '@playwright/test'
import { iniciarSesion, PREFIJO, nombrePrueba, cedulaValida, telefonoPrueba, agendarCitaParaPaula, crearCitaDeHoyParaPaula } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'serial' })

// Fecha ISO dentro de n días (local), para la entrega prometida del laboratorio.
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
  const leer = async () => {
    const texto = await cuerpo.innerText()
    const num = (re) => Number((texto.match(re)?.[1] ?? 'NaN').replace(/[^\d.]/g, ''))
    return { consultas: num(/CONSULTAS\s+(\d+)/), ingresos: num(/INGRESOS\s+\$([\d.,]+)/), ventas: num(/(\d+) ventas? \(sin anuladas\)/) }
  }
  // Los indicadores arrancan en 0 mientras cargan los datos, y en una óptica vacía 0 es un valor legítimo: no se puede esperar
  // "una cifra mayor que cero". Se espera a que el Reportes termine de cargar (sin esqueletos, con las tarjetas pintadas) y a que
  // la lectura se mantenga igual durante un par de segundos.
  await expect(cuerpo.getByText(/ventas? \(sin anuladas\)/)).toBeVisible({ timeout: 25_000 })
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
  await page.getByRole('button', { name: 'Ingresar' }).first().click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Entendido, completar antecedentes' }).click()
  await page.getByRole('button', { name: /^Siguiente$/ }).click() // Refracción (opcional)
  await page.getByRole('button', { name: /^Siguiente$/ }).click() // Diagnóstico y receta
  // La lista de diagnósticos rápidos es de cada óptica (la de pruebas conserva «Miopia» sin tilde): vale cualquiera de las dos.
  await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
  await page.getByLabel(/Añadir recomendación de lente/).check()
  await page.getByLabel('Lente a recomendar').fill(`${PREFIJO}Monofocal con antirreflejo`)
  await page.getByRole('radio', { name: /Agendar después/ }).check()
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  const confirmarFicha = page.getByRole('dialog').last()
  await confirmarFicha.getByRole('button', { name: 'Terminar atención' }).click()
  const terminada = page.getByRole('status').filter({ hasText: 'Atención terminada' })
  await expect(terminada).toContainText('la cita quedó atendida', { timeout: 20_000 })
  await terminada.getByRole('button', { name: 'Pasar a la óptica' }).click()
  await expect(page.getByText(/Listo para venta/).first()).toBeVisible({ timeout: 15_000 })
})

test('3 · Vera vende con abono y luna', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('tab', { name: /Por vender/ }).click()
  await page.getByLabel('Buscar paciente en la cola').fill(datos.nombre)
  const tarjeta = page.getByRole('list', { name: 'Pacientes listos para venta' }).getByRole('listitem').filter({ hasText: datos.nombre })
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  await tarjeta.getByRole('button', { name: 'Tomar datos del diagnóstico' }).click()
  const venta = page.getByRole('dialog').last()
  // La consulta y la luna recomendada (con el texto de la ficha) llegan precargadas; solo falta el precio de cada una.
  await expect(venta.getByText(`Luna: ${PREFIJO}Monofocal con antirreflejo`)).toBeVisible()
  await venta.getByLabel(/^Precio de Consulta/).fill('20')
  await venta.getByLabel(/^Precio de Luna:/).fill('80')
  await expect(venta.getByText('$100.00')).toBeVisible()
  await expect(venta.getByLabel('Esta venta incluye lentes')).toBeChecked()
  await venta.getByRole('button', { name: 'Abonos', exact: true }).click()
  await venta.locator('#abono-inicial').fill('30')
  await venta.getByRole('button', { name: 'Registrar venta' }).click()
  await expect(page.getByText(`Venta registrada: ${datos.nombre} salió de la lista de espera.`)).toBeVisible({ timeout: 20_000 })

  // Se abre sola la orden de laboratorio, con la receta de la consulta.
  const orden = page.getByRole('dialog', { name: 'Nueva orden de laboratorio' })
  await expect(orden).toBeVisible()
  await orden.getByLabel('Laboratorio').fill(PREFIJO + 'Laboratorio')
  await orden.getByLabel('Entrega prometida *').fill(fechaEn(7))
  await orden.getByLabel('Observaciones').fill(PREFIJO + 'orden de prueba')
  await orden.getByRole('button', { name: 'Crear orden', exact: true }).click()
  await expect(orden).toHaveCount(0, { timeout: 20_000 })
})

test('4 · Vera marca la orden lista, avisa, cobra el saldo y entrega', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('tab', { name: /Órdenes de laboratorio/ }).click()
  await page.getByLabel('Buscar orden de laboratorio').fill(datos.nombre)
  const fila = page.getByRole('listitem').filter({ hasText: datos.nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await expect(fila).toContainText(`${PREFIJO}Laboratorio`)
  await expect(fila).toContainText('Saldo $70.00') // $100 - abono inicial de $30

  await fila.getByRole('button', { name: /Marcar lista/ }).click()
  await expect(page.getByText(/lista para entregar. Avísale al paciente./)).toBeVisible({ timeout: 15_000 })
  await expect(fila).toContainText('Falta avisar al paciente')

  // "Avisar" solo abre WhatsApp en otra pestaña con el mensaje; no envía nada. Se cierra enseguida.
  const [whatsapp] = await Promise.all([page.waitForEvent('popup'), fila.getByRole('button', { name: 'Avisar por WhatsApp' }).click()])
  await whatsapp.close()
  await expect(fila).toContainText('Pacie') // "Paciente avisado …"

  // Con saldo, entregar pide cobrarlo antes.
  await fila.getByRole('button', { name: /Marcar entregada/ }).click()
  const saldo = page.getByRole('alertdialog', { name: 'Hay un saldo por cobrar' })
  await expect(saldo).toContainText('$70.00')
  await saldo.getByRole('button', { name: 'Cobrar abono' }).click()
  const abono = page.getByRole('dialog', { name: 'Registrar abono' })
  await abono.getByRole('button', { name: /Pagar el saldo completo/ }).click()
  await abono.getByLabel('Nota (opcional)').fill(`${PREFIJO}saldo`)
  await abono.getByRole('button', { name: 'Registrar abono', exact: true }).click()
  await expect(abono).toHaveCount(0, { timeout: 20_000 })
  await expect(fila).not.toContainText(/Saldo \$/,{ timeout: 15_000 })

  // Sin saldo, entregar es directo.
  await fila.getByRole('button', { name: /Marcar entregada/ }).click()
  await expect(page.getByText(/OL-\d+: entregada\./)).toBeVisible({ timeout: 15_000 })
  // Sale de las abiertas; aparece en "Entregadas".
  await page.getByRole('button', { name: /^Entregadas/ }).click()
  await expect(fila).toContainText('Entregada', { timeout: 15_000 })
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
