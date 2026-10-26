// Panel del personal en celular y tablet, parte 1 (la base y el Inicio), a 360, 390, 430 y 820 px, con el administrador y el optómetra de la Óptica Demo (SOLO LECTURA: nada se guarda).
// Comprueba: sin el mensaje de «pantalla muy pequeña»; la barra de abajo y la cabecera; «Más» según los permisos; «Este módulo se usa desde la computadora» dentro del sistema (por la
// dirección y desde un aviso); «Esto se hace desde la computadora» en una acción de módulo de computadora; sin desplazamiento horizontal; lo que se toca mide 44 px o más y lo que se
// escribe 16 px o más; y el límite: 1092 px es celular, 1093 px es la computadora de siempre.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

const TAMANOS = [360, 390, 430, 820]
const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')
const titulo = (page) => page.locator('.modo-celular header p').first()

// Lo que se mide dentro del panel (la ventana de un aviso y el resto de las ventanas compartidas están fuera: se adaptan en otra parte).
async function medir(page) {
  return page.evaluate(() => {
    const raiz = document.querySelector('.modo-celular')
    const visible = (e) => { const c = e.getBoundingClientRect(); const s = getComputedStyle(e); return c.width > 0 && c.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const chicos = [], letra = []
    for (const e of raiz.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary')) {
      if (!visible(e)) continue
      const c = e.getBoundingClientRect()
      const nombre = (e.getAttribute('aria-label') || e.textContent || e.tagName).trim().slice(0, 40)
      if (c.height < 43.5 || c.width < 43.5) chicos.push(`${nombre} (${Math.round(c.width)}x${Math.round(c.height)})`)
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) letra.push(nombre)
    }
    return { desborda: document.documentElement.scrollWidth > window.innerWidth + 1, chicos, letra }
  })
}

for (const ancho of TAMANOS) {
  test.describe(`Celular a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })

    for (const [rol, nombreRol] of [['ADMIN', 'administrador'], ['OPTOMETRA', 'optómetra']]) {
      test(`${nombreRol}: Inicio, Más, módulo de computadora y notificaciones`, async ({ page }) => {
        test.setTimeout(120_000)
        await iniciarSesion(page, rol, 'DEMO')
        await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
        await expect(page.getByText('Nivel de Zoom No Soportado')).toHaveCount(0)
        const nav = barra(page)
        for (const t of ['Inicio', 'Agenda', 'Pacientes', 'Contactar', 'Más']) await expect(nav.getByRole('button', { name: t, exact: true })).toBeVisible()
        await expect(nav.getByRole('button', { name: 'Inicio', exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(titulo(page)).toContainText(/^Buenos|^Buenas/)
        await expect(page.locator('#requiere-atencion')).toBeVisible({ timeout: 20_000 })
        let m = await medir(page)
        expect(m, `Inicio: ${JSON.stringify(m)}`).toEqual({ desborda: false, chicos: [], letra: [] })

        // «Requiere tu atención»: cada fila abre la misma ventana de la computadora, con su contenido y sus acciones.
        const fila = page.locator('#requiere-atencion ul button').first()
        await fila.click()
        await expect(page.getByRole('dialog')).toBeVisible()
        await expect(page.getByRole('dialog').getByRole('button', { name: 'Cerrar' }).first()).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('dialog')).toHaveCount(0)

        // Más: lo que sí se usa, «Solo en computadora» según los permisos y «Cerrar sesión».
        await nav.getByRole('button', { name: 'Más', exact: true }).click()
        await expect(titulo(page)).toHaveText('Más')
        await expect(nav.getByRole('button', { name: 'Más', exact: true })).toHaveAttribute('aria-current', 'page')
        await expect(page.getByRole('button', { name: /^Mi cuenta/ })).toBeVisible()
        await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible()
        await expect(page.getByText('Solo en computadora')).toBeVisible()
        if (rol === 'ADMIN') for (const t of ['Ventas', 'Inventario', 'Reportes', 'CRM y campañas', 'Usuarios y permisos', 'Configuración']) await expect(page.getByRole('button', { name: new RegExp(`^${t}`) })).toBeVisible()
        else await expect(page.getByRole('button', { name: /^Usuarios y permisos/ })).toHaveCount(0) // cada persona ve solo lo que ya puede usar
        m = await medir(page)
        expect(m, `Más: ${JSON.stringify(m)}`).toEqual({ desborda: false, chicos: [], letra: [] })

        // Un módulo de computadora: el aviso dentro del sistema, con la barra visible y botones a lo que sí se usa.
        await page.getByRole('button', { name: /^Inventario/ }).click()
        await expect(page.getByRole('heading', { name: 'Este módulo se usa desde la computadora' })).toBeVisible()
        await expect(page.getByText(/Inventario tiene tablas y formularios que necesitan una pantalla grande/)).toBeVisible()
        await expect(nav).toBeVisible()
        m = await medir(page)
        expect(m, `Módulo de computadora: ${JSON.stringify(m)}`).toEqual({ desborda: false, chicos: [], letra: [] })
        await page.getByRole('main').getByRole('button', { name: 'Pacientes', exact: true }).click()
        await expect(titulo(page)).toHaveText('Pacientes')

        // Notificaciones desde la campana.
        await page.getByRole('button', { name: /^Notificaciones/ }).first().click()
        await expect(titulo(page)).toHaveText('Notificaciones')
        m = await medir(page)
        expect(m, `Notificaciones: ${JSON.stringify(m)}`).toEqual({ desborda: false, chicos: [], letra: [] })
      })
    }

    test('administrador: un módulo de computadora por la dirección o desde un aviso se ve dentro del sistema, sin salir de la sesión', async ({ page }) => {
      test.setTimeout(120_000)
      await iniciarSesion(page, 'ADMIN', 'DEMO')
      await expect(page.locator('#requiere-atencion')).toBeVisible({ timeout: 20_000 })
      // Desde un aviso: «Abrir en Ventas · …» (pedidos atrasados).
      const filaPedidos = page.locator('#requiere-atencion ul button', { hasText: /pedidos? atrasados?/ }).first()
      if (await filaPedidos.count()) {
        await filaPedidos.click()
        await page.getByRole('button', { name: /^Abrir en Ventas/ }).click()
        await expect(page.getByRole('heading', { name: 'Este módulo se usa desde la computadora' })).toBeVisible()
        await expect(titulo(page)).toHaveText('Ventas')
        await expect(barra(page)).toBeVisible()
      }
      // Por la dirección.
      await page.goto('/?optica=qu7u2j&seccion=reportes')
      await expect(page.getByRole('heading', { name: 'Este módulo se usa desde la computadora' })).toBeVisible({ timeout: 30_000 })
      await expect(titulo(page)).toHaveText('Reportes')
      await expect(barra(page)).toBeVisible()
      // Una acción de un módulo de computadora en una pantalla adaptada: se ve igual, pero solo avisa.
      await barra(page).getByRole('button', { name: 'Inicio', exact: true }).click()
      await page.getByRole('button', { name: /Agregar producto/ }).click()
      await expect(page.locator('[data-aviso-flotante]')).toContainText('Esto se hace desde la computadora')
      await expect(titulo(page)).toContainText(/^Buenos|^Buenas/)
    })
  })
}

test.describe('El límite: 1092 px es celular, 1093 px es la computadora', () => {
  test.use({ viewport: { width: 1092, height: 800 } })
  test('del celular a la computadora sin cambiar nada de lo de siempre', async ({ page }) => {
    test.setTimeout(120_000)
    await iniciarSesion(page, 'ADMIN', 'DEMO')
    await expect(barra(page)).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('aside')).toHaveCount(0)
    await page.setViewportSize({ width: 1093, height: 800 })
    await expect(page.locator('aside')).toBeVisible()
    await expect(barra(page)).toHaveCount(0)
    await expect(page.getByText('Nivel de Zoom No Soportado')).toHaveCount(0)
  })
})
