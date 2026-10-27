// Panel del personal en celular y tablet, parte 2: la Agenda (Citas), a 360, 390, 430 y 820 px.
//   * Óptica Demo, SOLO LECTURA, con el administrador y el optómetra: los días deslizables, las tarjetas, «Filtrar» (con todo lo de la barra de la computadora), el detalle de una cita a pantalla
//     completa con sus acciones abajo, el «+» que abre «Gestionar cita» a pantalla completa, sin desplazamiento horizontal, 44 px y 16 px; y en tablet la Semana y el Mes completos.
//   * Óptica de pruebas (escribe): quien llega segundo a una hora ve «Esa hora acaba de ocuparse. Elige otra.» dentro de la ventana, sin perder lo escrito.
import { test, expect } from '@playwright/test'
import { iniciarSesion, nombrePrueba, cedulaValida, telefonoPrueba, seleccionarPorTexto, crearPacienteConHistorial } from './ayudas.js'

const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')

async function medir(page) {
  return page.evaluate(() => {
    const visible = (e) => { const c = e.getBoundingClientRect(); const s = getComputedStyle(e); return c.width > 0 && c.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const chicos = [], letra = []
    for (const e of document.body.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary')) {
      if (!visible(e) || e.closest('.overflow-x-auto')) continue
      const casilla = e.tagName === 'INPUT' && /^(checkbox|radio)$/.test(e.type)
      const c = (casilla ? (e.closest('label') || e) : e).getBoundingClientRect()
      const nombre = (e.getAttribute('aria-label') || e.textContent || e.placeholder || e.tagName).trim().slice(0, 40)
      if (c.height < 43.5 || c.width < 43.5) chicos.push(`${nombre} (${Math.round(c.width)}x${Math.round(c.height)})`)
      if (!casilla && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) letra.push(nombre)
    }
    return { desborda: document.documentElement.scrollWidth > window.innerWidth + 1, chicos, letra }
  })
}
const limpio = { desborda: false, chicos: [], letra: [] }

for (const ancho of [360, 390, 430, 820]) {
  test.describe(`Agenda a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })

    for (const [rol, nombreRol] of [['ADMIN', 'administrador'], ['OPTOMETRA', 'optómetra']]) {
      test(`${nombreRol}: días, tarjetas, filtros, detalle y «+»`, async ({ page }) => {
        test.setTimeout(150_000)
        await iniciarSesion(page, rol, 'DEMO')
        await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
        await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
        await expect(page.locator('.modo-celular header p').first()).toHaveText('Agenda')

        // Los días de la semana, deslizables, con el de hoy marcado; el título de la cabecera cuenta lo que se ve.
        const dias = page.getByRole('group', { name: 'Días' })
        await expect(dias).toBeVisible({ timeout: 20_000 })
        await expect(dias.locator('button[aria-pressed="true"]')).toHaveCount(1)
        await expect(page.locator('#subtitulo-celular')).toContainText(/cita/)
        let m = await medir(page)
        expect(m, `Agenda: ${JSON.stringify(m)}`).toEqual(limpio)

        // «Filtrar»: la búsqueda, el periodo con sus flechas, los filtros y «Limpiar» siguen disponibles, a pantalla completa.
        await page.getByRole('button', { name: /^Filtrar/ }).click()
        const filtros = page.getByRole('dialog', { name: 'Filtrar citas' })
        await expect(filtros).toBeVisible()
        for (const t of ['Buscar', 'Periodo', 'Estado', 'Origen', 'Visita']) await expect(filtros.getByText(t, { exact: true }).first()).toBeVisible()
        await expect(filtros.getByRole('button', { name: 'Esta semana' })).toBeVisible()
        await expect(filtros.getByRole('button', { name: 'Periodo siguiente' })).toBeVisible()
        const caja = await filtros.boundingBox()
        expect(Math.round(caja.width)).toBeGreaterThanOrEqual(ancho - 12) // a pantalla completa (la animación de entrada termina enseguida)
        m = await medir(page)
        expect(m, `Filtrar: ${JSON.stringify(m)}`).toEqual(limpio)
        // Elegir «Todas» deja una lista con citas (el optómetra puede no tener citas hoy) y cierra con «Listo».
        await filtros.getByRole('button', { name: 'Todas', exact: true }).first().click()
        await filtros.getByRole('button', { name: 'Listo' }).click()
        await expect(filtros).toHaveCount(0)

        // Tocar una cita abre el mismo detalle, a pantalla completa, con las acciones abajo.
        const tarjeta = page.locator('[data-cita-id]').first()
        await expect(tarjeta).toBeVisible({ timeout: 20_000 })
        await tarjeta.click()
        const detalle = page.getByRole('dialog').last()
        await expect(detalle).toContainText('Detalle de la cita')
        for (const t of ['Paciente', 'Cita', 'Seguimiento']) await expect(detalle.getByText(t, { exact: true }).first()).toBeVisible()
        await page.waitForTimeout(500) // termina la animación de entrada
        expect(Math.round((await detalle.boundingBox()).width)).toBe(ancho)
        const pie = detalle.locator('[data-ventana-pie]')
        if (await pie.count()) {
          const cuerpo = await detalle.locator('[data-ventana-cuerpo]').boundingBox()
          const abajo = await pie.boundingBox()
          expect(abajo.y).toBeGreaterThanOrEqual(cuerpo.y + cuerpo.height - 1) // las acciones van debajo del contenido
        }
        m = await medir(page)
        expect(m, `Detalle: ${JSON.stringify(m)}`).toEqual(limpio)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)

        // El «+» flotante abre la MISMA ventana «Gestionar cita», a pantalla completa y con todos sus campos.
        await page.getByRole('button', { name: 'Agendar cita', exact: true }).click()
        const gestionar = page.getByRole('dialog', { name: 'Gestionar cita' })
        await expect(gestionar).toBeVisible()
        await expect(gestionar.getByPlaceholder(/Escriba para buscar/)).toBeVisible()
        await expect(gestionar.getByRole('button', { name: 'Añadir nuevo paciente' })).toBeVisible()
        await expect(gestionar.getByRole('button', { name: 'Confirmar cita' })).toBeVisible()
        await page.waitForTimeout(500)
        expect(Math.round((await gestionar.boundingBox()).width)).toBe(ancho)
        m = await medir(page)
        expect(m, `Gestionar cita: ${JSON.stringify(m)}`).toEqual(limpio)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)
      })
    }

    if (ancho >= 768) {
      test('tablet vertical: la Semana se ve completa (siete días) y el Mes también', async ({ page }) => {
        test.setTimeout(120_000)
        await iniciarSesion(page, 'ADMIN', 'DEMO')
        await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
        for (const [vista, texto] of [['Semana', /cita.* en la semana/], ['Mes', /cita.* en el mes/]]) {
          await page.getByRole('button', { name: /^Filtrar/ }).click()
          await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: vista, exact: true }).click()
          await page.getByRole('button', { name: 'Listo' }).click()
          await expect(page.locator('#subtitulo-celular')).toContainText(texto)
          const m = await medir(page)
          expect(m.desborda, `${vista}: desplazamiento horizontal`).toBe(false)
        }
        // La Semana: los siete días caben a lo ancho de la pantalla.
        await page.getByRole('button', { name: /^Filtrar/ }).click()
        await page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: 'Semana', exact: true }).click()
        await page.getByRole('button', { name: 'Listo' }).click()
        for (const d of ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']) {
          const caja = await page.getByText(new RegExp(`^${d}$`, 'i')).first().boundingBox()
          expect(caja.x + caja.width, `${d} dentro de la pantalla`).toBeLessThanOrEqual(ancho)
        }
      })
    } else {
      test('celular: Semana y Mes se muestran como la lista del día', async ({ page }) => {
        test.setTimeout(120_000)
        await iniciarSesion(page, 'ADMIN', 'DEMO')
        await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
        await page.getByRole('button', { name: /^Filtrar/ }).click()
        await expect(page.getByRole('group', { name: 'Vista de citas' })).toHaveCount(0) // sin selector de vista: solo la lista
        await page.getByRole('button', { name: 'Listo' }).click()
        await expect(page.getByRole('group', { name: 'Días' })).toBeVisible()
      })
    }
  })
}

// La concurrencia, en la óptica de pruebas: la base rechaza a quien llega segundo (23505) y la pantalla lo dice igual en el celular, dentro de la ventana y sin perder lo escrito.
test.describe('Agenda en celular: la hora que acaba de ocuparse', () => {
  test.use({ viewport: { width: 390, height: 800 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })
  test('«Esa hora acaba de ocuparse. Elige otra.» dentro de «Gestionar cita»', async ({ page }) => {
    test.setTimeout(150_000)
    await iniciarSesion(page, 'RECEPCION', 'E2E')
    await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar cita', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Gestionar cita' })
    const nombre = nombrePrueba()
    await form.getByRole('button', { name: 'Añadir nuevo paciente' }).click()
    await form.getByPlaceholder('Nombre completo').fill(nombre)
    await form.getByPlaceholder('Cédula').fill(cedulaValida())
    await form.getByPlaceholder('Teléfono').fill(telefonoPrueba())
    await form.getByRole('button', { name: 'Registrar y seleccionar' }).click()
    await expect(form.getByPlaceholder(/Escriba para buscar/)).toHaveValue(nombre, { timeout: 15_000 })
    await form.locator('select').first().selectOption({ index: 1 })
    await seleccionarPorTexto(form.locator('#citas-asignado'), /Paula/)
    const dias = form.locator('button[title="Disponible"]')
    if (!(await dias.count())) await form.getByRole('button', { name: 'Mes siguiente' }).click()
    await dias.first().click()
    await form.locator('button:enabled').filter({ hasText: /^\d{1,2}:\d{2} (AM|PM)$/ }).first().click()
    // Alguien más reservó esa hora un instante antes: la base responde con la violación de unicidad.
    await page.route(/\/rest\/v1\/citas(\?|$)/, (route) => (route.request().method() === 'POST'
      ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ code: '23505', message: 'Esa hora acaba de ocuparse. Elige otra.', details: null, hint: null }) })
      : route.continue()))
    await form.getByRole('button', { name: 'Confirmar cita' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByText('Esa hora acaba de ocuparse. Elige otra.').first()).toBeVisible({ timeout: 15_000 })
    await expect(form).toBeVisible() // la ventana sigue abierta y el paciente elegido, intacto
    await expect(form.getByPlaceholder(/Escriba para buscar/)).toHaveValue(nombre)
  })
})

// Buscar al paciente en «Gestionar cita» con el teclado del teléfono abierto (alto de pantalla reducido): la lista se ve encima de todo,
// sus resultados se tocan con el dedo (44 px o más), y al elegir uno se completa el campo y se cierra la lista.
test.describe('Agenda en celular: elegir al paciente de la lista', () => {
  test.use({ viewport: { width: 390, height: 430 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })
  test('la lista aparece, se toca y completa el campo; la cita se crea', async ({ page }) => {
    test.setTimeout(150_000)
    const nombre = await crearPacienteConHistorial(0)
    await iniciarSesion(page, 'RECEPCION', 'E2E')
    await barra(page).getByRole('button', { name: 'Agenda', exact: true }).click()
    await page.getByRole('button', { name: 'Agendar cita', exact: true }).click()
    const form = page.getByRole('dialog', { name: 'Gestionar cita' })
    const buscador = form.getByPlaceholder(/Escriba para buscar/)
    await buscador.tap()
    await page.keyboard.type(nombre, { delay: 20 })
    const lista = form.locator('ul').first()
    const opcion = lista.getByRole('button', { name: new RegExp(nombre) })
    await expect(opcion).toBeVisible()
    // Visible de verdad: el centro de la opción es lo que se toca (no hay nada encima) y mide 44 px o más.
    const caja = await opcion.boundingBox()
    expect(caja.height).toBeGreaterThanOrEqual(43.5)
    const encima = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('li') != null, [caja.x + caja.width / 2, caja.y + caja.height / 2])
    expect(encima, 'la opción queda por encima de todo').toBe(true)
    await opcion.tap()
    await expect(buscador).toHaveValue(nombre)
    await expect(form.locator('ul')).toHaveCount(0) // la lista se cierra
    await form.locator('select').first().selectOption({ index: 1 })
    await seleccionarPorTexto(form.locator('#citas-asignado'), /Paula/)
    const dias = form.locator('button[title="Disponible"]')
    if (!(await dias.count())) await form.getByRole('button', { name: 'Mes siguiente' }).click()
    await dias.first().click()
    await form.locator('button:enabled').filter({ hasText: /^\d{1,2}:\d{2} (AM|PM)$/ }).first().click()
    await form.getByRole('button', { name: 'Confirmar cita' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar', exact: true }).click()
    await expect(page.getByText('Cita registrada y guardada correctamente.')).toBeVisible({ timeout: 15_000 })
  })
})
