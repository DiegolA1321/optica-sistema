// Corregir y anular un abono desde la pantalla, en la óptica de pruebas (crea sus propios datos con el prefijo "E Dos E ").
// La base lo vuelve a exigir (nivel "editar" de Ventas, motivo obligatorio) y el registro del pago nunca se borra.
import { test, expect } from '@playwright/test'
import { iniciarSesion, credencial, nombrePrueba, cedulaValida, telefonoPrueba, PREFIJO } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'serial' })

const nombre = nombrePrueba()

// Un paciente de prueba, creado con la sesión de Recepción (igual que otras pruebas).
async function crearPaciente() {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión de Recepción para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const hoy = new Date()
  const iso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const { error: e2 } = await cliente.from('pacientes').insert({
    optica_id: perfil.optica_id, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
    evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: iso, estado_clinico: 'Activo',
  })
  if (e2) throw new Error(`No se pudo crear el paciente de prueba: ${e2.message}`)
}

async function abrirComprobante(page) {
  await page.getByRole('tab', { name: /Comprobantes/ }).click()
  await page.getByLabel(/Buscar: paciente/).fill(nombre)
  await page.getByRole('button', { name: /Ver el comprobante/ }).first().click()
  return page.getByRole('dialog', { name: /^Comprobante CV-/ })
}

test('1 · Vera vende $100 con un abono inicial de $60', async ({ page }) => {
  await crearPaciente()
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('button', { name: 'Nueva venta' }).first().click()
  const venta = page.getByRole('dialog').last()
  await venta.getByLabel('Paciente').fill(nombre)
  await venta.getByRole('button', { name: new RegExp(nombre) }).click()
  await venta.getByRole('button', { name: 'Servicio', exact: true }).click()
  await venta.getByPlaceholder(/Descripción del servicio/).fill(PREFIJO + 'Servicio')
  await venta.getByPlaceholder('0.00').fill('100')
  await venta.getByRole('button', { name: /Agregar línea/ }).click()
  await venta.getByRole('button', { name: 'Abonos', exact: true }).click()
  await venta.locator('#abono-inicial').fill('60')
  await venta.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(venta).toHaveCount(0, { timeout: 20_000 })
})

test('2 · Corregir el abono: pide el motivo, recalcula el saldo y conserva el valor original', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  const detalle = await abrirComprobante(page)
  await expect(detalle).toContainText('Con saldo $40.00')
  await detalle.getByRole('button', { name: /Corregir el abono de \$60\.00/ }).click()
  const corregir = page.getByRole('dialog', { name: 'Corregir abono' })
  await corregir.getByLabel(/^Monto \*/).fill('45')
  // Sin motivo no se guarda.
  await corregir.getByRole('button', { name: 'Guardar corrección' }).click()
  await expect(corregir.getByRole('alert')).toContainText('motivo de la corrección')
  await corregir.getByLabel(/Motivo de la corrección/).fill(PREFIJO + 'se escribió mal el monto')
  await expect(corregir).toContainText('el saldo de la venta queda en $55.00')
  await corregir.getByRole('button', { name: 'Guardar corrección' }).click()
  await expect(corregir).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('Abono corregido. El saldo de la venta se recalculó.')).toBeVisible({ timeout: 15_000 })
  // El detalle muestra el abono corregido, su valor original y el saldo nuevo.
  await expect(detalle).toContainText('Con saldo $55.00', { timeout: 15_000 })
  await expect(detalle).toContainText('Corregido · antes $60.00')
  await expect(detalle).toContainText(/Se corrigió un abono de \$60\.00 a \$45\.00/)
})

test('3 · Anular el abono: queda marcado (no se borra), no cuenta y se ve aparte en Cobrado hoy', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  const detalle = await abrirComprobante(page)
  await detalle.getByRole('button', { name: /Corregir el abono de \$45\.00/ }).click()
  const corregir = page.getByRole('dialog', { name: 'Corregir abono' })
  await corregir.getByRole('button', { name: 'Anular este abono' }).click()
  await expect(corregir.getByRole('alert')).toContainText('motivo de la anulación')
  await corregir.getByLabel(/Motivo de la corrección/).fill(PREFIJO + 'se registró en la venta equivocada')
  await corregir.getByRole('button', { name: 'Anular este abono' }).click()
  await expect(corregir).toHaveCount(0, { timeout: 20_000 })
  await expect(page.getByText('Abono anulado. El saldo de la venta se recalculó.')).toBeVisible({ timeout: 15_000 })
  // La venta vuelve a deber todo; el abono anulado sigue a la vista, tachado, con su motivo.
  await expect(detalle).toContainText('Con saldo $100.00', { timeout: 15_000 })
  await expect(detalle).toContainText(/Abono anulado el .* por /)
  await expect(detalle).toContainText('se registró en la venta equivocada')
  await expect(detalle.getByRole('button', { name: /Corregir el abono/ })).toHaveCount(0) // ya no se puede corregir
  await page.keyboard.press('Escape')
  // Cobrado hoy no suma el abono anulado y lo muestra aparte.
  await page.getByRole('tab', { name: /Cobros y saldos/ }).click()
  const anulados = page.getByRole('list', { name: 'Abonos anulados de ese día' })
  await expect(anulados).toContainText(nombre.split(' ').slice(0, 2).join(' '))
  await expect(anulados).toContainText('$45.00')
  const cobros = page.getByRole('list', { name: 'Cobros del día' })
  await expect(cobros.getByRole('listitem').filter({ hasText: nombre })).toHaveCount(0)
})
