// Inicio del administrador y del optómetra (reunión del 7 oct., I1 a I18): Totales con el mes, "Requiere tu atención" en un bloque por área,
// desenlace de las citas (Hoy · Esta semana · Este mes · Todas) conectado a la lista de citas, y registro de actividad compacto.
// Corre contra la óptica de pruebas y crea sus propios datos (stock bajo, control vencido, orden atrasada, citas de Paula);
// con E2E_ENTORNO=DEMO corre en solo lectura contra la Demo, sin crear nada.
// Con E2E_CAPTURAS=1 guarda capturas a 1366x768 en docs/inicio-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, prepararAvisosInicio, crearCitaDeHoyParaPaula } from './ayudas.js'

const CARPETA = process.env.E2E_CAPTURAS_DIR || 'docs/inicio-capturas'
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
const ENTORNO = process.env.E2E_ENTORNO || 'E2E'
test.beforeAll(async () => { if (ENTORNO === 'E2E') await prepararAvisosInicio('E2E') })
const entrar = (page, cuenta) => iniciarSesion(page, cuenta, ENTORNO)
const atencion = (page) => page.getByRole('region', { name: 'Requiere tu atención', exact: true })

test.describe('Inicio del administrador', () => {
  test('estructura nueva: Totales, Requiere tu atención por área, desenlace y citas, sin línea de resumen', async ({ page }) => {
    await entrar(page, 'ADMIN')
    await expect(main(page).getByRole('region', { name: 'Totales' })).toBeVisible({ timeout: 20_000 })
    const cuerpo = main(page)
    // Lo que se quitó
    await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
    await expect(cuerpo.getByLabel('Resumen del día')).toHaveCount(0)
    await expect(cuerpo.getByText(/pendientes? que requieren? tu atención/)).toHaveCount(0)
    await expect(cuerpo.getByRole('region', { name: 'Totales' }).getByText('Pacientes sin atender')).toHaveCount(0)
    // Lo que debe estar, en orden (I: Totales, Requiere tu atención, Desenlace, Citas del día)
    const titulos = await cuerpo.locator('h2').allInnerTexts()
    const esperado = ['TOTALES', 'REQUIERE TU ATENCIÓN', 'DESENLACE DE LAS CITAS · HOY', 'CITAS DEL DÍA']
    const pos = esperado.map((t) => titulos.findIndex((x) => x.toUpperCase() === t))
    expect.soft(pos.every((p) => p >= 0), `faltan secciones: ${JSON.stringify(titulos)}`).toBe(true)
    expect.soft([...pos].sort((a, b) => a - b), 'orden de las secciones').toEqual(pos)
    // Los tres totales llevan el mes
    const totales = cuerpo.getByRole('region', { name: 'Totales' })
    await expect(totales.getByText(/^\+\d+ este mes$/)).toHaveCount(3)
    // Un bloque por área (según permisos; el administrador ve los cuatro)
    for (const area of ['Citas', 'Pacientes', 'Ventas', 'Inventario']) await expect(cuerpo.getByRole('region', { name: `Requiere tu atención: ${area}` })).toBeVisible()
    await capturar(page, 'admin-demo')
  })

  test('el desenlace indica su período (Hoy por defecto) y lo cambia', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const cuerpo = main(page)
    await expect(cuerpo.getByRole('heading', { name: /Desenlace de las citas · hoy/i })).toBeVisible({ timeout: 20_000 })
    await expect(cuerpo.getByRole('button', { name: 'Hoy', exact: true })).toHaveAttribute('aria-pressed', 'true')
    for (const [boton, titulo, lista] of [['Esta semana', /· esta semana/i, /Citas de la semana/i], ['Este mes', /· este mes/i, /Citas del mes/i], ['Todas', /· todas/i, /Todas las citas/i]]) {
      await cuerpo.getByRole('button', { name: boton, exact: true }).click()
      await expect(cuerpo.getByRole('heading', { name: titulo })).toBeVisible()
      await expect(cuerpo.getByRole('heading', { name: lista })).toBeVisible() // la lista sigue el mismo período
      await expect(cuerpo.getByRole('button', { name: boton, exact: true })).toHaveAttribute('aria-pressed', 'true')
    }
  })

  test('la tarjeta del desenlace filtra la lista y "Ver todas en Citas" abre Citas con ese filtro', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const cuerpo = main(page)
    await cuerpo.getByRole('button', { name: 'Todas', exact: true }).click()
    const tarjeta = cuerpo.getByRole('button', { name: /^Atendidas:/ })
    await tarjeta.click()
    await expect(tarjeta).toHaveAttribute('aria-pressed', 'true')
    await expect(cuerpo.getByRole('heading', { name: /Todas las citas · Atendidas/i })).toBeVisible()
    // Solo citas atendidas en la lista
    const lista = cuerpo.getByRole('region', { name: 'Todas las citas' })
    for (const estado of ['Pendiente', 'En Espera', 'No Asistió', 'Cancelada']) await expect(lista.getByText(estado, { exact: true })).toHaveCount(0)
    await lista.getByRole('button', { name: 'Ver todas en Citas' }).click()
    await expect(page.getByRole('heading', { name: 'Citas médicas' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Estado: Atendidas')).toBeVisible()
  })

  test('las tarjetas del desenlace se llaman Atendidas, No asistieron y Canceladas', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const cuerpo = main(page)
    await expect(cuerpo.getByRole('button', { name: /^No asistieron:/ })).toBeVisible({ timeout: 20_000 })
    await expect(cuerpo.getByRole('button', { name: /^Canceladas:/ })).toBeVisible()
    await expect(cuerpo.getByText('No atendidas')).toHaveCount(0)
  })

  test('"Requiere tu atención" se separa por área, con tres avisos como máximo y "Ver todo (N)"; el stock bajo sale una sola vez', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const bloque = atencion(page)
    await expect(bloque).toBeVisible({ timeout: 20_000 })
    await expect(main(page).getByText(/productos? con stock bajo/)).toHaveCount(1)
    for (const area of ['Citas', 'Pacientes', 'Ventas', 'Inventario']) {
      const sub = bloque.getByRole('region', { name: `Requiere tu atención: ${area}` })
      await expect(sub).toBeVisible()
      expect.soft(await sub.getByRole('listitem').count(), `${area}: como máximo tres avisos`).toBeLessThanOrEqual(3)
      for (const fila of await sub.getByRole('listitem').all()) expect.soft(await fila.getByRole('button').count(), 'cada fila lleva su botón de acción').toBeGreaterThan(0)
      if (await sub.getByRole('listitem').count()) await expect(sub.getByRole('button', { name: /^Ver todo \(\d+\)/ })).toBeVisible()
    }
  })

  test('"Ver todo" de Inventario abre la lista ya acotada al stock bajo', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const sub = atencion(page).getByRole('region', { name: 'Requiere tu atención: Inventario' })
    await expect(sub).toBeVisible({ timeout: 20_000 })
    const verTodo = sub.getByRole('button', { name: /^Ver todo/ })
    test.skip(await verTodo.count() === 0, 'Esta óptica no tiene productos con stock bajo')
    await verTodo.click()
    // Inventario abre con el filtro "Stock bajo" ya activo (la píldora queda en naranja)
    await expect(page.getByRole('button', { name: /^Stock bajo/ })).toHaveCSS('background-color', 'rgb(217, 119, 6)', { timeout: 15_000 })
  })

  test('"Citas del día" muestra solo las de hoy', async ({ page }) => {
    await entrar(page, 'ADMIN')
    const lista = main(page).getByRole('region', { name: 'Citas del día' })
    await expect(lista).toBeVisible({ timeout: 20_000 })
    await expect(lista.getByText(/Anteriores|Últimas citas/)).toHaveCount(0)
  })

  test("los atajos abren su formulario encima del Inicio, sin cambiar de módulo", async ({ page }) => {
    await entrar(page, 'ADMIN')
    const atajos = page.getByRole("group", { name: "Atajos" })
    await expect(atajos).toBeVisible({ timeout: 20_000 })
    for (const [boton, dialogo] of [["Registrar paciente", "Crear paciente"], ["Agendar cita", "Gestionar cita"], ["Añadir producto", "Ingresar montura o accesorio"]]) {
      await atajos.getByRole("button", { name: boton }).click()
      await expect(page.getByRole("heading", { name: dialogo })).toBeVisible({ timeout: 10_000 })
      // Sigue en Inicio: los totales y los atajos siguen en la página
      await expect(page.getByRole("region", { name: "Totales" })).toBeAttached()
      await page.getByRole("button", { name: "Cancelar" }).last().click()
      await expect(page.getByRole("heading", { name: dialogo })).toHaveCount(0)
      await expect(atajos).toBeVisible()
    }
  })
})

test('Inicio de Paula (optómetra): atajos, Requiere tu atención por área, desenlace de sus citas y su agenda con el siguiente paciente', async ({ page }) => {
  await entrar(page, 'OPTOMETRA')
  const cuerpo = main(page)
  await expect(atencion(page)).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/¡Bienvenido/)).toHaveCount(0)
  await expect(cuerpo.getByLabel('Resumen del día')).toHaveCount(0)
  await expect(cuerpo.getByRole('region', { name: 'Totales' })).toHaveCount(0) // el optómetra no lleva Totales
  await expect(cuerpo.getByRole('group', { name: 'Atajos' }).getByRole('button', { name: 'Registrar paciente' })).toBeVisible()
  await expect(cuerpo.getByRole('group', { name: 'Atajos' }).getByRole('button', { name: 'Agendar cita' })).toBeVisible()
  await expect(cuerpo.getByRole('heading', { name: /Desenlace de mis citas · hoy/i })).toBeVisible()
  const agenda = cuerpo.getByRole('region', { name: 'Mi agenda de hoy' })
  await expect(agenda).toBeVisible()
  await expect(agenda.getByLabel('Siguiente paciente')).toBeVisible() // destacado arriba de la agenda
  // "Atender" es de quien atiende; Ventas no es un bloque suyo.
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención: Ventas' })).toHaveCount(0)
  // Con inventario: ver, el aviso de stock bajo está en su bloque, con un botón para ver el inventario (solo lectura).
  const inventario = atencion(page).getByRole('region', { name: 'Requiere tu atención: Inventario' })
  if (await inventario.getByRole('listitem').count()) {
    await expect(inventario.getByText(/productos? con stock bajo/)).toHaveCount(1)
    await expect(inventario.getByRole('button', { name: 'Reabastecer' })).toHaveCount(0)
  }
  await capturar(page, 'paula-optometra')
})

test('Inicio de Paula con un paciente en espera: el siguiente paciente es quien ya llegó y el título de la agenda lo cuenta', async ({ page }) => {
  test.skip(ENTORNO !== 'E2E', 'Crea citas: solo en la óptica de pruebas')
  const pendiente = await crearCitaDeHoyParaPaula('E2E') // todavía no llega
  const enEspera = await crearCitaDeHoyParaPaula('E2E', { estado: 'En Espera' }) // ya llegó, aunque su hora sea posterior
  await entrar(page, 'OPTOMETRA')
  const agenda = main(page).getByRole('region', { name: 'Mi agenda de hoy' })
  await expect(agenda).toBeVisible({ timeout: 20_000 })
  await expect(agenda.getByLabel('Siguiente paciente')).toContainText(enEspera)
  await expect(agenda.getByLabel('Siguiente paciente')).not.toContainText(pendiente)
  await expect(agenda.getByLabel('Siguiente paciente')).toContainText('ya llegó')
  await expect(main(page).getByRole('heading', { name: /^Mi agenda de hoy · [0-9]+ en espera$/i })).toBeVisible()
  await expect(agenda.getByRole('button', { name: 'Atender', exact: true }).first()).toBeVisible()
  await capturar(page, 'paula-en-espera')
})

test('Inicio de Recepción y de Ventas con su bloque único', async ({ page }) => {
  await entrar(page, 'RECEPCION')
  await expect(main(page).getByRole('region', { name: 'Requiere tu atención', exact: true })).toBeVisible({ timeout: 20_000 })
  // Recepción también puede ver el inventario: el aviso de stock bajo aparece una vez, sin "Reabastecer" (no edita).
  await expect(main(page).getByText(/productos? con stock bajo/)).toHaveCount(1)
  await expect(main(page).getByRole('button', { name: 'Reabastecer' })).toHaveCount(0)
  await capturar(page, 'recepcion')
})

test('Inicio de Ventas', async ({ page }) => {
  await entrar(page, 'VENTAS')
  const cuerpo = main(page)
  await expect(cuerpo.getByRole('region', { name: 'Requiere tu atención', exact: true })).toBeVisible({ timeout: 20_000 })
  await expect(cuerpo.getByText(/productos? con stock bajo/)).toHaveCount(1)
  await expect(cuerpo.getByText(/[oó]rdenes? atrasadas?/).first()).toBeVisible()
  await capturar(page, 'ventas')
})

// El mismo dato debe dar el mismo número en todos los roles (salvo el alcance "propio") y nunca calcularse con datos a medias.
async function controlesVencidos(page, cuenta) {
  await entrar(page, cuenta)
  const fila = page.getByRole('region', { name: 'Requiere tu atención', exact: true }).getByText(/con el control vencido/)
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

test('"N pacientes registrados sin ninguna consulta" coincide con "Sin consulta" de Pacientes (no se calcula con las consultas sin cargar)', async ({ page }) => {
  await entrar(page, 'ADMIN')
  const bloque = atencion(page).getByRole('region', { name: 'Requiere tu atención: Pacientes' })
  await expect(bloque).toBeVisible({ timeout: 20_000 })
  const aviso = bloque.getByText(/pacientes? registrados? sin ninguna consulta/)
  // El bloque muestra solo los tres avisos más importantes: si este no entró, no hay nada que comparar (lo cubren las pruebas unitarias).
  test.skip((await aviso.count()) === 0, 'El aviso no está entre los tres primeros del bloque Pacientes')
  const enInicio = Number((await aviso.first().innerText()).match(/^([0-9]+)/)[1])
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  const sinConsulta = page.getByRole('button', { name: /Sin consulta/ }).first()
  await expect(sinConsulta).toBeVisible({ timeout: 15_000 })
  expect(Number((await sinConsulta.innerText()).replace(/\D/g, ''))).toBe(enInicio)
})

test('el contador del menú de Ventas solo lo ve quien puede vender', async ({ browser }) => {
  const veContador = async (cuenta) => {
    const contexto = await browser.newContext()
    const page = await contexto.newPage()
    await entrar(page, cuenta)
    // Con el Inicio ya hidratado (el bloque "Requiere tu atención" visible) el contador ya tiene sus datos.
    await expect(page.getByRole('region', { name: 'Requiere tu atención', exact: true })).toBeVisible({ timeout: 20_000 })
    const texto = await page.getByRole('button', { name: 'Ventas', exact: true }).first().innerText()
    await contexto.close()
    return /\d/.test(texto)
  }
  expect(await veContador('OPTOMETRA'), 'Paula (ventas: solo ver) no debe verlo').toBe(false)
  expect(await veContador('VENTAS'), 'Ventas sí').toBe(true)
  expect(await veContador('RECEPCION'), 'Recepción (ventas: crear) sí').toBe(true)
})

// "Siguiente paciente" de Paula necesita una cita suya de hoy: esa prueba vive en e2e/flujo-completo.spec.js (óptica de pruebas).
