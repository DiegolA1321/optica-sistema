// Correcciones de la auditoría transversal (16 oct. 2026). Solo lectura: la Demo, la óptica vacía y el paciente fijo del portal de la óptica de pruebas.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
const ir = async (page, modulo) => { await page.getByRole('button', { name: modulo, exact: true }).first().click(); await page.waitForTimeout(1500) }

async function entrar(page, slug, correo, clave) {
  await page.goto(`/?optica=${slug}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), correo)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), clave)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0, { timeout: 25_000 })
}

test('Usuarios: ningún rol dice "administración delegada" por tener Soporte, y el Optómetra ya no tiene Ventas', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await ir(page, 'Usuarios y permisos')
  await expect(page.getByText(/administración delegada/)).toHaveCount(0)
  const tarjeta = page.locator('li').filter({ hasText: 'Paula Optómetra Demo' })
  await expect(tarjeta.getByText(/Ventas ·/)).toHaveCount(0)
  await expect(tarjeta.getByText('Mi horario · su agenda y su propio horario')).toBeVisible()
})

test('Ventas (citas solo ver): el detalle de la cita no ofrece editar ni cancelar', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS')
  await ir(page, 'Citas médicas')
  await page.getByTitle('Ver el detalle de la cita').first().click()
  const detalle = page.getByRole('dialog')
  await expect(detalle.getByRole('button', { name: 'Cerrar' }).first()).toBeVisible()
  await expect(detalle.getByRole('button', { name: /Editar cita|Cancelar cita|Dejar de atender|Cobrar/ })).toHaveCount(0)
})

test('Optómetra: sin Ventas, sin filtros de saldos y el Optómetra no recibe dinero', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  await expect(page.getByRole('button', { name: /^Ventas/ })).toHaveCount(0)
  await ir(page, 'Pacientes')
  await expect(page.getByText('Las visitas, los controles y los contactos son de tus pacientes y de tus citas')).toBeVisible()
  await expect(page.getByRole('button', { name: /Pagos pendientes|Consultaron y no compraron/ })).toHaveCount(0)
  await ir(page, 'Inventario')
  await expect(page.getByRole('button', { name: /^Sin venderse/ })).toHaveCount(0)
})

test('Optómetra: el perfil del paciente muestra lo que compró (producto y fecha) sin ningún monto', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await ir(page, 'Pacientes')
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill('E Dos E Portal Auditoria')
  await page.locator('main').getByRole('button', { name: 'Ver perfil 360°' }).first().click()
  await page.getByRole('tab', { name: /^Compras/ }).click()
  const compras = page.getByRole('region', { name: 'Compras del paciente' })
  await expect(compras).toContainText('E Dos E Servicio portal')
  await expect(compras).toContainText('16 oct 2026')
  await expect(compras.getByText(/\$\s?\d/)).toHaveCount(0)
  await expect(page.getByText(/Debe|Saldo pendiente/)).toHaveCount(0)
})

test('La óptica nueva y vacía: catálogos con tildes, "Para empezar", sin actividad ajena y pantallas vacías con su acción', async ({ page }) => {
  await entrar(page, '3pldf1', process.env.VACIA_ADMIN_EMAIL, process.env.VACIA_ADMIN_PASSWORD)
  await expect(page.getByRole('heading', { name: 'Para empezar' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/Sistema cambió los permisos|creó un rol/)).toHaveCount(0)
  await ir(page, 'Citas médicas')
  await expect(page.getByText('Todavía no hay citas')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gestionar cita' }).first()).toBeVisible()
  await ir(page, 'Pacientes')
  await expect(page.getByText('Aún no hay pacientes registrados.')).toBeVisible()
  await expect(page.getByText(/Visitas recientes|Pagos pendientes/)).toHaveCount(0)
  await ir(page, 'Inventario')
  await expect(page.getByRole('button', { name: 'Conteo físico' })).toHaveCount(0)
  await ir(page, 'Configuración')
  await page.getByRole('tab', { name: /Catálogos/ }).click()
  await expect(page.getByText('Adaptación de Lentes').first()).toBeVisible()
  await expect(page.getByText('Garantía / Ajuste').first()).toBeVisible()
  await expect(page.getByText('Sin alteración refractiva').first()).toBeVisible()
})

test('Portal: el saldo se avisa en el Resumen y en Mis compras, con la factura para descargar', async ({ page }) => {
  await entrar(page, 'v8twzq', process.env.E2E_PORTAL_CEDULA, process.env.E2E_PORTAL_CLAVE)
  await expect(page.getByText('Saldo por pagar')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('$40.00').first()).toBeVisible()
  await page.getByRole('button', { name: 'Mis compras', exact: true }).first().click()
  await expect(page.getByText(/Debes \$40\.00/)).toBeVisible()
  await expect(page.getByRole('button', { name: /Factura \(PDF\)/ })).toBeVisible()
  await page.getByRole('button', { name: 'Mis datos', exact: true }).first().click()
  await expect(page.getByText(/Avisos de tu control y de tus citas/)).toBeVisible()
})
