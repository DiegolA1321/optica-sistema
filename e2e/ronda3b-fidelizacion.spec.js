// Ronda 3b (21 oct. 2026): el programa de fidelización (configurable en Configuración, visible en el Resumen del paciente y como descuento sugerido en «Nueva venta» solo para quien puede hacer descuentos),
// el alta rápida de paciente desde Citas con tipo de documento (pasaporte) y el «Enviar mensaje» del perfil, que queda en el Seguimiento del CRM. Óptica de pruebas (E2E). Sin capturas.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, nombrePrueba, telefonoPrueba, credencial, crearCitaDeHoyParaPaula, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 800 }, actionTimeout: 15_000 })
test.describe.configure({ mode: 'serial' })

const irA = (page, modulo) => page.getByRole('button', { name: modulo, exact: true }).first().click()
const bd = async (fn) => { const c = new pg.Client(); await c.connect(); try { return await fn(c) } finally { await c.end() } }

let nombre = ''
let pacienteId = ''
let opticaId = ''
let permisosVentas = {}

async function sesion(prefijo) {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial(prefijo, 'E2E')
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión de ' + prefijo)
  const { data: perfil } = await c.from('perfiles').select('optica_id').eq('id', data.user.id).single()
  return { c, perfil }
}

test.beforeAll(async () => {
  nombre = await crearCitaDeHoyParaPaula('E2E')
  const opto = await sesion('OPTOMETRA')
  opticaId = opto.perfil.optica_id
  const { data: p } = await opto.c.from('pacientes').select('id').eq('nombre', nombre).single()
  pacienteId = p.id
  // Tres consultas anteriores = 30 puntos con la regla por defecto: nivel «Frecuente» (desde 30, 5 % de descuento sugerido)
  for (const fecha of ['2026-05-10', '2026-06-10', '2026-07-10']) {
    const { error } = await opto.c.from('consultas').insert({
      optica_id: opticaId, paciente_id: pacienteId, paciente: nombre, fecha, motivo: 'Consulta General', usa_lentes: false, antecedentes: '', alergias: '', antecedentes_familiares: '',
      datos_clinicos: { od: { esfera: '-1.00', cilindro: '', eje: '' }, oi: { esfera: '-1.00', cilindro: '', eje: '' }, medidas: {}, examen: {} },
      diagnostico: 'Miopía', diagnostico_categorias: ['Miopía'], lente_recomendado: '', indicaciones: '', proximo_control_dias: 180, estado_correccion: 'Sin evaluar', evolucion_calculada: 'Primera consulta',
    })
    if (error) throw new Error('No se pudo crear la consulta anterior: ' + error.message)
  }
  // El permiso de descuentos en Ventas de cada rol (lo que decide quién ve la sugerencia)
  const admin = await sesion('ADMIN')
  const { data: roles } = await admin.c.from('roles').select('nombre, permisos')
  permisosVentas = Object.fromEntries((roles || []).map((r) => [r.nombre, (r.permisos?.ventas || []).includes('editar')]))
})

test.afterAll(async () => {
  // La configuración de fidelización vuelve a la regla por defecto
  await bd((c) => c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) - 'fidelizacion' where slug = $1", [SLUG_PRUEBAS]))
})

async function abrirPerfil(page, quien) {
  await irA(page, 'Pacientes')
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(quien)
  await expect(page.getByText(quien).first()).toBeVisible({ timeout: 45_000 })
  await page.getByText(quien).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
}

test('el Resumen del paciente muestra su fidelización (nivel, puntos, referidos y cumpleaños) en un bloque compacto', async ({ page }) => {
  test.setTimeout(120_000)
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirPerfil(page, nombre)
  await page.getByRole('tab', { name: /Resumen/ }).click()
  const fid = page.getByRole('region', { name: 'Fidelización' })
  await expect(fid).toContainText('Frecuente · 30 pts')
  await expect(fid).toContainText('Faltan 60 para Preferente (10 % de descuento)')
  await expect(fid).toContainText('Referidos')
  await expect(fid).toContainText('Cumpleaños del paciente')
  await expect(fid).toContainText('15 de mayo')
  await expect(fid).toContainText(/Cumplirá \d+ · en \d+ días?|Cumple \d+ · hoy/) // «Cumplirá 37 · en 204 días»
  // El Resumen ya no repite lo que tienen otras pestañas
  await expect(page.getByRole('region', { name: 'Información clínica' })).toHaveCount(0)
  // Un punto de más con la regla configurable: se explica de dónde salen los puntos
  await fid.getByText('Frecuente · 30 pts').click()
  await expect(page.getByRole('dialog')).toContainText('Consulta del')
  await expect(page.getByRole('dialog')).toContainText('+10')
})

for (const rol of ['ADMIN', 'RECEPCION', 'VENTAS']) {
  test(`${rol}: «Nueva venta» sugiere el descuento del nivel solo si el rol puede hacer descuentos en Ventas`, async ({ page }) => {
    test.setTimeout(120_000)
    await iniciarSesion(page, rol, 'E2E')
    await abrirPerfil(page, nombre)
    await page.getByRole('tab', { name: /Compras/ }).click()
    // Sin compras: el botón está en el centro del mensaje vacío
    await page.getByRole('button', { name: 'Nueva venta' }).first().click()
    const venta = page.getByRole('dialog').last()
    await venta.getByRole('button', { name: 'Luna', exact: true }).click()
    await venta.getByLabel('Material').fill('CR-39').catch(async () => { await venta.getByLabel('Material').selectOption({ index: 1 }) })
    await venta.getByLabel('Precio de la luna').fill('100')
    await venta.getByRole('button', { name: /Agregar luna/ }).click()
    const sugerencia = venta.getByText('Frecuente · 5 % sugerido')
    const permiso = Object.entries(permisosVentas).find(([n]) => n.toLowerCase().startsWith(rol === 'ADMIN' ? 'admin' : rol === 'RECEPCION' ? 'recep' : 'venta'))?.[1]
    if (rol === 'ADMIN' || permiso) {
      await expect(sugerencia).toBeVisible()
      await venta.getByRole('button', { name: 'Aplicar descuento' }).click()
      await expect(venta.getByText('$95.00', { exact: true }).first()).toBeVisible()
      expect(await venta.locator('input').evaluateAll((els) => els.map((e) => e.value))).toContain('Fidelización: nivel Frecuente')
    } else {
      await expect(sugerencia).toHaveCount(0)
    }
    await page.keyboard.press('Escape')
  })
}

test('la configuración de fidelización cambia las cuentas en todos lados y vuelve a la regla por defecto', async ({ page }) => {
  test.setTimeout(150_000)
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Configuración')
  await page.getByRole('tab', { name: 'Fidelización' }).click()
  const panel = page.getByRole('region', { name: 'Programa de fidelización' })
  await expect(panel.getByLabel('Puntos por consulta')).toHaveValue('10')
  await expect(panel.getByLabel('Puntos por referido')).toHaveValue('15')
  await expect(panel.getByLabel('Dólares por punto')).toHaveValue('10')
  for (const n of ['Nuevo', 'Frecuente', 'Preferente']) await expect(panel.getByLabel(`Nombre del nivel ${['Nuevo', 'Frecuente', 'Preferente'].indexOf(n) + 1}`)).toHaveValue(n)
  // Un valor inválido no se puede guardar
  await panel.getByLabel('Puntos por consulta').fill('-1')
  await expect(panel.getByRole('button', { name: /Guardar/ })).toBeDisabled()
  // 12 puntos por consulta: el paciente con 3 consultas pasa de 30 a 36
  await panel.getByLabel('Puntos por consulta').fill('12')
  await panel.getByRole('button', { name: /Guardar/ }).click()
  await expect(page.getByText(/fidelización.*guardad|guardad.*fidelización/i).first()).toBeVisible({ timeout: 15_000 })
  await irA(page, 'Pacientes')
  await abrirPerfil(page, nombre)
  await page.getByRole('tab', { name: /Resumen/ }).click()
  await expect(page.getByRole('region', { name: 'Fidelización' })).toContainText('Frecuente · 36 pts', { timeout: 20_000 })
  // El CRM usa la misma cuenta
  await irA(page, 'CRM y fidelización')
  await page.getByRole('tab', { name: /Fidelización/ }).click()
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('main')).toContainText('36')
  // Vuelve a la regla por defecto
  await irA(page, 'Configuración')
  await page.getByRole('tab', { name: 'Fidelización' }).click()
  await page.getByRole('region', { name: 'Programa de fidelización' }).getByRole('button', { name: /Volver a los valores iniciales/ }).click()
  await page.getByRole('region', { name: 'Programa de fidelización' }).getByRole('button', { name: /Guardar/ }).click()
  await expect(page.getByRole('region', { name: 'Programa de fidelización' }).getByLabel('Puntos por consulta')).toHaveValue('10', { timeout: 15_000 })
})

test('alta rápida desde Citas: pide el tipo de documento, y un pasaporte se guarda como pasaporte', async ({ page }) => {
  test.setTimeout(150_000)
  const extranjero = nombrePrueba()
  const pasaporte = 'PA' + Math.floor(1000000 + Math.random() * 8999999)
  await iniciarSesion(page, 'RECEPCION', 'E2E')
  await irA(page, 'Citas médicas')
  await page.getByRole('button', { name: 'Gestionar cita' }).first().click()
  const form = page.getByRole('dialog')
  await form.getByRole('button', { name: 'Añadir nuevo paciente' }).click()
  await form.getByPlaceholder('Nombre completo').fill(extranjero)
  // Cédula: con dígito verificador (una inválida se rechaza)
  await form.getByPlaceholder('Cédula').fill('1234567890')
  await form.getByPlaceholder('Teléfono').fill(telefonoPrueba())
  await form.getByRole('button', { name: 'Registrar y seleccionar' }).click()
  await expect(form.getByText(/Esa cédula no es válida/)).toBeVisible()
  // Pasaporte: sin dígito verificador
  await form.getByLabel('Tipo de documento').selectOption('pasaporte')
  await form.getByPlaceholder('Pasaporte').fill(pasaporte)
  await form.getByRole('button', { name: 'Registrar y seleccionar' }).click()
  await expect(form.getByPlaceholder(/Escriba para buscar/)).toHaveValue(extranjero, { timeout: 15_000 })
  const recep = await sesion('RECEPCION')
  const { data: p } = await recep.c.from('pacientes').select('cedula, tipo_documento').eq('nombre', extranjero).single()
  expect(p).toMatchObject({ tipo_documento: 'pasaporte', cedula: pasaporte })
  await page.keyboard.press('Escape')
})

test('«Enviar mensaje» del perfil: lo escrito se manda por WhatsApp y queda en el Seguimiento del CRM', async ({ page }) => {
  test.setTimeout(150_000)
  await page.addInitScript(() => { window.open = (url) => { window.__abiertos = [...(window.__abiertos || []), String(url)]; return null } })
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirPerfil(page, nombre)
  await page.getByRole('button', { name: /Enviar mensaje/ }).first().click()
  const ventana = page.getByRole('dialog').last()
  await ventana.getByLabel('Mensaje').fill('Hola, te escribimos de la óptica para recordarte tu cita (E2E).')
  await ventana.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  const url = await page.evaluate(() => (window.__abiertos || []).at(-1))
  expect(decodeURIComponent(new URL(url).searchParams.get('text'))).toContain('Hola, te escribimos de la óptica')
  await irA(page, 'CRM y fidelización')
  await page.getByRole('tab', { name: /Historial de contactos/ }).click()
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText('Mensaje desde el perfil').first()).toBeVisible()
})
