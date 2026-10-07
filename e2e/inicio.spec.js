// Inicio rediseñado (R52 a R56): una línea de resumen, Totales, Desenlace con período, un solo bloque
// "Requiere tu atención", Hoy sin citas pasadas y registro de actividad compacto.
// Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/inicio-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion } from './ayudas.js'

const CARPETA = 'docs/inicio-capturas'
// El Inicio se desplaza dentro de un contenedor propio: se captura el tope y, si hay más, cada tramo siguiente (1366x768).
async function capturar(page, nombre) {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync(CARPETA, { recursive: true })
  const mover = (y) => page.evaluate((top) => {
    const el = [...document.querySelectorAll('*')]
      .filter((e) => e.scrollHeight > e.clientHeight + 20 && ['auto', 'scroll'].includes(getComputedStyle(e).overflowY) && !e.className.toString().includes('sidebar'))
      .sort((a, b) => b.scrollHeight - a.scrollHeight)[0]
    if (el) el.scrollTop = top
    return el ? [el.scrollHeight, el.clientHeight] : [0, 0]
  }, y)
  const [alto, visible] = await mover(0)
  const tramos = Math.max(1, Math.ceil((alto - 80) / (visible - 80)))
  for (let i = 0; i < tramos; i++) {
    await mover(i * (visible - 80))
    await page.waitForTimeout(250)
    await page.screenshot({ path: `${CARPETA}/${nombre}-${i + 1}.png` })
  }
  await mover(0)
}
const main = (page) => page.locator('main').first()

test.describe('Inicio del administrador', () => {
  test('estructura nueva, sin saludo ni bloques sueltos', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    await expect(page.getByRole('region', { name: 'Resumen del día' }).or(page.getByLabel('Resumen del día'))).toBeVisible({ timeout: 20_000 })
    const cuerpo = main(page)
    // Lo que se quitó
    await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
    await expect(cuerpo.getByText('Módulo clínico activo')).toHaveCount(0)
    await expect(cuerpo.getByText('Reabastecimiento', { exact: true })).toHaveCount(0)
    await expect(cuerpo.getByText('Últimas citas / Agenda cercana')).toHaveCount(0)
    // Lo que debe estar, en orden
    const titulos = await cuerpo.locator('h2').allInnerTexts()
    const esperado = ['TOTALES', 'DESENLACE DE LAS CITAS · ESTE MES', 'REQUIERE TU ATENCIÓN', 'HOY']
    // R52: "Pacientes sin atender" es un total, vive en Totales y no en el desenlace (que es de un período).
    await expect(cuerpo.getByRole('region', { name: 'Totales' }).getByText('Pacientes sin atender')).toBeVisible()
    await expect(cuerpo.getByRole('region', { name: /Desenlace de las citas/ }).getByText('Pacientes sin atender')).toHaveCount(0)
    const pos = esperado.map((t) => titulos.findIndex((x) => x.toUpperCase() === t))
    expect.soft(pos.every((p) => p >= 0), `faltan secciones: ${JSON.stringify(titulos)}`).toBe(true)
    expect.soft([...pos].sort((a, b) => a - b), 'orden de las secciones').toEqual(pos)
    await capturar(page, 'admin-demo')
  })

  test('el desenlace indica su período y lo cambia', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const cuerpo = main(page)
    await expect(cuerpo.getByRole('heading', { name: /Desenlace de las citas · este mes/i })).toBeVisible({ timeout: 20_000 })
    await cuerpo.getByRole('button', { name: 'Desde siempre' }).click()
    await expect(cuerpo.getByRole('heading', { name: /Desenlace de las citas · desde siempre/i })).toBeVisible()
    await expect(cuerpo.getByRole('button', { name: 'Desde siempre' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('cada tarjeta del desenlace abre Citas con ese filtro', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const cuerpo = main(page)
    await cuerpo.getByRole('button', { name: 'Desde siempre' }).click()
    await cuerpo.getByRole('button', { name: /^Atendidas:/ }).click()
    await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Estado: Atendidas')).toBeVisible()
  })

  test('"Requiere tu atención" reúne todo con el stock bajo una sola vez', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const bloque = page.getByRole('region', { name: 'Requiere tu atención' })
    await expect(bloque).toBeVisible({ timeout: 20_000 })
    await expect(bloque.getByText(/productos? con stock bajo/)).toHaveCount(1)
    await expect(main(page).getByText(/productos? con stock bajo/)).toHaveCount(1)
    for (const fila of await bloque.locator('li').all()) {
      expect.soft(await fila.getByRole('button').count(), 'cada fila lleva su botón de acción').toBeGreaterThan(0)
    }
  })

  test('"Hoy" no mezcla citas pasadas', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN')
    const hoy = page.getByRole('region', { name: 'Hoy' })
    await expect(hoy).toBeVisible({ timeout: 20_000 })
    await expect(hoy.getByText(/Anteriores|Últimas citas/)).toHaveCount(0)
  })
})

test('Inicio de Paula (optómetra): un solo bloque Requiere tu atención', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  const cuerpo = main(page)
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
  await expect(cuerpo.getByText(/stock bajo/)).toHaveCount(0)
  await expect(cuerpo.getByText('Tu agenda del día')).toBeVisible()
  await capturar(page, 'paula-optometra')
})

test('Inicio de Recepción y de Ventas con su bloque único', async ({ page }) => {
  await iniciarSesion(page, 'RECEPCION')
  await expect(main(page).getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(main(page).getByText(/stock bajo/)).toHaveCount(0)
  await capturar(page, 'recepcion')
})

test('Inicio de Ventas', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS')
  const cuerpo = main(page)
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/productos? con stock bajo/)).toHaveCount(1)
  await expect(cuerpo.getByText(/órdenes? atrasadas?/).first()).toBeVisible()
  await capturar(page, 'ventas')
})

// El mismo dato debe dar el mismo número en todos los roles (salvo el alcance "propio") y nunca calcularse con datos a medias.
async function controlesVencidos(page, cuenta) {
  await iniciarSesion(page, cuenta)
  const fila = page.getByRole('region', { name: 'Requiere tu atención' }).getByText(/con el control vencido/)
  await expect(fila).toBeVisible({ timeout: 20_000 })
  return Number((await fila.innerText()).match(/^(\d+)/)[1])
}
test('los controles vencidos dan el mismo número en el administrador, Recepción y Paula', async ({ browser }) => {
  const numeros = {}
  for (const cuenta of ['ADMIN', 'RECEPCION', 'OPTOMETRA']) {
    const contexto = await browser.newContext()
    numeros[cuenta] = await controlesVencidos(await contexto.newPage(), cuenta)
    await contexto.close()
  }
  expect(new Set(Object.values(numeros)).size, JSON.stringify(numeros)).toBe(1)
})

test('"Pacientes sin atender" coincide con "Sin consulta" de Pacientes (no se calcula con las consultas sin cargar)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  const tarjeta = main(page).getByRole('button', { name: /^Pacientes sin atender:/ })
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  const enInicio = Number((await tarjeta.getAttribute('aria-label')).match(/: (\d+)\./)[1])
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  const sinConsulta = page.getByRole('button', { name: /Sin consulta/ }).first()
  await expect(sinConsulta).toBeVisible({ timeout: 15_000 })
  expect(Number((await sinConsulta.innerText()).replace(/\D/g, ''))).toBe(enInicio)
})

test('el contador del menú de Ventas solo lo ve quien puede vender', async ({ browser }) => {
  const veContador = async (cuenta) => {
    const contexto = await browser.newContext()
    const page = await contexto.newPage()
    await iniciarSesion(page, cuenta)
    // Con el Inicio ya hidratado (el bloque "Requiere tu atención" visible) el contador ya tiene sus datos.
    await expect(page.getByRole('region', { name: 'Requiere tu atención' })).toBeVisible({ timeout: 20_000 })
    const texto = await page.getByRole('button', { name: 'Ventas', exact: true }).first().innerText()
    await contexto.close()
    return /\d/.test(texto)
  }
  expect(await veContador('OPTOMETRA'), 'Paula (ventas: solo ver) no debe verlo').toBe(false)
  expect(await veContador('VENTAS'), 'Ventas sí').toBe(true)
  expect(await veContador('RECEPCION'), 'Recepción (ventas: crear) sí').toBe(true)
})

test('Paula: "Siguiente paciente" tiene "Atender" y abre el mismo flujo de Citas', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  const tarjeta = main(page).getByRole('region', { name: 'Hoy' })
  await expect(tarjeta.getByText('Siguiente paciente')).toBeVisible({ timeout: 20_000 })
  await tarjeta.getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
  const resumen = page.getByRole('dialog')
  await expect(resumen.getByText('Resumen de la cita')).toBeVisible()
  await expect(resumen.getByRole('button', { name: /Ingresar a la ficha clínica|Atender hoy/ })).toBeVisible()
  await resumen.getByRole('button', { name: 'Cerrar' }).click()
})
