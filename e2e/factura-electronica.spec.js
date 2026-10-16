// La factura electrónica que la óptica emite por fuera: se registra (número, clave, fecha, PDF y XML), se descarga, se envía por WhatsApp y cada cosa queda
// registrada. En la óptica de pruebas (crea sus datos con el prefijo "E Dos E "). Necesita la migración 0110 aplicada.
import { test, expect } from '@playwright/test'
import { iniciarSesion, credencial, nombrePrueba, cedulaValida, telefonoPrueba, PREFIJO, elegirFecha } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'serial' })

const nombre = nombrePrueba()
let numeroCV = 0

const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
// Una clave de acceso válida (módulo 11) para la serie 001-001 y el secuencial dado.
function claveDe(secuencial) {
  const d = new Date()
  const fecha = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${d.getFullYear()}`
  const base = fecha + '01' + '1790000000001' + '1' + '001001' + String(secuencial).padStart(9, '0') + '12345678' + '1'
  let suma = 0, peso = 2
  for (let i = base.length - 1; i >= 0; i--) { suma += Number(base[i]) * peso; peso = peso === 7 ? 2 : peso + 1 }
  const v = 11 - (suma % 11)
  return base + (v === 11 ? 0 : v === 10 ? 1 : v)
}

async function crearPaciente() {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión de Recepción para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const { error: e2 } = await cliente.from('pacientes').insert({
    optica_id: perfil.optica_id, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
    evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyISO(), estado_clinico: 'Activo',
  })
  if (e2) throw new Error(`No se pudo crear el paciente de prueba: ${e2.message}`)
}

async function abrirComprobante(page) {
  await page.getByRole('tab', { name: /Comprobantes/ }).click()
  await page.getByLabel(/Buscar: paciente/).fill(nombre)
  await page.getByRole('button', { name: /Ver el comprobante/ }).first().click()
  return page.getByRole('dialog', { name: /^Comprobante CV-/ })
}

test('1 · Vera vende $50 de contado', async ({ page }) => {
  await crearPaciente()
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  await page.getByRole('button', { name: 'Nueva venta' }).first().click()
  const venta = page.getByRole('dialog').last()
  await venta.getByLabel('Paciente').fill(nombre)
  await venta.getByRole('button', { name: new RegExp(nombre) }).click()
  await venta.getByRole('button', { name: 'Servicio', exact: true }).click()
  await venta.getByPlaceholder(/Descripción del servicio/).fill(PREFIJO + 'Servicio')
  await venta.getByPlaceholder('0.00').fill('50')
  await venta.getByRole('button', { name: /Agregar línea/ }).click()
  await venta.getByRole('button', { name: 'Guardar venta' }).click()
  await expect(venta).toHaveCount(0, { timeout: 20_000 })
})

test('2 · Vera registra la factura electrónica: número, clave validada, fecha, PDF y XML', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  const detalle = await abrirComprobante(page)
  numeroCV = Number((await detalle.getAttribute('aria-label')).match(/CV-(\d+)/)[1])
  await expect(detalle).toContainText('todavía no tiene su factura electrónica registrada')
  await detalle.getByRole('button', { name: 'Registrar la factura electrónica' }).click()
  const modal = page.getByRole('dialog', { name: 'Factura electrónica (SRI)' })
  const numero = `001-001-${String(numeroCV).padStart(9, '0')}`
  const clave = claveDe(numeroCV)
  await modal.getByLabel('Número de la factura').fill(numero)
  // Una clave con el dígito verificador mal escrito se rechaza en el momento.
  await modal.getByLabel(/Clave de acceso/).fill(clave.slice(0, 48) + ((Number(clave[48]) + 1) % 10))
  await expect(modal.getByRole('alert').first()).toContainText('el dígito verificador debería ser')
  await modal.getByLabel(/Clave de acceso/).fill(clave)
  await expect(modal).toContainText(`coincide con el número ${numero}`)
  await elegirFecha(modal, 'fe-autorizada', hoyISO())
  // Un archivo que no es un PDF se rechaza al elegirlo.
  await modal.getByLabel('RIDE (PDF)').setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('esto no es un pdf') })
  await expect(modal).toContainText('Ese archivo no es un PDF válido.')
  await modal.getByLabel('RIDE (PDF)').setInputFiles({ name: 'ride.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n% E2E\n') })
  await modal.getByLabel('XML autorizado').setInputFiles({ name: 'factura.xml', mimeType: 'application/xml', buffer: Buffer.from(`<?xml version="1.0"?><factura><infoTributaria><claveAcceso>${clave}</claveAcceso></infoTributaria></factura>`) })
  await modal.getByRole('button', { name: 'Guardar', exact: true }).click()
  await expect(modal).toHaveCount(0, { timeout: 25_000 })
  await expect(page.getByText('Factura electrónica guardada.')).toBeVisible({ timeout: 15_000 })
  await expect(detalle).toContainText(numero, { timeout: 15_000 })
  await expect(detalle.getByRole('button', { name: /Descargar PDF \(RIDE\)/ })).toBeVisible({ timeout: 15_000 })
  await expect(detalle.getByRole('button', { name: /Descargar XML/ })).toBeVisible()
})

test('3 · Se descarga, se envía por WhatsApp con un enlace que vence, y queda registrado', async ({ page }) => {
  await iniciarSesion(page, 'VENTAS', 'E2E')
  await page.getByRole('button', { name: /^Ventas/ }).first().click()
  const detalle = await abrirComprobante(page)
  const [descarga] = await Promise.all([page.waitForEvent('download'), detalle.getByRole('button', { name: /Descargar PDF \(RIDE\)/ }).click()])
  expect(descarga.suggestedFilename()).toBe(`factura-001-001-${String(numeroCV).padStart(9, '0')}.pdf`)
  await expect(detalle).toContainText(/Último movimiento: .* descargó el PDF/, { timeout: 15_000 })
  await detalle.getByRole('button', { name: /Enviar al paciente/ }).click()
  await expect(detalle.getByRole('button', { name: /Por correo/ })).toBeDisabled()
  const [whatsapp] = await Promise.all([page.waitForEvent('popup'), detalle.getByRole('button', { name: /Por WhatsApp/ }).click()])
  const url = decodeURIComponent(whatsapp.url())
  expect(url).toMatch(/functions\/v1\/entregar-factura\?t=[0-9a-f]{48}/)
  expect(url).toContain('vencen en 7 días')
  await whatsapp.close()
  await expect(page.getByText(/abierta en WhatsApp\. Los enlaces vencen en 7 días/)).toBeVisible({ timeout: 15_000 })
})

// Desde el 16 oct. 2026 el Optómetra predefinido no tiene Ventas: ya no ve el módulo y el servidor no le entrega comprobantes ni archivos de
// factura electrónica (migración 0118). Que quien solo ve Ventas descarga y no registra ni envía lo cubren las pruebas de BloqueFacturaElectronica.
test('4 · El Optómetra no ve el módulo Ventas ni los comprobantes', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await expect(page.getByRole('button', { name: /^Ventas/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await expect(page.getByRole('button', { name: 'Nueva venta' })).toHaveCount(0)
})
