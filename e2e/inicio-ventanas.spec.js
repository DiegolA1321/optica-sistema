// Ventanas estándar del Inicio y de los módulos (reglas 42 y 43), sobre la Demo: SOLO LECTURA (solo se abren, se filtran y se cierran).
//  - Totales: cada tarjeta abre una ventana con "Todos" y "Nuevos este mes"; cada opción lleva al módulo con el MISMO número.
//  - Registro de actividad: ventana estándar con buscador; al cerrarla se queda en el Inicio.
//  - "Requieren atención" de cada módulo: el mismo número que la tarjeta del Inicio, en la misma ventana.
//  - Citas: "Todas" está siempre en su sitio.
//  - Las ventanas desvanecen también la barra lateral.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
const main = (page) => page.locator('main').first()
const estado = (page) => page.getByRole('status').first()
const alInicio = async (page) => {
  await page.getByRole('button', { name: 'Inicio', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /Requiere tu atención/i }).first()).toBeVisible({ timeout: 20_000 })
}
const abrirTotal = async (page, tarjeta) => {
  await alInicio(page)
  await page.getByRole('button', { name: new RegExp(`^${tarjeta}:`) }).click()
  return page.getByRole('dialog', { name: tarjeta })
}
// "Abrir en Pacientes · Nuevos este mes (5)" → { etiqueta, n }
const opciones = async (ventana) => (await ventana.getByRole('button', { name: /^Abrir en / }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))).map((t) => ({ nombre: t, n: Number(t.match(/\((\d+)\)$/)[1]) }))

test('Totales: cada opción de cada tarjeta lleva al módulo con el mismo número que la ventana', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  for (const tarjeta of ['Pacientes', 'Citas', 'Ventas', 'Productos']) {
    const ventana = await abrirTotal(page, tarjeta)
    const lista = await opciones(ventana)
    expect(lista).toHaveLength(2)
    await page.keyboard.press('Escape')
    for (const { nombre, n } of lista) {
      const ventana2 = await abrirTotal(page, tarjeta)
      await ventana2.getByRole('button', { name: nombre, exact: true }).click()
      const mes = /este mes/.test(nombre)
      if (tarjeta === 'Pacientes') {
        await expect(main(page)).toContainText(mes ? new RegExp(`(Mostrando )?${n} (de \\d+ )?pacientes?`) : new RegExp(`^[\\s\\S]*${n} pacientes`), { timeout: 15_000 })
        if (mes && n > 0) await expect(estado(page)).toHaveText(new RegExp(`^(Mostrando ${n} de \\d+ pacientes|${n} pacientes?)$`))
      } else if (tarjeta === 'Citas') {
        await expect(estado(page)).toHaveText(new RegExp(`^${n} citas?$`), { timeout: 15_000 })
        if (mes) await expect(page.getByRole('button', { name: /Quitar el filtro Agendadas: este mes/ })).toBeVisible()
        else await expect(page.getByRole('button', { name: 'Todas', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')
      } else if (tarjeta === 'Ventas') {
        await expect(page.getByRole('tab', { name: /Comprobantes de venta/ })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 })
        await expect(main(page)).toContainText(n === 0 ? 'Ninguna venta coincide' : new RegExp(`Mostrando ${Math.min(n, 25)} de ${n}\\.`), { timeout: 15_000 })
      } else {
        if (mes) await expect(page.getByRole('button', { name: /^Nuevos este mes/ })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
        else await expect(main(page)).toContainText(new RegExp(`${n}\\s*Productos`), { timeout: 15_000 })
        if (mes && n > 0) await expect(main(page)).toContainText(new RegExp(`Mostrando \\d+ de ${n}`))
      }
    }
  }
})

test('Registro de actividad: ventana estándar con buscador y filtros; al cerrarla se queda en el Inicio', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await alInicio(page)
  await page.getByRole('button', { name: 'Abrir el registro de actividad' }).click()
  const ventana = page.getByRole('dialog', { name: 'Registro de actividad' })
  await expect(ventana.getByRole('list', { name: 'Actividad' })).toBeVisible({ timeout: 15_000 })
  const total = await ventana.getByRole('listitem').count()
  expect(total).toBeGreaterThan(0)
  await ventana.getByLabel('Buscar en la actividad').fill('zzzz-no-existe')
  await expect(ventana.getByText('Ninguna acción coincide con la búsqueda.')).toBeVisible()
  await ventana.getByRole('button', { name: 'Quitar los filtros' }).click()
  await expect(ventana.getByRole('listitem')).toHaveCount(total)
  await expect(ventana.getByLabel('Filtrar actividad por usuario')).toBeVisible()
  await expect(ventana.getByLabel('Filtrar actividad por módulo')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(ventana).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /Requiere tu atención/i }).first()).toBeVisible() // sigue en el Inicio
})

test('"Requieren atención" de cada módulo muestra el mismo número que su tarjeta del Inicio, en la misma ventana', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await alInicio(page)
  const numeros = {}
  for (const area of ['Citas', 'Pacientes', 'Ventas', 'Inventario']) {
    const tarjeta = page.getByRole('region', { name: `Requiere tu atención: ${area}` })
    numeros[area] = Number((await tarjeta.getByText(/^\d+$/).first().innerText().catch(() => '0')) || 0)
  }
  const menu = { Citas: 'Citas médicas', Pacientes: 'Pacientes', Ventas: 'Ventas', Inventario: 'Inventario' }
  for (const [area, n] of Object.entries(numeros)) {
    await page.getByRole('button', { name: menu[area], exact: true }).first().click()
    if (n === 0) { await expect(main(page).getByText('Todo en orden').first()).toBeVisible({ timeout: 15_000 }); continue }
    const boton = page.getByRole('button', { name: `Requieren atención: ${n}` })
    await expect(boton).toBeVisible({ timeout: 15_000 })
    await boton.click()
    await expect(page.getByRole('dialog', { name: new RegExp(`^${area} · ${n} avisos?$`) })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(boton).toBeVisible() // al cerrarla se queda en el módulo
  }
})

test('Citas: "Todas" está siempre en el selector, en su sitio', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  const grupo = page.getByRole('group', { name: 'Periodo de las citas' })
  await expect(grupo).toBeVisible({ timeout: 15_000 })
  let primera = null
  for (const periodo of ['Hoy', 'Esta semana', 'Este mes', 'Todas']) {
    await grupo.getByRole('button', { name: periodo, exact: true }).click()
    await expect(grupo.getByRole('button', { name: periodo, exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(grupo.getByRole('button')).toHaveText(['Hoy', 'Esta semana', 'Este mes', 'Todas']) // siempre las mismas cuatro, en el mismo orden
    await page.waitForTimeout(400)
    const caja = await grupo.boundingBox()
    primera = primera || caja
    expect(Math.abs(caja.x - primera.x), `${periodo}: el selector no se mueve`).toBeLessThan(1)
    expect(Math.abs(caja.y - primera.y), `${periodo}: el selector no salta`).toBeLessThan(1)
    await expect(page.getByRole('button', { name: 'Periodo siguiente' })).toBeVisible() // las flechas y la fecha siguen en su sitio (apagadas con "Todas")
  }
})

test('las ventanas del Inicio desvanecen también la barra lateral', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await alInicio(page)
  await page.getByRole('button', { name: /^Abrir los avisos de Citas$/ }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // sobre la barra lateral lo que se toca es la capa que desvanece (backdrop-blur), no la barra
  const capa = await page.evaluate(() => document.elementFromPoint(40, 300)?.className || '')
  expect(capa).toContain('backdrop-blur')
  await page.keyboard.press('Escape')
})

test('la cabecera de Citas, Pacientes, Ventas e Inventario pone "Requieren atención" y la acción principal en la misma posición', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  const principal = { 'Citas médicas': 'Gestionar cita', Pacientes: 'Crear paciente', Ventas: 'Nueva venta', Inventario: 'Agregar producto' }
  const cajas = []
  for (const [menu, accion] of Object.entries(principal)) {
    await page.getByRole('button', { name: menu, exact: true }).first().click()
    const avisos = page.getByRole('button', { name: /^Requieren atención/ })
    const primaria = page.getByRole('button', { name: accion })
    await expect(avisos).toBeVisible({ timeout: 15_000 })
    await page.waitForTimeout(700) // cada módulo entra con una animación corta: se mide ya asentado
    const a = await avisos.boundingBox()
    const p = await primaria.boundingBox()
    expect(Math.abs(a.y - p.y), `${menu}: en la misma fila`).toBeLessThan(3)
    expect(Math.abs(a.height - p.height), `${menu}: misma altura`).toBeLessThan(3)
    expect(a.x + a.width, `${menu}: el aviso va a la izquierda de la acción`).toBeLessThan(p.x)
    cajas.push({ menu, derecha: p.x + p.width, arriba: p.y })
  }
  for (const c of cajas) {
    expect(Math.abs(c.derecha - cajas[0].derecha), `${c.menu}: mismo borde derecho`).toBeLessThan(3)
    expect(Math.abs(c.arriba - cajas[0].arriba), `${c.menu}: misma altura en la página`).toBeLessThan(3)
  }
})

test('Inventario dice el stock bajo una sola vez: la tarjeta es el filtro (sin aviso amarillo ni píldora aparte)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await page.getByRole('button', { name: 'Inventario', exact: true }).first().click()
  const tarjeta = page.getByRole('button', { name: /^Stock bajo:/ })
  await expect(tarjeta).toBeVisible({ timeout: 15_000 })
  await expect(main(page).getByText(/por agotarse/)).toHaveCount(0)
  await expect(main(page).getByText(/^Stock bajo/)).toHaveCount(1)
  await tarjeta.click()
  await expect(tarjeta).toHaveAttribute('aria-pressed', 'true')
  await tarjeta.click()
  await expect(tarjeta).toHaveAttribute('aria-pressed', 'false')
})

test('el estado se escribe "No asistió" también en el Inicio del optómetra y las tarjetas sin casos dicen "Ver todo"', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  await alInicio(page)
  await expect(main(page).getByText(/No Asistió|En Espera|En Atención/)).toHaveCount(0)
  await expect(main(page).getByRole('button', { name: /^Abrir (Citas|Pacientes|Ventas|Inventario)$/ })).toHaveCount(0)
})
