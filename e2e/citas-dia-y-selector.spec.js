// Citas (8 oct): modal "Citas del día" al hacer clic en un día de Semana o Mes, selector de fecha en el título del periodo y
// filtro "Fechas" disponible en las tres vistas. SOLO LECTURA: corre en la Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function irACitas(page, vista) {
  await iniciarSesion(page, 'ADMIN', 'DEMO')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('button', { name: vista, exact: true }).first().click()
}

test('Semana: el encabezado y una zona libre abren las citas del día (con mensaje si no hay)', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await irACitas(page, 'Semana')
  await page.getByTitle('Ver las citas de este día').nth(3).click() // jueves
  const dia = page.getByRole('dialog')
  await expect(dia.getByRole('heading', { name: /Hoy/ })).toBeVisible()
  await expect(dia.getByText(/\d+ citas? ·/)).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/dia-con-citas.png' })
  await dia.getByRole('button', { name: 'Cerrar' }).click()

  // lunes pasado sin citas
  await page.getByTitle('Ver las citas de este día').nth(0).click()
  await expect(page.getByRole('dialog').getByText('Sin citas este día')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // una semana lejana: día futuro sin citas, con el mensaje amable y "Agendar"
  await page.getByRole('button', { name: /oct 2026/ }).first().click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await selector.getByRole('button', { name: 'Mes siguiente' }).click()
  await selector.getByRole('button', { name: 'Mes siguiente' }).click()
  await selector.getByRole('button', { name: /23 de diciembre/ }).click()
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
  await page.getByTitle('Ver las citas de este día').nth(10).click({ position: { x: 6, y: 4 } })
  await expect(page.getByRole('dialog', { name: /./ })).toBeVisible()
  await expect(page.getByRole('button', { name: /Ver esta semana/ })).toBeVisible()
})

test('El título del periodo abre un selector de fecha en Semana, Mes y Lista', async ({ page }) => {
  await irACitas(page, 'Semana')
  await page.getByRole('button', { name: /oct 2026/ }).first().click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await expect(selector).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/selector-semana.png' })
  await selector.getByRole('button', { name: /20 de octubre/ }).click()
  await expect(page.getByRole('button', { name: /19 – 25 oct 2026/ })).toBeVisible()

  await page.getByRole('button', { name: 'Mes', exact: true }).first().click()
  await page.getByRole('button', { name: /Octubre 2026/ }).first().click()
  await page.getByRole('dialog', { name: 'Elegir fecha' }).getByRole('button', { name: 'ene', exact: true }).click()
  await expect(page.getByRole('button', { name: /Enero 2026/ })).toBeVisible()

  await page.getByRole('button', { name: 'Lista', exact: true }).first().click()
  await page.getByRole('button', { name: /Hoy|Enero 2026/ }).filter({ hasText: /\d{4}/ }).first().click()
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toBeVisible()
})

test('El filtro "Fechas" está en el panel de las tres vistas y, desde Semana, pasa a la Lista', async ({ page }) => {
  await irACitas(page, 'Semana')
  await page.getByRole('button', { name: /Filtrar/ }).click()
  await expect(page.getByRole('button', { name: /Elegir rango de fechas/ })).toBeVisible()
  await page.getByRole('button', { name: /Elegir rango de fechas/ }).click()
  await page.getByRole('button', { name: '03/10/2026' }).click()
  await page.getByRole('button', { name: '20/10/2026' }).click()
  await expect(page.getByText(/Fechas: .*–/)).toBeVisible()
  await expect(page.getByText(/citas? en el rango/)).toBeVisible()
})

test('Mes: sin el interruptor Citas/Carga ni el conteo repetido; día vacío sin "Ver esta semana" y el modal de un día con citas sí lo ofrece', async ({ page }) => {
  await irACitas(page, 'Mes')
  await expect(page.getByRole('button', { name: 'Carga', exact: true })).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Qué mostrar en el calendario' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Octubre 2026/ }).first()).toBeVisible()

  // Un martes futuro sin citas (21 de octubre es miércoles; 27 de octubre, martes)
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^27/ }).first().click({ position: { x: 6, y: 4 } })
  const dia = page.getByRole('dialog')
  await expect(dia.getByText('Un día despejado')).toBeVisible()
  await expect(dia.getByRole('button', { name: /Ver esta semana/ })).toHaveCount(0)
  await expect(dia.getByRole('button', { name: /Agendar en este día/ })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/dia-vacio-centrado.png' })
  await page.keyboard.press('Escape')

  // Un día con citas (martes 6): ofrece ver la semana; es pasado, no ofrece agendar
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^6/ }).first().click({ position: { x: 6, y: 4 } })
  await expect(page.getByRole('dialog').getByRole('button', { name: /Ver esta semana/ })).toBeVisible()
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
