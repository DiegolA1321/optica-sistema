// Abrir un día no laborable desde Citas (8 oct): el modal del día cerrado ofrece "Abrir este día" (solo con "Mi horario: editar"),
// elige mañana y/o tarde (solo para el personal), queda como excepción de esa fecha (se ve en Mi horario) y se puede volver a cerrar si no tiene
// citas. ESCRIBE datos: corre en la óptica de pruebas (E2E) y deja el día como estaba.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function irAlDomingo(page, rol) {
  await iniciarSesion(page, rol, 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Mes' }).click()
  await page.getByTitle('Elegir otra fecha').click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await selector.getByRole('button', { name: 'dic', exact: true }).click()
  // Domingo 20 de diciembre de 2026
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^20/ }).first().click({ position: { x: 6, y: 4 } })
  return page.getByRole('dialog')
}

test('el administrador abre un domingo solo para esa fecha, aparece en Mi horario y puede volver a cerrarlo', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  const dia = await irAlDomingo(page, 'ADMIN')
  await expect(dia.getByText('La óptica no atiende este día')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-1-dia-cerrado.png' })
  await dia.getByRole('button', { name: 'Abrir este día' }).click()

  await expect(dia.getByRole('heading', { name: /Abrir el domingo/i })).toBeVisible()
  await expect(dia.getByLabel('Mañana: desde')).toBeEnabled()
  await expect(dia.getByRole('checkbox', { name: /reservas por la web/ })).toHaveCount(0)
  await expect(dia.getByText(/solo para el personal/)).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-2-formulario.png' })

  // Validación: sin ninguna sesión no se puede abrir
  await dia.getByRole('checkbox', { name: 'Mañana' }).uncheck()
  await dia.getByRole('button', { name: 'Solo abrir' }).click()
  await expect(dia.getByRole('alert')).toHaveText(/al menos la mañana o la tarde/)
  await dia.getByRole('checkbox', { name: 'Mañana' }).check()

  await dia.getByRole('button', { name: 'Solo abrir' }).click()
  await expect(page.getByText(/abierto \(/)).toBeVisible({ timeout: 15_000 })
  await expect(dia.getByText('Un día despejado')).toBeVisible()
  await expect(dia.getByRole('button', { name: /Agendar en este día/ })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-3-abierto.png' })

  // Mi horario lo refleja como cambio puntual y sin reservas web
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Mi horario', exact: true }).first().click()
  await expect(page.getByText(/Próximos cambios sobre (el|tu) horario habitual/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Abierto por/).first()).toBeVisible()
  await expect(page.getByText(/Solo personal|También web/)).toHaveCount(0)
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-4-mi-horario.png' })

  // Volver a cerrarlo desde Citas
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Mes' }).click()
  await page.getByTitle('Elegir otra fecha').click()
  await page.getByRole('dialog', { name: 'Elegir fecha' }).getByRole('button', { name: 'dic', exact: true }).click()
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^20/ }).first().click({ position: { x: 6, y: 4 } })
  await page.getByRole('dialog').getByRole('button', { name: 'Volver a cerrarlo' }).click()
  await expect(page.getByText(/vuelve a estar cerrado/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('dialog').getByText('La óptica no atiende este día')).toBeVisible()
  expect(errores).toEqual([])
})

test('"Abrir y agendar" deja el formulario de agendar con ese día; el personal sin permiso de horario no puede abrirlo', async ({ page, browser }) => {
  const dia = await irAlDomingo(page, 'ADMIN')
  await dia.getByRole('button', { name: 'Abrir este día' }).click()
  await dia.getByRole('button', { name: 'Abrir y agendar' }).click()
  await expect(page.getByRole('dialog', { name: /Gestionar cita/ })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('dialog', { name: /Gestionar cita/ }).getByText(/20 de diciembre|20\/12\/2026|dic/i).first()).toBeVisible()
  await page.keyboard.press('Escape')

  // Se vuelve a cerrar para dejar la óptica como estaba
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^20/ }).first().click({ position: { x: 6, y: 4 } })
  await page.getByRole('dialog').getByRole('button', { name: 'Volver a cerrarlo' }).click()
  await expect(page.getByText(/vuelve a estar cerrado/)).toBeVisible({ timeout: 15_000 })

  // Ventas no tiene "Mi horario: editar": ve el día cerrado pero sin botón
  const ventas = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await iniciarSesion(ventas, 'VENTAS', 'E2E')
  const citasVisible = await ventas.getByRole('button', { name: 'Citas médicas', exact: true }).count()
  if (citasVisible) {
    await ventas.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
    await expect(ventas.getByRole('button', { name: 'Abrir este día' })).toHaveCount(0)
  }
  await ventas.close()
})

test('Semana y Lista muestran el domingo cerrado y permiten abrirlo desde ahí', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Semana' }).click()
  // Siete columnas: el domingo siempre aparece, aunque esté cerrado
  await expect(page.getByTitle('Ver las citas de este día')).toHaveCount(7)
  await expect(page.getByText('Cerrado').first()).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-5-semana-con-domingo.png' })

  // Lista: un domingo cerrado, con el botón para abrirlo (abre el formulario directo)
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Lista' }).click()
  await page.getByTitle('Elegir otra fecha').click()
  const selector = page.getByRole('dialog', { name: 'Elegir fecha' })
  await selector.getByRole('button', { name: 'Mes siguiente' }).click()
  await selector.getByRole('button', { name: /de noviembre/ }).filter({ hasText: /^8$/ }).click()
  await expect(page.getByText(/la óptica no atiende/)).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/abrir-6-lista-cerrado.png' })
  await page.getByRole('button', { name: 'Abrir este día' }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: /Abrir el domingo/i })).toBeVisible()
  await page.keyboard.press('Escape')
})

test('cerrar un día puntual con nombre de feriado: se ve en Citas (Semana, Mes y modal) y en Mi horario, y se restaura desde Mi horario', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Mes' }).click()
  await page.getByTitle('Elegir otra fecha').click()
  await page.getByRole('dialog', { name: 'Elegir fecha' }).getByRole('button', { name: 'dic', exact: true }).click()
  // Lunes 21 de diciembre de 2026: un día normal de atención
  await page.getByTitle('Ver las citas de este día').filter({ hasText: /^21/ }).first().click({ position: { x: 6, y: 4 } })
  let dia = page.getByRole('dialog')
  await dia.getByRole('button', { name: /Cerrar este día \(feriado u otro motivo\)/ }).click()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/feriado-1-cerrar-con-nombre.png' })
  await dia.getByPlaceholder('Ej.: Feriado: Día de los Difuntos').fill('Feriado: Día de los Difuntos')
  await dia.getByRole('button', { name: 'Cerrar este día', exact: true }).click()
  await expect(page.getByText(/cerrado: Feriado: Día de los Difuntos/)).toBeVisible({ timeout: 15_000 })
  await expect(dia.getByText('Feriado: Día de los Difuntos').first()).toBeVisible()
  await expect(dia.getByRole('button', { name: /Agendar/ })).toHaveCount(0)
  await page.keyboard.press('Escape')

  // Mes: el nombre sale en la casilla del día
  await expect(page.getByTitle('Feriado: Día de los Difuntos').first()).toBeVisible()
  // Semana: el nombre reemplaza a "Cerrado" en esa columna
  await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Semana' }).click()
  await page.getByTitle('Elegir otra fecha').click()
  const sel = page.getByRole('dialog', { name: 'Elegir fecha' })
  await sel.getByRole('button', { name: 'Mes siguiente' }).click()
  await sel.getByRole('button', { name: 'Mes siguiente' }).click()
  await sel.getByRole('button', { name: /21 de diciembre/ }).click()
  await expect(page.getByText('Feriado: Día de los Difuntos').first()).toBeVisible()
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/feriado-2-semana.png' })

  // Mi horario: la lista muestra el nombre; desde ahí se vuelve al horario habitual
  await page.getByRole('button', { name: 'Mi horario', exact: true }).first().click()
  const fila = page.getByText(/Cerrado · Feriado: Día de los Difuntos/).first().locator('xpath=ancestor::div[contains(@class,"justify-between")][1]')
  await expect(fila).toBeVisible({ timeout: 15_000 })
  await page.screenshot({ path: 'C:/Users/diego/Downloads/citas-capturas/v4/feriado-3-mi-horario.png' })
  await fila.getByRole('button', { name: 'Editar' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Volver al horario habitual' }).click()
  await expect(page.getByText(/Cerrado · Feriado: Día de los Difuntos/)).toHaveCount(0, { timeout: 15_000 })
  expect(errores).toEqual([])
})
