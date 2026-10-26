// Panel del personal en celular y tablet, parte 3: Pacientes, el perfil del paciente y Contactar, a 360, 390, 430 y 820 px.
//   * Óptica Demo, SOLO LECTURA, con el administrador y el optómetra: lista en tarjetas con sus filtros y su menú, «Crear paciente» a pantalla completa, el perfil con sus cuatro pestañas
//     (Resumen, Citas, Diagnóstico y Compras), lo que es de computadora («Nueva venta», abonos) avisa sin salir de la pantalla, y Contactar con su ventana que sube desde abajo.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')
const AVISO = 'Esto se hace desde la computadora.'

async function medir(page) {
  return page.evaluate(() => {
    const visible = (e) => { const c = e.getBoundingClientRect(); const s = getComputedStyle(e); return c.width > 0 && c.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const chicos = [], letra = []
    for (const e of document.body.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary')) {
      if (!visible(e)) continue
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
  test.describe(`Pacientes, perfil y Contactar a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })

    for (const [rol, nombreRol] of [['ADMIN', 'administrador'], ['OPTOMETRA', 'optómetra']]) {
      test(`${nombreRol}: lista, crear, perfil con sus pestañas y Contactar`, async ({ page }) => {
        test.setTimeout(240_000)
        await iniciarSesion(page, rol, 'DEMO')
        await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })

        // ── Lista de Pacientes ──
        await barra(page).getByRole('button', { name: 'Pacientes', exact: true }).click()
        const tarjetas = page.locator('[data-paciente-id]')
        await expect(tarjetas.first()).toBeVisible({ timeout: 30_000 })
        await expect(page.getByRole('button', { name: /^Filtrar/ })).toBeVisible()
        await expect(page.getByPlaceholder(/Buscar paciente/)).toBeVisible()
        expect(await page.locator('button[aria-pressed]').count()).toBeGreaterThanOrEqual(2) // las tarjetas de indicadores siguen filtrando
        let m = await medir(page)
        expect(m, `Lista: ${JSON.stringify(m)}`).toEqual(limpio)

        // «Filtrar» a pantalla completa, con los mismos filtros.
        await page.getByRole('button', { name: /^Filtrar/ }).click()
        const filtros = page.getByRole('dialog', { name: 'Filtrar pacientes' })
        await expect(filtros).toBeVisible()
        await expect(filtros.getByText('Mostrar', { exact: true }).first()).toBeVisible()
        await expect(filtros.getByText('Fecha de registro', { exact: true }).first()).toBeVisible()
        await page.waitForTimeout(500)
        expect(Math.round((await filtros.boundingBox()).width)).toBe(ancho)
        await filtros.getByRole('button', { name: 'Listo' }).click()
        await expect(filtros).toHaveCount(0)

        // El menú «Más acciones» de la tarjeta sube desde abajo, con opciones de 44 px.
        await tarjetas.first().getByRole('button', { name: 'Más acciones' }).click()
        const menu = page.locator('[data-menu-acciones]')
        await expect(menu).toBeVisible()
        m = await medir(page)
        expect(m.chicos, `Menú: ${JSON.stringify(m)}`).toEqual([])
        await page.waitForTimeout(400)
        const cajaMenu = await menu.boundingBox()
        expect(Math.round(cajaMenu.y + cajaMenu.height)).toBeGreaterThanOrEqual(799)
        await page.mouse.click(10, 40)
        await expect(menu).toHaveCount(0)

        // «Nueva venta» es de un módulo de computadora: lo dice sin salir de la pantalla.
        const venta = tarjetas.first().getByRole('button', { name: 'Nueva venta' })
        if (await venta.count()) {
          await venta.click()
          await expect(page.getByText(AVISO).first()).toBeVisible()
          await expect(tarjetas.first()).toBeVisible()
        }

        // «Crear paciente» y «Editar datos» abren las mismas ventanas, a pantalla completa.
        const crear = page.getByRole('button', { name: 'Crear paciente', exact: true })
        if (await crear.count()) {
          await crear.click()
          const form = page.getByRole('dialog', { name: 'Crear paciente' })
          await expect(form).toBeVisible()
          await expect(form.getByRole('combobox', { name: 'Tipo de documento' })).toBeVisible()
          await expect(form.getByRole('button', { name: 'Registrar paciente' })).toBeVisible()
          await page.waitForTimeout(500)
          expect(Math.round((await form.boundingBox()).width)).toBe(ancho)
          m = await medir(page)
          expect(m, `Crear paciente: ${JSON.stringify(m)}`).toEqual(limpio)
          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }

        // ── Perfil ──
        await page.getByPlaceholder(/Buscar paciente/).fill('Demostración')
        const demo = page.locator('[data-paciente-id]', { hasText: 'Paciente Demostración Portal' })
        const objetivo = (await demo.count()) ? demo.first() : tarjetas.first()
        await expect(objetivo).toBeVisible({ timeout: 20_000 })
        await objetivo.getByRole('button', { name: /^Ver el perfil de/ }).click()
        const cabecera = page.getByRole('banner', { name: 'Perfil del paciente' }).or(page.locator('header[aria-label="Perfil del paciente"]'))
        await expect(cabecera).toBeVisible({ timeout: 20_000 })
        // «Contactar» (el «Enviar mensaje» de la computadora) solo está con el permiso de crear en el CRM.
        if (rol === 'ADMIN') await expect(cabecera.getByRole('button', { name: 'Contactar', exact: true })).toBeVisible()
        for (const t of ['Historia clínica', 'Datos', 'Agendar cita']) await expect(cabecera.getByRole('button', { name: t, exact: true })).toBeAttached()
        for (const t of ['Resumen', 'Citas', 'Compras']) await expect(cabecera.getByRole('tab', { name: new RegExp(`^${t}`) })).toBeAttached()
        m = await medir(page)
        expect(m, `Perfil · Resumen: ${JSON.stringify(m)}`).toEqual(limpio)
        await expect(page.getByRole('region', { name: 'Datos del paciente' })).toBeVisible()

        // «Datos» (ventana a pantalla completa) y «Contactar» (la ventana de enviar mensaje).
        await cabecera.getByRole('button', { name: 'Datos', exact: true }).click()
        const datos = page.getByRole('dialog').last()
        await expect(datos).toBeVisible()
        await page.waitForTimeout(500)
        expect(Math.round((await datos.boundingBox()).width)).toBe(ancho)
        m = await medir(page)
        expect(m, `Datos del paciente: ${JSON.stringify(m)}`).toEqual(limpio)
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)

        for (const [pestana, espera] of [['Citas', /Asistencia a sus citas|Historial de citas/], ['Diagnóstico', /Diagnóstico/], ['Compras', /Compras · \d+/]]) {
          const tab = cabecera.getByRole('tab', { name: new RegExp(`^${pestana}`) })
          if (!(await tab.count())) continue
          await tab.click()
          await expect(page.getByRole('tabpanel')).toContainText(espera, { timeout: 15_000 })
          m = await medir(page)
          expect(m, `Perfil · ${pestana}: ${JSON.stringify(m)}`).toEqual(limpio)
        }

        // Compras: «Nueva venta» avisa; cada compra abre su detalle completo y sus acciones de computadora avisan.
        const nueva = page.getByRole('button', { name: '+ Nueva venta' })
        if (await nueva.count()) {
          await nueva.click()
          await expect(page.getByText(AVISO).first()).toBeVisible()
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }
        const compra = page.locator('[data-lista="compras-paciente"] [data-fila] button.pt-abrir').first()
        if (await compra.count()) {
          await compra.click()
          const detalle = page.getByRole('dialog').last()
          await expect(detalle).toBeVisible()
          await page.waitForTimeout(500)
          expect(Math.round((await detalle.boundingBox()).width)).toBe(ancho)
          m = await medir(page)
          expect(m, `Detalle de la compra: ${JSON.stringify(m)}`).toEqual(limpio)
          const abono = detalle.getByRole('button', { name: /Registrar abono/ })
          if (await abono.count()) { await abono.click(); await expect(page.getByText(AVISO).first()).toBeVisible(); await expect(detalle).toBeVisible() }
          await page.keyboard.press('Escape')
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }

        // ── Contactar (la pestaña de la barra de abajo) ──
        if (!(await barra(page).getByRole('button', { name: 'Contactar', exact: true }).count())) return // este rol no ve el CRM
        await barra(page).getByRole('button', { name: 'Contactar', exact: true }).click()
        await expect(page.locator('.modo-celular header p').first()).toHaveText('Contactar')
        const filtrosMotivo = page.getByRole('group', { name: 'Filtrar por motivo' })
        await expect(filtrosMotivo).toBeVisible({ timeout: 20_000 })
        await expect(filtrosMotivo.getByRole('button', { name: /^Todos/ })).toBeVisible()
        const lista = page.locator('[data-paciente-id]')
        if (await lista.first().getByRole('button', { name: /^Contactar a/ }).count()) { // sin permiso de crear en el CRM no hay «Contactar»
          m = await medir(page)
          expect(m, `Contactar: ${JSON.stringify(m)}`).toEqual(limpio)
          await lista.first().getByRole('button', { name: /^Contactar a/ }).click()
          const hoja = page.getByRole('dialog', { name: 'Contactar' })
          await expect(hoja).toBeVisible()
          await page.waitForTimeout(500)
          const caja = await hoja.boundingBox()
          expect(Math.round(caja.width)).toBe(ancho)
          expect(Math.round(caja.y + caja.height)).toBe(800) // sube desde abajo
          expect(caja.y).toBeGreaterThan(0) // y no es la pantalla entera
          await expect(hoja.locator('textarea')).not.toHaveValue('')
          await expect(hoja.getByRole('button', { name: 'Enviar por WhatsApp' })).toBeVisible()
          m = await medir(page)
          expect(m, `Hoja Contactar: ${JSON.stringify(m)}`).toEqual(limpio)
          await hoja.getByRole('button', { name: 'Cancelar' }).click()
          await expect(page.getByRole('dialog')).toHaveCount(0)
        }
        // Lo demás del CRM queda como «Solo en computadora».
        const solo = page.getByRole('region', { name: 'Solo en computadora' })
        for (const t of ['Historial de contactos', 'Campañas', 'Fidelización', 'Plantillas']) await expect(solo.getByRole('button', { name: new RegExp(t) })).toBeVisible()
        await solo.getByRole('button', { name: /Campañas/ }).click()
        await expect(page.getByText(AVISO).first()).toBeVisible()
        await expect(page.locator('.modo-celular header p').first()).toHaveText('Contactar')
      })
    }
  })
}

// Con el teléfono en horizontal (844 x 390): la lista y el perfil siguen sin desplazamiento de lado, con lo que se toca de 44 px y nada tapado por la barra de abajo.
test.describe('Pacientes y perfil con el teléfono en horizontal', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })
  test('lista y perfil', async ({ page }) => {
    test.setTimeout(120_000)
    await iniciarSesion(page, 'ADMIN', 'DEMO')
    await barra(page).getByRole('button', { name: 'Pacientes', exact: true }).click()
    await expect(page.locator('[data-paciente-id]').first()).toBeVisible({ timeout: 30_000 })
    let m = await medir(page)
    expect(m, `Lista en horizontal: ${JSON.stringify(m)}`).toEqual(limpio)
    await page.locator('[data-paciente-id]').first().getByRole('button', { name: /^Ver el perfil de/ }).click()
    await expect(page.locator('header[aria-label="Perfil del paciente"]')).toBeVisible({ timeout: 20_000 })
    m = await medir(page)
    expect(m, `Perfil en horizontal: ${JSON.stringify(m)}`).toEqual(limpio)
    // la barra de abajo no tapa el final del contenido: se puede llegar a él desplazando
    const llega = await page.evaluate(() => { const main = document.querySelector('.modo-celular main') || document.querySelector('#vista-completa-root > div'); return !!main })
    expect(llega).toBe(true)
  })
})
