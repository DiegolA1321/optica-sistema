// Recorrido corto por TODOS los módulos del menú, como administrador y como optómetra de la Óptica Demo (solo lectura):
// cada módulo debe cargar (su título a la vista, no cambiar a otro) y no dejar ningún error en la consola ni excepciones de la página.
// Detecta justo el error que rompe la navegación: un módulo que falla al dibujarse deja el menú sin respuesta.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

const MODULOS = [
  { menu: 'Inicio', titulo: null },
  { menu: 'Citas médicas', titulo: 'Citas médicas' },
  { menu: 'Pacientes', titulo: 'Pacientes' },
  { menu: 'Ventas', titulo: 'Ventas', pestanas: ['Ventas', 'Pedidos'] },
  { menu: 'Inventario', titulo: 'Inventario', pestanas: ['Activos', 'Descontinuados'] },
  { menu: 'CRM y fidelización', titulo: 'CRM y fidelización' },
  { menu: 'Horario', titulo: null }, // el administrador (menú «Horario»)
  { menu: 'Mi horario', titulo: null }, // los demás roles
  { menu: 'Reportes', titulo: null },
  { menu: 'Soporte', titulo: null },
  { menu: 'Usuarios y permisos', titulo: null },
  { menu: 'Configuración', titulo: null },
]

// Los errores que no son de la aplicación (extensiones, recursos externos bloqueados) no cuentan.
const IGNORAR = [/favicon/i, /frame-ancestors.*ignored when delivered via a <meta>/i, /Failed to load resource/i, /fonts\.g(oogleapis|static)/i, /sentry/i, /ResizeObserver/i, /Download the React DevTools/i]

function vigilar(page) {
  const errores = []
  page.on('pageerror', (e) => errores.push(`excepción: ${e.message}`))
  page.on('console', (m) => { if (m.type() === 'error' && !IGNORAR.some((r) => r.test(m.text()))) errores.push(`consola: ${m.text().slice(0, 300)}`) })
  return errores
}

async function recorrer(page, errores, nombreRol) {
  const visitados = []
  for (const m of MODULOS) {
    const boton = page.locator('nav').getByRole('button', { name: m.menu, exact: true })
    if (!(await boton.count())) continue // un rol no ve todos los módulos
    const antes = errores.length
    await boton.first().click()
    // Cargó: hay un título (el propio del módulo o cualquiera) y el menú sigue respondiendo.
    const titulo = m.titulo ? page.locator('main').getByRole('heading', { name: m.titulo, level: 1 }) : page.locator('main').getByRole('heading').first()
    await expect(titulo.first(), `${nombreRol}: «${m.menu}» no cargó (el menú no cambió de módulo)`).toBeVisible({ timeout: 20_000 })
    for (const pestana of m.pestanas || []) {
      await page.locator('main').getByRole('tab', { name: new RegExp(`^${pestana}`) }).click()
      await expect(page.locator('main').getByRole('tab', { name: new RegExp(`^${pestana}`) }), `${nombreRol}: pestaña «${pestana}» de ${m.menu}`).toHaveAttribute('aria-selected', 'true')
      await page.waitForTimeout(400)
    }
    await page.waitForTimeout(500)
    expect(errores.slice(antes), `${nombreRol}: errores en la consola al abrir «${m.menu}»`).toEqual([])
    visitados.push(m.menu)
  }
  return visitados
}

test('administrador: recorre todos los módulos del menú sin errores en la consola', async ({ page }) => {
  const errores = vigilar(page)
  await iniciarSesion(page, 'ADMIN')
  await expect(page.locator('nav').getByRole('button', { name: 'Inicio', exact: true })).toBeVisible({ timeout: 20_000 })
  const visitados = await recorrer(page, errores, 'administrador')
  expect(visitados).toEqual(MODULOS.map((m) => m.menu).filter((m) => m !== 'Mi horario')) // el administrador ve los once (su «Horario» y no «Mi horario»)
  // Volver al primero: el menú sigue respondiendo después de todo el recorrido.
  await page.locator('nav').getByRole('button', { name: 'Citas médicas', exact: true }).click()
  await expect(page.locator('main').getByRole('heading', { name: 'Citas médicas', level: 1 })).toBeVisible()
  expect(errores).toEqual([])
})

test('optómetra: recorre los módulos de su menú sin errores en la consola', async ({ page }) => {
  const errores = vigilar(page)
  await iniciarSesion(page, 'OPTOMETRA')
  await expect(page.locator('nav').getByRole('button', { name: 'Inicio', exact: true })).toBeVisible({ timeout: 20_000 })
  const visitados = await recorrer(page, errores, 'optómetra')
  expect(visitados.length).toBeGreaterThanOrEqual(3)
  expect(visitados).toContain('Pacientes')
  expect(errores).toEqual([])
})

// El perfil del paciente no deja al menú «pegado»: desde ahí, cada módulo se abre.
test('administrador: desde el perfil de un paciente el menú sigue cambiando de módulo', async ({ page }) => {
  const errores = vigilar(page)
  await iniciarSesion(page, 'ADMIN')
  await page.locator('nav').getByRole('button', { name: 'Pacientes', exact: true }).click()
  await page.locator('main').getByRole('button', { name: 'Ver perfil 360°' }).first().click()
  await expect(page.locator('main').getByRole('tab', { name: /^Resumen/ })).toBeVisible({ timeout: 20_000 })
  for (const m of MODULOS.filter((x) => x.titulo && x.menu !== 'Pacientes')) {
    await page.locator('nav').getByRole('button', { name: m.menu, exact: true }).click()
    await expect(page.locator('main').getByRole('heading', { name: m.titulo, level: 1 }).first(), `desde el perfil, «${m.menu}» no abrió`).toBeVisible({ timeout: 20_000 })
    await page.locator('nav').getByRole('button', { name: 'Pacientes', exact: true }).click()
    await page.locator('main').getByRole('button', { name: 'Ver perfil 360°' }).first().click()
    await expect(page.locator('main').getByRole('tab', { name: /^Resumen/ })).toBeVisible({ timeout: 20_000 })
  }
  expect(errores).toEqual([])
})

// Una dirección con la ruta «//» (por ejemplo «//?optica=…») el navegador la entiende como otro origen: antes, pushState lanzaba SecurityError y el menú no navegaba.
test('administrador: entrando por «//?optica=…» el menú sigue navegando', async ({ page }) => {
  const errores = vigilar(page)
  await iniciarSesion(page, 'ADMIN')
  await page.goto(`http://127.0.0.1:${process.env.E2E_PUERTO || '5180'}//?optica=qu7u2j&seccion=pacientes`)
  await expect(page.locator('nav').getByRole('button', { name: 'Inicio', exact: true })).toBeVisible({ timeout: 25_000 })
  for (const m of MODULOS.filter((x) => x.titulo)) {
    await page.locator('nav').getByRole('button', { name: m.menu, exact: true }).click()
    await expect(page.locator('main').getByRole('heading', { name: m.titulo, level: 1 }).first(), `con «//», «${m.menu}» no abrió`).toBeVisible({ timeout: 20_000 })
  }
  expect(page.url()).not.toMatch(/127\.0\.0\.1:\d+\/\/\?/)
  expect(errores).toEqual([])
})
