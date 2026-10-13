// Reportes (rama reportes-v2), sobre la Demo: SOLO LECTURA (solo se abren y se cierran listas; la única descarga es el inventario, que no se registra).
//  - A 1366×768 ninguna pestaña, tabla ni ventana de detalle tiene desplazamiento horizontal.
//  - El número que se pulsa es el mismo que muestra la ventana, y la lista tiene tantas filas como dice.
//  - Los filtros están en el mismo lugar en todas las pestañas.
//  - La ventana: títulos fijos, pie siempre visible, nombres en una línea, montos a la derecha.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const PESTANAS = ['Resumen', 'Citas', 'Clínico', 'Ventas', 'Laboratorios']
const MAXIMO_POR_PESTANA = 45

async function irAReportes(page, rol = 'ADMIN') {
  await iniciarSesion(page, rol)
  await page.getByRole('button', { name: 'Reportes', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Reportes', exact: true })).toBeVisible({ timeout: 25_000 })
  await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 25_000 })
  // La Demo tiene consultas este mes: mientras los datos llegan por partes las tarjetas dicen 0.
  if (rol === 'ADMIN') await expect(page.getByRole('button', { name: /^Consultas realizadas: [1-9]/ })).toBeVisible({ timeout: 25_000 })
}
const filtros = (page) => page.getByRole('group', { name: 'Filtros', exact: true })
const abrirPestana = async (page, nombre) => {
  await page.getByRole('tab', { name: nombre, exact: true }).click()
  await expect(page.getByRole('tab', { name: nombre, exact: true })).toHaveAttribute('aria-selected', 'true')
}

// Todo lo que podría desbordarse horizontalmente: la página, el panel y cada tabla (con las celdas recortadas con "…" no cuentan).
const desbordes = (page) => page.evaluate(() => {
  const mal = []
  const ver = (el, nombre) => { if (el && el.scrollWidth > el.clientWidth + 1) mal.push(`${nombre}: ${el.scrollWidth} > ${el.clientWidth}`) }
  ver(document.documentElement, 'página')
  ver(document.querySelector('[role=tabpanel]'), 'panel')
  document.querySelectorAll('[role=tabpanel] table').forEach((t, i) => { ver(t, `tabla ${i + 1}`); ver(t.parentElement, `contenedor de la tabla ${i + 1}`) })
  document.querySelectorAll('[role=tabpanel] [data-lista]').forEach((b) => { if (b.getBoundingClientRect().right > window.innerWidth) mal.push(`botón fuera de la pantalla: ${b.getAttribute('aria-label')}`) })
  return mal
})

// Lo mismo dentro de la ventana de detalle abierta, más lo que pide el módulo: pie visible, títulos fijos, nombres en una línea.
const revisarVentana = async (page, nombre) => {
  const ventana = page.getByRole('dialog')
  await expect(ventana).toBeVisible()
  const r = await page.evaluate(() => {
    const d = document.querySelector('[role=dialog]')
    const mal = []
    const ver = (el, n) => { if (el && el.scrollWidth > el.clientWidth + 1) mal.push(`${n}: ${el.scrollWidth} > ${el.clientWidth}`) }
    ver(d, 'ventana')
    d.querySelectorAll('div').forEach((el) => { const o = getComputedStyle(el).overflowY; if (o === 'auto' || o === 'scroll') ver(el, 'cuerpo con desplazamiento') })
    const tabla = d.querySelector('[data-detalle-tabla]')
    ver(tabla, 'tabla')
    const cerrar = [...d.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Cerrar')
    const caja = cerrar?.getBoundingClientRect()
    const dentro = !!caja && caja.top >= 0 && caja.bottom <= window.innerHeight && caja.right <= window.innerWidth
    const celdas = tabla ? [...tabla.querySelectorAll('tbody td')] : []
    const partidas = celdas.filter((c) => c.getBoundingClientRect().height > 2.2 * parseFloat(getComputedStyle(c).lineHeight || 20)).length
    const titulosFijos = tabla ? getComputedStyle(tabla.querySelector('thead')).position === 'sticky' : true
    const derecha = tabla ? [...tabla.querySelectorAll('thead th')].filter((th) => /^(Total|Saldo|Monto|Cantidad|Días de retraso)$/.test(th.textContent.trim())).every((th) => getComputedStyle(th).textAlign === 'right') : true
    return { mal, dentro, partidas, titulosFijos, derecha, filas: tabla ? tabla.querySelectorAll('tbody tr').length : 0, valor: d.querySelector('[data-detalle-valor]')?.textContent.trim() }
  })
  expect(r.mal, `${nombre}: desplazamiento horizontal`).toEqual([])
  expect(r.dentro, `${nombre}: el pie con "Cerrar" no está visible`).toBe(true)
  expect(r.partidas, `${nombre}: celdas con el texto partido en varias líneas`).toBe(0)
  expect(r.titulosFijos, `${nombre}: los títulos de la tabla no quedan fijos`).toBe(true)
  expect(r.derecha, `${nombre}: las columnas de montos no van a la derecha`).toBe(true)
  return r
}

test('Ninguna pestaña, tabla ni ventana de detalle tiene desplazamiento horizontal a 1366×768', async ({ page }) => {
  test.setTimeout(240_000)
  await irAReportes(page)
  let abiertas = 0
  for (const nombre of PESTANAS) {
    await abrirPestana(page, nombre)
    expect(await desbordes(page), `pestaña ${nombre}`).toEqual([])
    const total = await page.locator('[role=tabpanel] [data-lista]').count()
    for (let i = 0; i < Math.min(total, MAXIMO_POR_PESTANA); i++) {
      const boton = page.locator('[role=tabpanel] [data-lista]').nth(i)
      const etiqueta = (await boton.getAttribute('aria-label')) || `elemento ${i + 1}`
      if (await boton.isDisabled()) continue
      await boton.click()
      await revisarVentana(page, `${nombre} · ${etiqueta}`)
      abiertas++
      await page.keyboard.press('Escape')
      await expect(page.getByRole('dialog')).toHaveCount(0)
    }
  }
  expect(abiertas, 'listas revisadas').toBeGreaterThan(25)
})

test('El número que se pulsa es el que muestra la ventana, y la lista tiene tantas filas como dice', async ({ page }) => {
  test.setTimeout(180_000)
  await irAReportes(page)
  for (const nombre of PESTANAS) {
    await abrirPestana(page, nombre)
    // Los datos llegan por partes: se espera a que los números dejen de cambiar antes de leerlos.
    const leer = () => page.locator('[role=tabpanel] button[data-lista][aria-label$=". Ver la lista"]').evaluateAll((els) => els.filter((e) => e.closest('table') == null && e.querySelector('span.font-serif')).map((e) => e.getAttribute('aria-label')))
    let tarjetas = await leer()
    await expect(async () => { const otra = await leer(); const igual = JSON.stringify(otra) === JSON.stringify(tarjetas); tarjetas = otra; await page.waitForTimeout(700); expect(igual).toBe(true) }).toPass({ timeout: 20_000 })
    for (const etiqueta of tarjetas) {
      const [, titulo, valor] = etiqueta.match(/^(.+?): (.+)\. Ver la lista$/)
      await page.getByRole('button', { name: etiqueta, exact: true }).click()
      const r = await revisarVentana(page, `${nombre} · ${titulo}`)
      expect(r.valor, `${nombre} · ${titulo}: el número de la ventana`).toBe(valor)
      // Un conteo se comprueba contando: la lista tiene exactamente esas filas (los porcentajes y los montos no son conteos).
      if (/^\d+$/.test(valor)) expect(r.filas, `${nombre} · ${titulo}: filas de la lista`).toBe(Number(valor))
      await page.keyboard.press('Escape')
    }
  }
})

test('Los filtros están en el mismo lugar en todas las pestañas y se ven como etiquetas', async ({ page }) => {
  await irAReportes(page)
  const cajas = []
  for (const nombre of PESTANAS) {
    await abrirPestana(page, nombre)
    cajas.push(await page.getByRole('group', { name: 'Filtros', exact: true }).boundingBox())
    await expect(page.getByRole('list', { name: 'Filtros activos' })).toContainText('Período:')
  }
  for (const c of cajas) expect(c).toEqual(cajas[0])
  await filtros(page).getByLabel('Origen', { exact: true }).selectOption('paciente')
  await expect(page.getByRole('list', { name: 'Filtros activos' })).toContainText('Origen: Web')
  await filtros(page).getByRole('button', { name: 'Limpiar filtros' }).click()
  await expect(page.getByRole('list', { name: 'Filtros activos' })).not.toContainText('Origen')
})

test('Con origen Web, "Abrir en Citas" muestra el mismo número que Reportes', async ({ page }) => {
  await irAReportes(page)
  await abrirPestana(page, 'Citas')
  await page.getByRole('button', { name: 'Este año', exact: true }).click()
  await filtros(page).getByLabel('Origen', { exact: true }).selectOption('paciente')
  const tarjeta = page.getByRole('button', { name: /^Citas: \d+\. Ver la lista$/ })
  const n = Number((await tarjeta.getAttribute('aria-label')).match(/: (\d+)\./)[1])
  await tarjeta.click()
  await page.getByRole('button', { name: /^Abrir en Citas/ }).click()
  await expect(page.getByRole('status').first()).toHaveText(new RegExp(`^(${n} citas?|Mostrando ${n} de \\d+ citas)`), { timeout: 20_000 })
})

test('Exportar está ordenado por módulo, permite marcar varios y el inventario se descarga como Excel', async ({ page }) => {
  await irAReportes(page)
  await page.getByRole('button', { name: 'Exportar', exact: true }).click()
  const ventana = page.getByRole('dialog', { name: 'Exportar' })
  await expect(ventana.getByRole('tab')).toHaveCount(5)
  const pasos = { Resumen: ['Resumen mes a mes'], Citas: ['Citas del período', 'Inasistencias para reagendar'], 'Clínico': ['Consultas del período', 'Pacientes para campaña'], Ventas: ['Ventas para el contador', 'Cobros del período', 'Inventario actual'], Laboratorios: ['Órdenes pendientes por laboratorio'] }
  for (const [modulo, nombres] of Object.entries(pasos)) {
    await ventana.getByRole('tab', { name: new RegExp('^' + modulo) }).click()
    for (const nombre of nombres) await expect(ventana.getByText(nombre).first()).toBeVisible()
    expect(await desbordes(page), modulo).toEqual([])
    const cuerpo = await page.evaluate(() => { const d = document.querySelector('[role=dialog]'); return [...d.querySelectorAll('div')].filter((e) => ['auto', 'scroll'].includes(getComputedStyle(e).overflowY)).map((e) => e.scrollWidth - e.clientWidth) })
    expect(Math.max(0, ...cuerpo), `${modulo}: desplazamiento horizontal en la ventana`).toBeLessThanOrEqual(1)
  }
  await ventana.getByRole('tab', { name: /^Citas/ }).click()
  await ventana.getByRole('checkbox', { name: 'Citas del período' }).check()
  await ventana.getByRole('tab', { name: /^Ventas/ }).click()
  await ventana.getByRole('checkbox', { name: 'Inventario actual' }).check()
  await expect(ventana.getByRole('button', { name: 'Exportar (2)' })).toBeEnabled()
  await ventana.getByRole('tab', { name: /^Citas/ }).click()
  await ventana.getByRole('checkbox', { name: 'Citas del período' }).uncheck()
  const descarga = page.waitForEvent('download')
  await ventana.getByRole('button', { name: 'Exportar', exact: true }).click()
  expect((await descarga).suggestedFilename()).toBe('inventario-actual.xlsx')
})

test('Cada bloque tiene su botón Exportar en el mismo lugar, con datos y detalle completo', async ({ page }) => {
  await irAReportes(page)
  await abrirPestana(page, 'Citas')
  const boton = page.getByRole('button', { name: 'Exportar Inasistencia por mes' })
  await boton.click()
  const menu = page.getByRole('menu')
  await expect(menu.getByRole('menuitem', { name: /Datos de la gráfica/ })).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: /Detalle completo/ })).toBeVisible()
  // Esquina superior derecha de su bloque, igual en todos.
  await page.keyboard.press('Escape')
  const margenes = await page.evaluate(() => [...document.querySelectorAll('[role=tabpanel] button[aria-label^="Exportar "]')].map((b) => { const caja = b.closest('div.rounded-2xl').getBoundingClientRect(); const r = b.getBoundingClientRect(); return { derecha: Math.round(caja.right - r.right), arriba: Math.round(r.top - caja.top) } }))
  expect(margenes.length).toBeGreaterThanOrEqual(5)
  for (const m of margenes) expect(m).toEqual(margenes[0])
  // El inventario no depende de esto; aquí solo se comprueba que descargar los datos de un bloque produce un Excel (no es personal: no se registra).
  const descarga = page.waitForEvent('download')
  await boton.click()
  await menu.getByRole('menuitem', { name: /Datos de la gráfica/ }).click()
  expect((await descarga).suggestedFilename()).toMatch(/^inasistencia-por-mes-datos-.*.xlsx$/)
})

test('El optómetra ve solo lo suyo: sin la pestaña Ventas, sin filtro de profesional y sin montos', async ({ page }) => {
  await irAReportes(page, 'OPTOMETRA')
  await expect(page.getByRole('tab', { name: 'Ventas', exact: true })).toHaveCount(0)
  await expect(filtros(page).getByLabel('Profesional', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Filtros activos' })).toContainText('Solo tus consultas y tus citas')
  await expect(page.getByRole('button', { name: /^Vendido: / })).toHaveCount(0)
})
