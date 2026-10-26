// Citas (8 oct): modal "Citas del día" al hacer clic en un día de Semana o Mes, selector de fecha en el título del periodo y
// filtro "Fechas" disponible en las tres vistas. SOLO LECTURA: corre en la Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion, elegirVista } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function irACitas(page, vista) {
  await iniciarSesion(page, 'ADMIN', 'DEMO')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await elegirVista(page, vista)
}

// El número de cada día del Mes abre «Citas del día»; el resto de la celda abre «Gestionar cita» (días de hoy en adelante).
const numeroDelDia = (page) => page.getByRole('button', { name: /^Ver las citas del / })

test('Semana: el encabezado y una zona libre abren las citas del día (con mensaje si no hay)', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await irACitas(page, 'Semana')
  // Las columnas de la semana van de lunes a domingo: la de hoy depende del día en que se corra la prueba.
  const hoyIdx = await page.evaluate(() => (new Date().getDay() + 6) % 7)
  const otroIdx = hoyIdx === 0 ? 1 : 0
  const dias = page.getByTitle('Ver las citas de este día')
  await dias.nth(hoyIdx).click()
  const dia = page.getByRole('dialog')
  // El título de la ventana es el día; "Hoy" va como etiqueta junto al título.
  await expect(dia.getByRole('heading')).toBeVisible()
  await expect(dia.getByText('Hoy', { exact: true })).toBeVisible()
  // Hoy puede tener citas o no (la Demo cambia): se dice cuántas hay o se avisa que no hay.
  await expect(dia.getByText(/\d+ citas? ·|Sin citas|Un día despejado|Cerrado · día sin atención/).first()).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/dia-con-citas.png' })
  await dia.getByRole('button', { name: 'Cerrar', exact: true }).click()

  // otro día de la misma semana: abre su propio modal, que no es "Hoy"
  await dias.nth(otroIdx).click()
  await expect(page.getByRole('dialog').getByText(/\d+ citas? ·|Sin citas|Un día despejado|Cerrado · día sin atención/).first()).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Hoy/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // una semana lejana: día futuro sin citas, con el mensaje amable y "Agendar"
  await page.getByRole('button', { name: /\p{L}{3,4} \d{4}/u }).first().click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await selector.getByRole('button', { name: 'Mes siguiente' }).click()
  await selector.getByRole('button', { name: 'Mes siguiente' }).click()
  const dosMesesDespues = await page.evaluate(() => new Date(new Date().getFullYear(), new Date().getMonth() + 2, 1).toLocaleDateString('es-EC', { month: 'long' }))
  await selector.getByRole('button', { name: new RegExp(`23 de ${dosMesesDespues}`) }).click()
  await page.getByTitle('Ver las citas de este día').nth(1).click()
  await expect(page.getByRole('dialog').getByText('Un día despejado')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/dia-vacio.png' })
  await expect(page.getByRole('dialog').getByRole('button', { name: /Agendar en este día/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(errores).toEqual([])
})

test('Mes: un clic en un día abre el modal del día', async ({ page }) => {
  await irACitas(page, 'Mes')
  await numeroDelDia(page).nth(10).click()
  await expect(page.getByRole('dialog', { name: /./ })).toBeVisible()
  await expect(page.getByRole('dialog').getByRole('button', { name: /Ver esta semana/ })).toHaveCount(0)
})

test('El título del periodo abre un selector de fecha en Semana, Mes y Lista', async ({ page }) => {
  // Las fechas salen de hoy: la prueba no depende del día en que se corra.
  const hoy = await page.evaluate(() => {
    const d = new Date()
    return { anio: d.getFullYear(), mesLargo: d.toLocaleDateString('es-EC', { month: 'long' }) }
  })
  await irACitas(page, 'Semana')
  await page.getByRole('button', { name: /\p{L}{3,4}\.? \d{4}/u }).first().click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await expect(selector).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/selector-semana.png' })
  // El 15 nunca cae en una semana que cruce de mes: su semana va del lunes al domingo dentro del mismo mes.
  const dia15 = await page.evaluate(() => { const d = new Date(new Date().getFullYear(), new Date().getMonth(), 15); const l = 15 - ((d.getDay() + 6) % 7); return { lunes: l, domingo: l + 6 } })
  await selector.getByRole('button', { name: new RegExp(`\\b15 de ${hoy.mesLargo}`) }).click()
  await expect(page.getByRole('button', { name: new RegExp(`${dia15.lunes} – ${dia15.domingo} \\p{L}{3,4}\\.? ${hoy.anio}`, 'u') })).toBeVisible()

  await elegirVista(page, 'Mes')
  await page.getByRole('button', { name: new RegExp(`${hoy.mesLargo} ${hoy.anio}`, 'i') }).first().click()
  await page.getByRole('dialog', { name: 'Elegir fecha' }).getByRole('button', { name: 'ene', exact: true }).click()
  await expect(page.getByRole('button', { name: new RegExp(`Enero ${hoy.anio}`) })).toBeVisible()

  await page.getByRole('button', { name: 'Lista', exact: true }).first().click()
  await page.getByRole('button', { name: /Hoy|Enero \d{4}/ }).filter({ hasText: /\d{4}/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toBeVisible()
})

test('Las fechas viven solo en el selector de periodo: Filtrar ya no tiene «Fechas» y el rango se elige en la Lista', async ({ page }) => {
  await irACitas(page, 'Lista')
  await page.getByRole('button', { name: /Filtrar/ }).click()
  await expect(page.getByRole('button', { name: /Elegir rango de fechas/ })).toHaveCount(0)
  await page.keyboard.press('Escape')
  const periodo = page.getByRole('group', { name: 'Periodo de las citas' })
  await expect(periodo.getByRole('button', { name: 'Rango' })).toBeVisible()
  await periodo.getByRole('button', { name: 'Rango' }).click()
  await expect(page.getByRole('button', { name: '03/10/2026' })).toBeVisible()
})

test('Mes: sin el interruptor Citas/Carga ni el conteo repetido; el modal del día nunca ofrece "Ver esta semana"', async ({ page }) => {
  await irACitas(page, 'Mes')
  await expect(page.getByRole('button', { name: 'Carga', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Qué mostrar en el calendario' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /\p{Lu}\p{L}+ \d{4}/u }).first()).toBeVisible()

  // Un día futuro sin citas y abierto: se busca en el mes siguiente (siempre futuro) entre los días 10 a 20, que no se repiten con los vecinos del calendario.
  await page.getByRole('button', { name: 'Mes siguiente', exact: true }).click()
  const dia = page.getByRole('dialog')
  let hallado = false
  for (let n = 10; n <= 20 && !hallado; n++) {
    await numeroDelDia(page).filter({ hasText: new RegExp(`^${n}$`) }).first().click()
    if (await dia.getByText('Un día despejado').isVisible()) hallado = true
    else await page.keyboard.press('Escape')
  }
  expect(hallado, 'un día futuro abierto y sin citas en el mes siguiente').toBe(true)
  await expect(dia.getByRole('button', { name: /Ver esta semana/ })).toHaveCount(0)
  await expect(dia.getByRole('button', { name: /Agendar en este día/ })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/dia-vacio-centrado.png' })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Mes anterior', exact: true }).click()

  // Un día pasado (el 1 del mes, que nunca es hoy ni futuro salvo el día 1): no ofrece agendar
  const diaPasado = (await page.evaluate(() => new Date().getDate())) > 1 ? 1 : null
  if (diaPasado === null) return
  await numeroDelDia(page).filter({ hasText: /^1$/ }).first().click()
  await expect(page.getByRole('dialog').getByRole('button', { name: /Ver esta semana/ })).toHaveCount(0)
  await expect(page.getByRole('dialog').getByRole('button', { name: /Agendar/ })).toHaveCount(0)
})

test('Panel Filtrar: lo seleccionado se ve completo (sin extremo cortado)', async ({ page }) => {
  await irACitas(page, 'Mes')
  await page.getByRole('button', { name: /Filtrar/ }).click()
  await page.waitForTimeout(400)
  await page.getByRole('button', { name: 'Todas', exact: true }).first().screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/chip-todas.png' })
  const origen = await page.getByRole('button', { name: 'Todas', exact: true }).first().evaluate((el) => getComputedStyle(el).backgroundOrigin)
  expect(origen).toBe('border-box')
})

test('Del modal del día al detalle de una cita: el fondo no se vuelve a animar (sin parpadeo) y el título va a la izquierda de las flechas', async ({ page }) => {
  await irACitas(page, 'Mes')
  const anterior = page.getByRole('button', { name: 'Mes anterior' })
  const titulo = page.getByRole('button', { name: /Octubre 2026/ }).first()
  expect((await titulo.boundingBox()).x).toBeLessThan((await anterior.boundingBox()).x)
  await numeroDelDia(page).filter({ hasText: /^8$/ }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: /Rafael Cedeño/ }).click()
  const fondo = page.locator('div.fixed.inset-0').filter({ has: page.getByRole('dialog') }).first()
  await expect(page.getByRole('dialog').getByText('Detalle de la cita')).toBeVisible()
  expect(await fondo.evaluate((el) => getComputedStyle(el).animationName)).toBe('none')
})

test('Periodo, título y flechas tienen la misma altura en Lista, Semana y Mes, y el título no deja huecos', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'DEMO')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1000)
  for (const vista of ['Lista', 'Semana', 'Mes']) {
    await elegirVista(page, vista)
    await page.waitForTimeout(500)
    const flechas = page.getByRole('button', { name: /anterior$/ }).first().locator('xpath=..')
    const titulo = page.getByRole('button', { name: /\d{4}/ }).filter({ has: page.locator('svg') }).last()
    const alturas = [(await flechas.boundingBox()).height, (await titulo.boundingBox()).height]
    if (vista === 'Lista') alturas.push((await page.getByRole('group', { name: 'Periodo de las citas' }).boundingBox()).height)
    expect(new Set(alturas.map((h) => Math.round(h))).size, `${vista}: ${alturas}`).toBe(1)
  }
})
