// Las reglas de diseño del portal del paciente y del perfil del paciente (personal), comprobadas en cada pantalla y cada pestaña, a 1093 px (la laptop de 1366 con la escala al 125 %, con
// escala de dispositivo 1.25), 1366 y 1920 px, con el menú abierto y con el menú plegado. Demo, SOLO LECTURA (abrir ventanas no guarda nada).
//   1. Ancho: el contenido ocupa el ancho disponible menos 32 px de margen a cada lado (sin tope), con el menú abierto y con el menú plegado.
//   2. Filas en columnas, sin el centro vacío: ninguna fila de lista deja más del 40 % de su ancho vacío en el centro.
//   3. Alineación: en una lista, los montos (a la derecha) y los estados (a la izquierda) quedan en el mismo borde en todas las filas (1 px de tolerancia). Se mide el texto, no la caja.
//   4. Todo se puede pulsar: toda tarjeta o fila que resume algo (`.pt-abrible`, o `data-resumen` en el personal) abre una ventana (o lleva a su pestaña) al pulsarla.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto, SLUG_DEMO } from './ayudas.js'
import { protegerDemo } from './guardia-demo.js'

const MARGEN = 32
const TAMANOS = [
  { nombre: '1093 (laptop al 125 %)', ancho: 1093, alto: 768, escala: 1.25 },
  { nombre: '1366', ancho: 1366, alto: 768, escala: 1 },
  { nombre: '1920', ancho: 1920, alto: 1080, escala: 1 },
]
const PANTALLAS = ['Inicio', 'Mis citas', 'Mi receta', 'Mis compras', 'Mis datos']
const PESTANAS = ['Resumen', 'Citas', 'Graduación', 'Compras', 'Órdenes de laboratorio']
const PACIENTE = 'Paciente Demostración Portal'

// Lo que se mide dentro de la página. Devuelve la lista de problemas (vacía si todo está bien).
async function revisarListas(page, donde) {
  return page.evaluate((donde) => {
    const problemas = []
    const raiz = document.querySelector('[data-portal-scroll]') || document.querySelector('main') || document.body
    const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 }
    const rectsDeTexto = (fila) => {
      const rs = []
      const w = document.createTreeWalker(fila, NodeFilter.SHOW_TEXT)
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (!n.textContent.trim()) continue
        const rango = document.createRange(); rango.selectNodeContents(n)
        for (const r of rango.getClientRects()) if (r.width > 0) rs.push({ izq: r.left, der: r.right })
      }
      // los íconos, las imágenes y las líneas de relleno (los puntos que unen un nombre con su precio) también son contenido
      for (const e of fila.querySelectorAll('svg, img, [data-relleno]')) { const r = e.getBoundingClientRect(); if (r.width > 0) rs.push({ izq: r.left, der: r.right }) }
      return rs
    }
    // Montos y estados alineados (listas marcadas con data-lista; cada fila con data-fila y sus celdas con data-col).
    for (const lista of raiz.querySelectorAll('[data-lista]')) {
      const nombre = lista.getAttribute('data-lista')
      const filas = [...lista.querySelectorAll('[data-fila]')].filter(visible)
      if (filas.length < 2) continue
      for (const [col, borde] of [['monto', 'der'], ['estado', 'izq']]) {
        const bordes = filas.map((f) => {
          const c = f.querySelector(`[data-col="${col}"]`)
          if (!c || !visible(c)) return null
          const rs = rectsDeTexto(c)
          if (!rs.length) return null
          return Math.round((borde === 'der' ? Math.max(...rs.map((r) => r.der)) : Math.min(...rs.map((r) => r.izq))) * 10) / 10
        }).filter((x) => x !== null)
        if (bordes.length > 1 && Math.max(...bordes) - Math.min(...bordes) > 1) problemas.push(`${donde} · lista «${nombre}»: los ${col === 'monto' ? 'montos' : 'estados'} no están alineados (bordes ${bordes.join(', ')})`)
      }
    }
    // El centro de una fila no queda vacío: ningún hueco entre su contenido de más del 40 % del ancho de la fila.
    const filas = [...raiz.querySelectorAll('li, [data-fila]')].filter((f) => !f.closest('[role="dialog"], nav, [role="tablist"], [role="listbox"], [role="menu"]') && visible(f) && f.getBoundingClientRect().width >= 480 && f.getBoundingClientRect().height < 400)
    for (const f of filas) {
      // nada de la fila queda cortado por el borde derecho ni encimado con otro texto
      const caja = f.getBoundingClientRect()
      const cortado = [...f.querySelectorAll('*')].find((e) => visible(e) && e.children.length === 0 && e.textContent.trim() && e.getBoundingClientRect().right > caja.right + 1)
      if (cortado) problemas.push(`${donde} · algo de una fila se sale por el borde derecho: «${cortado.textContent.trim().slice(0, 40)}»`)
      // el texto se mide por su propia caja (Range), no por la del botón o la etiqueta que lo contiene
      const cajas = []
      const w2 = document.createTreeWalker(f, NodeFilter.SHOW_TEXT)
      for (let n = w2.nextNode(); n; n = w2.nextNode()) {
        if (!n.textContent.trim() || !n.parentElement || !visible(n.parentElement)) continue
        const rango = document.createRange(); rango.selectNodeContents(n)
        for (const r of rango.getClientRects()) if (r.width > 0) cajas.push({ e: n.parentElement, r })
      }
      for (let i = 0; i < cajas.length; i++) for (let j = i + 1; j < cajas.length; j++) {
        const a = cajas[i].r, b = cajas[j].r
        if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 3 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 3 && !cajas[i].e.contains(cajas[j].e) && !cajas[j].e.contains(cajas[i].e)) { problemas.push(`${donde} · texto encimado en una fila: «${cajas[i].e.textContent.trim().slice(0, 25)}» y «${cajas[j].e.textContent.trim().slice(0, 25)}»`); i = cajas.length; break }
      }
      const rs = rectsDeTexto(f).sort((a, b) => a.izq - b.izq)
      if (rs.length < 2) continue
      let hueco = 0, fin = rs[0].der
      for (const r of rs.slice(1)) { hueco = Math.max(hueco, r.izq - fin); fin = Math.max(fin, r.der) }
      const ancho = f.getBoundingClientRect().width
      if (hueco > ancho * 0.4) problemas.push(`${donde} · fila de lista con el centro vacío (${Math.round(hueco)} de ${Math.round(ancho)} px): «${f.textContent.replace(/\s+/g, ' ').trim().slice(0, 60)}»`)
    }
    return problemas
  }, donde)
}

// Pulsa cada tarjeta o fila que resume algo: abre una ventana o lleva a otra pestaña. Devuelve los que no hicieron nada.
async function pulsarTodo(page, selector, donde, volver) {
  const fallos = []
  const total = await page.locator(selector).count()
  for (let i = 0; i < total; i++) {
    const el = page.locator(selector).nth(i)
    if (!(await el.isVisible())) continue
    const descripcion = (await el.evaluate((e) => (e.getAttribute('aria-label') || e.textContent || e.className).toString().replace(/\s+/g, ' ').trim().slice(0, 50)))
    const antes = await page.evaluate(() => [document.querySelector('h1')?.textContent, ...[...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent)].join('|'))
    await el.scrollIntoViewIfNeeded()
    await el.click({ position: { x: 8, y: 8 }, timeout: 8_000 }).catch(() => fallos.push(`${donde} · no se pudo pulsar «${descripcion}»`))
    await page.waitForTimeout(450)
    const hayVentana = (await page.getByRole('dialog').count()) > 0
    const despues = await page.evaluate(() => [document.querySelector('h1')?.textContent, ...[...document.querySelectorAll('[role="tab"][aria-selected="true"]')].map((t) => t.textContent)].join('|'))
    if (!hayVentana && despues === antes) fallos.push(`${donde} · «${descripcion}» parece pulsable pero no abre nada`)
    if (hayVentana) { await page.keyboard.press('Escape'); await page.getByRole('dialog').first().waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {}) }
    if (despues !== antes) await volver()
  }
  return fallos
}

async function entrarPortal(page) {
  await protegerDemo(page)
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.DEMO_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
}
const irAPantalla = async (page, nombre) => {
  await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: nombre, exact: true }).click()
  await page.waitForTimeout(800)
}

for (const t of TAMANOS) {
  test.describe(`Diseño a ${t.nombre}`, () => {
    test.use({ viewport: { width: t.ancho, height: t.alto }, deviceScaleFactor: t.escala })

    for (const plegado of [false, true]) {
      const menu = plegado ? 'menú plegado' : 'menú abierto'

      test(`portal del paciente · ${menu}: ancho, filas en columnas, alineación y todo se pulsa`, async ({ page }) => {
        test.setTimeout(420_000)
        await entrarPortal(page)
        if (plegado) await page.getByRole('button', { name: 'Ocultar el menú' }).click()
        const problemas = []
        for (const pantalla of PANTALLAS) {
          await irAPantalla(page, pantalla)
          const donde = `Portal ${t.nombre} ${menu} · ${pantalla}`
          // 1. ancho
          const m = await page.evaluate(() => {
            const caja = document.querySelector('[data-portal-scroll]'); const zona = document.querySelector('.pt-zona'); const cs = getComputedStyle(caja)
            const disponible = caja.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
            const r = zona.getBoundingClientRect(); const c = caja.getBoundingClientRect()
            return { disponible, zona: r.width, izq: r.left - c.left, der: c.right - r.right, pad: parseFloat(cs.paddingLeft) }
          })
          if (m.pad !== MARGEN) problemas.push(`${donde}: el margen es de ${m.pad} px y debe ser de ${MARGEN}`)
          if (Math.abs(m.zona - m.disponible) > 1) problemas.push(`${donde}: el contenido mide ${Math.round(m.zona)} px y el ancho disponible menos márgenes es ${Math.round(m.disponible)}`)
          // 2 y 3. columnas y alineación
          problemas.push(...(await revisarListas(page, donde)))
          // 4. todo se pulsa
          problemas.push(...(await pulsarTodo(page, '[data-portal-scroll] .pt-abrible', donde, () => irAPantalla(page, pantalla))))
        }
        expect(problemas, problemas.join('\n')).toEqual([])
      })

      test(`perfil del paciente (personal) · ${menu}: ancho, filas en columnas, alineación y todo se pulsa`, async ({ page }) => {
        test.setTimeout(420_000)
        await iniciarSesion(page, 'ADMIN', 'DEMO')
        await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
        await page.getByRole('textbox', { name: /buscar paciente/i }).fill(PACIENTE)
        const fila = page.getByRole('row').filter({ hasText: PACIENTE })
        await expect(fila.getByRole('button', { name: /Ver perfil 360/ })).toBeVisible({ timeout: 30_000 })
        await expect(fila).toContainText('Graduación:', { timeout: 45_000 })
        await expect(async () => {
          await fila.getByRole('button', { name: /Ver perfil 360/ }).click()
          await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
        }).toPass({ timeout: 60_000 })
        if (plegado) await page.getByRole('button', { name: 'Colapsar menú' }).click()
        await page.waitForTimeout(600)
        const problemas = []
        for (const pestana of PESTANAS) {
          await page.getByRole('tab', { name: new RegExp('^' + pestana) }).click()
          await page.waitForTimeout(900)
          const donde = `Perfil ${t.nombre} ${menu} · ${pestana}`
          // cabecera y pestañas: el contenido ocupa el ancho del área menos 32 px de margen
          const m = await page.evaluate(() => {
            const tabs = document.querySelector('[role="tablist"]')
            const contenedor = tabs.closest('div.px-4, div[class*="sm:px-8"]') || tabs.parentElement
            const cs = getComputedStyle(contenedor)
            const r = contenedor.getBoundingClientRect()
            const cabecera = contenedor.firstElementChild.getBoundingClientRect()
            return { pad: parseFloat(cs.paddingLeft), ancho: r.width, cabecera: cabecera.width, disponible: r.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) }
          })
          if (m.pad !== MARGEN) problemas.push(`${donde}: el margen es de ${m.pad} px y debe ser de ${MARGEN}`)
          if (Math.abs(m.cabecera - m.disponible) > 1) problemas.push(`${donde}: el contenido mide ${Math.round(m.cabecera)} px y el ancho disponible menos márgenes es ${Math.round(m.disponible)}`)
          problemas.push(...(await revisarListas(page, donde)))
          problemas.push(...(await pulsarTodo(page, '.pt-abrible, [data-resumen]', donde, () => page.getByRole('tab', { name: new RegExp('^' + pestana) }).click())))
        }
        expect(problemas, problemas.join('\n')).toEqual([])
      })
    }
  })
}
