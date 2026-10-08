// Barra de Citas (C9): el bloque de filtros está siempre a la vista y NADA cambia de posición entre Lista, Semana y Mes,
// con o sin filtros y con o sin texto en el buscador; además el conteo coincide con las citas que se ven en pantalla.
// SOLO LECTURA en la Óptica Demo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const redondear = (b) => (b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null)

test('el bloque de filtros no se mueve entre vistas y el conteo coincide con lo que se ve', async ({ page }) => {
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  const buscador = page.getByLabel('Buscar cita: paciente o código')
  await buscador.waitFor({ timeout: 20_000 })
  await page.waitForTimeout(1500)

  const bloque = page.getByRole('group', { name: 'Filtros de las citas' })
  const limpiar = bloque.getByRole('button', { name: /Limpiar filtros/ })
  const vista = (nombre) => page.getByRole('group', { name: 'Vista de citas' }).getByRole('button', { name: nombre }).click()
  const caja = async (loc) => redondear(await loc.first().boundingBox())
  const medir = async () => ({
    selector: await caja(page.getByRole('group', { name: 'Vista de citas' })),
    buscador: await caja(page.locator('#citas-busqueda').locator('xpath=..')),
    bloque: await caja(bloque),
    estado: await caja(bloque.getByRole('group', { name: 'Estado', exact: true })),
    origen: await caja(bloque.getByRole('group', { name: 'Origen', exact: true })),
    visita: await caja(bloque.getByRole('group', { name: 'Visita', exact: true })),
    profesional: await caja(bloque.getByRole('group', { name: 'Profesional', exact: true })),
    limpiar: await caja(limpiar),
    conteo: (await caja(page.getByRole('status').first()))?.slice(1, 2),
  })
  const numeroDelConteo = async () => Number(((await page.getByRole('status').first().innerText()).match(/\d+/) || [])[0])
  const enPantalla = async (v) => {
    if (v === 'Lista') return page.getByTitle('Ver el detalle de la cita').count()
    const chips = await page.locator('main button[title*=" · "]').count()
    if (v === 'Semana') return chips
    const mas = await page.locator('main button', { hasText: /^\+\d+ más$/ }).allInnerTexts()
    return chips + mas.reduce((n, t) => n + Number(t.match(/\d+/)[0]), 0)
  }

  const escenarios = [
    ['sin filtros', async () => {}],
    ['Estado: Atendidas', async () => { await bloque.getByRole('button', { name: 'Atendidas' }).click() }],
    ['Atendidas + Origen: Recepción', async () => { await bloque.getByRole('button', { name: 'Recepción' }).click() }],
    ['con texto en el buscador', async () => { await buscador.fill('a') }],
  ]
  const referencia = {}
  for (const v of ['Lista', 'Semana', 'Mes']) {
    await vista(v)
    if (v === 'Lista') await page.getByRole('group', { name: 'Periodo de las citas' }).getByRole('button', { name: 'Mes' }).click()
    await page.waitForTimeout(700)
    await buscador.fill('')
    if (await limpiar.isEnabled()) await limpiar.click()
    for (const [nombre, preparar] of escenarios) {
      await preparar()
      await page.waitForTimeout(700)
      // Todo el bloque visible, sin abrir nada; "Limpiar filtros" apagado solo cuando no hay filtros.
      for (const g of ['Estado', 'Origen', 'Visita', 'Profesional']) await expect(bloque.getByRole('group', { name: g, exact: true })).toBeVisible()
      if (nombre === 'sin filtros') await expect(limpiar).toBeDisabled(); else await expect(limpiar).toBeEnabled()
      const medidas = await medir()
      referencia[nombre] ??= medidas
      expect(medidas, `${v} · ${nombre}: nada debe moverse respecto a la Lista`).toEqual(referencia[nombre])
      // El conteo coincide con lo que hay en pantalla (en la Lista con búsqueda se dibujan de a 30: "Ver más").
      if (!(v === 'Lista' && nombre === 'con texto en el buscador')) {
        expect(await numeroDelConteo(), `${v} · ${nombre}: conteo = citas en pantalla`).toBe(await enPantalla(v))
      }
    }
    // La "x" del buscador borra solo el texto; "Limpiar filtros" quita los filtros y deja el texto como estuviera.
    await buscador.fill('')
    await limpiar.click()
    await expect(limpiar).toBeDisabled()
  }
  expect(errores, 'sin errores de JavaScript').toEqual([])
})

test('la x del buscador borra solo el texto y Limpiar filtros solo los filtros', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  const buscador = page.getByLabel('Buscar cita: paciente o código')
  await buscador.waitFor({ timeout: 20_000 })
  const bloque = page.getByRole('group', { name: 'Filtros de las citas' })
  await bloque.getByRole('button', { name: 'Atendidas' }).click()
  await buscador.fill('Sofía')
  await page.getByRole('button', { name: 'Borrar la búsqueda' }).click()
  await expect(buscador).toHaveValue('')
  await expect(bloque.getByRole('button', { name: 'Atendidas' })).toHaveAttribute('aria-pressed', 'true')
  await buscador.fill('Sofía')
  await bloque.getByRole('button', { name: /Limpiar filtros/ }).click()
  await expect(buscador).toHaveValue('Sofía')
  await expect(bloque.getByRole('button', { name: 'Atendidas' })).toHaveAttribute('aria-pressed', 'false')
})

test('quien no es administrador no ve "Profesional", pero el bloque conserva su forma', async ({ page }) => {
  await iniciarSesion(page, 'RECEPCION')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').waitFor({ timeout: 20_000 })
  const bloque = page.getByRole('group', { name: 'Filtros de las citas' })
  await expect(bloque.getByRole('group', { name: 'Profesional', exact: true })).toHaveCount(0)
  for (const g of ['Estado', 'Origen', 'Visita']) await expect(bloque.getByRole('group', { name: g, exact: true })).toBeVisible()
  await expect(bloque.getByRole('button', { name: /Limpiar filtros/ })).toBeDisabled()
  const b = await bloque.boundingBox()
  expect(Math.round(b.height), 'misma altura de bloque que el administrador').toBe(76)
})
