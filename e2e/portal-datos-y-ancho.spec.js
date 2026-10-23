// Dos cosas que una pantalla del portal no puede hacer, con el paciente de demostración de la Óptica Demo (solo lectura):
//   1. Que un paciente CON datos (cita, lentes, saldo) vea la bienvenida de un paciente nuevo («Agenda tu primera cita»): eso es lo que pasa cuando el portal no trae sus datos.
//   2. Que el contenido no ocupe el ancho disponible: a 1366 y a 1920 px (y a 1093, una laptop de 1366 con la escala al 125 %) mide el ancho de la zona de contenido de cada pantalla y FALLA
//      si no es «el ancho disponible menos los márgenes de 32 px» (sin tope), con el menú abierto y con el menú plegado.
import { test, expect } from '@playwright/test'
import { escribirSecreto, SLUG_DEMO } from './ayudas.js'
import { protegerDemo } from './guardia-demo.js'

const PANTALLAS = ['Inicio', 'Mis citas', 'Mi receta', 'Mis compras', 'Mis datos']
const MARGEN = 32
const TOPE = Infinity // sin tope de ancho: lo que sobra en una pantalla grande lo ocupa el contenido

async function entrar(page) {
  await page.goto(`/?optica=${SLUG_DEMO}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Ej. 0912345678 o tu usuario'), process.env.DEMO_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.DEMO_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
}

test.describe('Portal: datos y ancho', () => {
  test.beforeEach(async ({ page }) => { await protegerDemo(page) })

  test('un paciente con datos ve su Inicio (cita, lentes, saldo), nunca la bienvenida de un paciente nuevo', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrar(page)
    await expect(page.getByRole('region', { name: 'Bienvenida' })).toHaveCount(0)
    await expect(page.getByText('Te damos la bienvenida')).toHaveCount(0)
    // La cita de la Demo pasa con el tiempo: con una futura se ve su hora; sin ninguna, el mensaje de siempre (no la bienvenida de un paciente nuevo).
    await expect(page.getByRole('region', { name: 'Tu próxima cita' })).toContainText(/\d{1,2}:\d{2} (AM|PM)|Aún no tienes una cita agendada/)
    await expect(page.getByRole('region', { name: 'Tus lentes' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Pendiente para ti' })).toContainText('por pagar')
    await expect(page.getByRole('region', { name: 'Tu graduación' })).toBeVisible()
  })

  test('con la sesión vencida el portal no se abre como el de un paciente nuevo: vuelve al ingreso y lo dice', async ({ page }) => {
    test.setTimeout(90_000)
    await page.setViewportSize({ width: 1366, height: 768 })
    await entrar(page)
    // El mismo navegador que ya tiene al paciente guardado, pero con un token que el servidor no reconoce.
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('optica_sesion'))
      s.token = 'vencido'
      localStorage.setItem('optica_sesion', JSON.stringify(s))
      localStorage.setItem('optica_pacientes', JSON.stringify([{ id: s.pacienteId, nombre: 'Paciente Demostración Portal', cedula: '0934070830' }]))
    })
    await page.reload()
    await expect(page.getByText('Tu sesión venció')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('region', { name: 'Bienvenida' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible()
  })

  for (const ancho of [1366, 1920, 1093]) {
    test(`a ${ancho} px el contenido de cada pantalla ocupa el ancho disponible menos 32 px de margen a cada lado, sin tope de ancho`, async ({ page }) => {
      test.setTimeout(90_000)
      await page.setViewportSize({ width: ancho, height: ancho === 1920 ? 1080 : 768 })
      await entrar(page)
      for (const pantalla of PANTALLAS) {
        await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: pantalla, exact: true }).click()
        await page.waitForTimeout(700)
        const m = await page.evaluate(() => {
          const caja = document.querySelector('[data-portal-scroll]')
          const zona = document.querySelector('.pt-zona')
          const cs = getComputedStyle(caja)
          const disponible = caja.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
          const r = zona.getBoundingClientRect(); const c = caja.getBoundingClientRect()
          return { disponible, zona: r.width, izq: r.left - c.left, der: c.right - r.right, padIzq: parseFloat(cs.paddingLeft) }
        })
        const esperado = Math.min(m.disponible, TOPE)
        expect(m.padIzq, `${pantalla}: margen de la zona`).toBe(MARGEN)
        expect(Math.abs(m.zona - esperado), `${pantalla}: la zona mide ${Math.round(m.zona)} px y debería medir ${Math.round(esperado)} (ancho disponible ${Math.round(m.disponible)})`).toBeLessThanOrEqual(1)
        // y queda centrada: la misma distancia a cada lado (solo sobra espacio cuando topa en 1440)
        expect(Math.abs(m.izq - m.der), `${pantalla}: centrada`).toBeLessThanOrEqual(1)
      }
    })
  }
})
