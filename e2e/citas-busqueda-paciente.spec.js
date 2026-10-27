// «Gestionar cita»: la búsqueda de paciente en sus tres casos (con resultados, sin resultados y óptica sin pacientes), en computadora (1093 y 1366 px) y en celular (390 px).
//   * Óptica de pruebas (escribe): con resultados se elige y queda en el campo; sin resultados sale el mensaje y «Añadir nuevo paciente» abre el formulario con lo escrito (nombre o cédula), y al registrarlo queda elegido.
//   * Óptica Vacía (pruebas), SOLO LECTURA: «Aún no hay pacientes registrados» y el botón que abre el formulario.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearPacienteConHistorial } from './ayudas.js'

const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')

async function abrirGestionar(page, celular) {
  if (celular) {
    await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar cita', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
    await page.getByRole('button', { name: 'Gestionar cita' }).first().click()
  }
  const form = page.getByRole('dialog', { name: 'Gestionar cita' })
  await expect(form).toBeVisible()
  return form
}

// Lo que se ve de la lista queda por encima de todo: el punto central del mensaje (o del primer resultado) pertenece a la lista, no a otra capa.
async function porEncima(page, locator) {
  const c = await locator.boundingBox()
  return page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest('[role=status], ul') }, [c.x + c.width / 2, c.y + 10])
}

const tamanos = [{ ancho: 1093, alto: 800, celular: false }, { ancho: 1366, alto: 800, celular: false }, { ancho: 390, alto: 430, celular: true }]

for (const { ancho, alto, celular } of tamanos) {
  test.describe(`Buscar paciente en Gestionar cita a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: alto }, isMobile: celular, hasTouch: celular, actionTimeout: 15_000 })

    test('con resultados y sin resultados (óptica de pruebas)', async ({ page }) => {
      test.setTimeout(150_000)
      const nombre = await crearPacienteConHistorial(0)
      await iniciarSesion(page, 'RECEPCION', 'E2E')
      const form = await abrirGestionar(page, celular)
      const buscador = form.getByPlaceholder(/Escriba para buscar/)

      // Con resultados: la lista, sin el mensaje de vacío; elegir completa el campo y la cierra.
      await buscador.click()
      await page.keyboard.type(nombre, { delay: 15 })
      const opcion = form.locator('ul').getByRole('button', { name: new RegExp(nombre) })
      await expect(opcion).toBeVisible()
      await expect(form.getByRole('status')).toHaveCount(0)
      await opcion.click()
      await expect(buscador).toHaveValue(nombre)
      await expect(form.locator('ul')).toHaveCount(0)

      // Sin resultados por nombre: el mensaje, por encima de todo, y el botón lleva lo escrito al formulario.
      await buscador.fill('Zzqx Yyvw')
      const mensaje = form.getByRole('status')
      await expect(mensaje).toContainText('No se encontró ningún paciente')
      expect(await porEncima(page, mensaje)).toBe(true)
      const boton = mensaje.getByRole('button', { name: 'Añadir nuevo paciente' })
      if (celular) expect((await boton.boundingBox()).height).toBeGreaterThanOrEqual(43.5)
      await boton.click()
      await expect(form.getByPlaceholder('Nombre completo')).toHaveValue('Zzqx Yyvw')
      await expect(form.getByPlaceholder('Cédula')).toHaveValue('')

      // Sin resultados por cédula: lo escrito pasa al campo de cédula. Se completa y el paciente queda elegido en la cita.
      await form.getByRole('button', { name: 'Cancelar', exact: true }).first().click()
      await buscador.fill('1111111111')
      await expect(form.getByRole('status')).toContainText('No se encontró ningún paciente')
      await form.getByRole('status').getByRole('button', { name: 'Añadir nuevo paciente' }).click()
      await expect(form.getByPlaceholder('Cédula')).toHaveValue('1111111111')
      await expect(form.getByPlaceholder('Nombre completo')).toHaveValue('')
    })

    test('óptica sin pacientes (Óptica Vacía, solo lectura)', async ({ page }) => {
      test.setTimeout(150_000)
      await iniciarSesion(page, 'ADMIN', 'VACIA')
      const form = await abrirGestionar(page, celular)
      await form.getByPlaceholder(/Escriba para buscar/).click()
      const mensaje = form.getByRole('status')
      await expect(mensaje).toContainText('Aún no hay pacientes registrados')
      expect(await porEncima(page, mensaje)).toBe(true)
      await mensaje.getByRole('button', { name: 'Añadir nuevo paciente' }).click()
      await expect(form.getByPlaceholder('Nombre completo')).toBeVisible()
      await expect(form.getByPlaceholder('Cédula')).toBeVisible()
    })
  })
}

// Tras registrar desde el mensaje, el paciente nuevo queda elegido en la cita (óptica de pruebas).
test.describe('Registrar desde el mensaje de la búsqueda (390 px)', () => {
  test.use({ viewport: { width: 390, height: 430 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })
  test('el paciente creado queda elegido', async ({ page }) => {
    test.setTimeout(150_000)
    await iniciarSesion(page, 'RECEPCION', 'E2E')
    const form = await abrirGestionar(page, true)
    const buscador = form.getByPlaceholder(/Escriba para buscar/)
    await buscador.tap()
    await page.keyboard.type('E Dos E Zqxwv', { delay: 15 })
    await form.getByRole('status').getByRole('button', { name: 'Añadir nuevo paciente' }).tap()
    await expect(form.getByPlaceholder('Nombre completo')).toHaveValue('E Dos E Zqxwv')
    const { cedulaValida, telefonoPrueba } = await import('./ayudas.js')
    await form.getByPlaceholder('Cédula').fill(cedulaValida())
    await form.getByPlaceholder('Teléfono').fill(telefonoPrueba())
    await form.getByRole('button', { name: 'Registrar y seleccionar' }).tap()
    await expect(buscador).toHaveValue('E Dos E Zqxwv', { timeout: 15_000 })
  })
})
