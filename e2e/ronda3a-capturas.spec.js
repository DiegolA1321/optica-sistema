// Ronda 3a — capturas a 1093 px del perfil del paciente (Resumen, Citas, Diagnóstico con y sin refracción en sus dos vistas, y Compras con el estado de los lentes) y comprobación de lo que muestran.
// Crea en la óptica de pruebas un paciente «E Dos E ...» con dos consultas (una con refracción y otra sin ella), una compra con su orden de laboratorio y una cita. Se corre con E2E_CAPTURAS=1.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, credencial, nombrePrueba, cedulaValida, telefonoPrueba } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 768 } })

const hoyLocal = (dias = 0) => { const d = new Date(); d.setDate(d.getDate() + dias); return d.toLocaleDateString('en-CA') }
const foto = async (page, nombre) => {
  fs.mkdirSync('docs/ronda3a-capturas', { recursive: true })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `docs/ronda3a-capturas/${nombre}.png` })
}

async function sesionApi(prefijo) {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial(prefijo, 'E2E')
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('sesión ' + prefijo)
  const { data: perfil } = await c.from('perfiles').select('optica_id').eq('id', data.user.id).single()
  return { c, optica: perfil.optica_id, uid: data.user.id }
}

test('capturas del perfil: Resumen, Citas, Diagnóstico (con y sin refracción, dos vistas) y Compras con el estado de los lentes', async ({ page }) => {
  test.setTimeout(300_000)
  const admin = await sesionApi('ADMIN')
  const opto = await sesionApi('OPTOMETRA')
  const nombre = nombrePrueba()
  const { data: p, error: e0 } = await admin.c.from('pacientes').insert({ optica_id: admin.optica, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'captura@ejemplo.com', fecha_nacimiento: '1978-03-10', evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyLocal(-120), estado_clinico: 'Activo' }).select().single()
  if (e0) throw new Error(e0.message)
  const consulta = (fecha, datos, extra) => opto.c.from('consultas').insert({ optica_id: admin.optica, paciente_id: p.id, paciente: nombre, fecha, usa_lentes: true, datos_clinicos: datos, ...extra })
  let r = await consulta(hoyLocal(-100), {
    od: { esfera: '-1.25', cilindro: '-0.50', eje: '90', avSc: '20/40', avCc: '20/20', avRx: '20/20' }, oi: { esfera: '-1.00', cilindro: '-0.75', eje: '85', avSc: '20/50', avCc: '20/25', avRx: '20/20' },
    medidas: { adicion: '+1.00', dp: '62' }, examen: {}, ficha: { v: 2, anamnesis: { usaLentes: 'si' } },
  }, { motivo: 'Examen de Control', diagnostico: 'Miopía', diagnostico_categorias: ['Miopía'], lente_recomendado: 'Monofocal', indicaciones: 'Usa tus lentes todo el día. Control en 6 meses.', proximo_control_dias: 180, estado_correccion: 'Bien corregido', evolucion_calculada: 'Primera consulta' })
  if (r.error) throw new Error(r.error.message)
  r = await consulta(hoyLocal(-20), { od: { avSc: '20/20' }, oi: { avSc: '20/20' }, examen: { pioOd: '14', pioOi: '15' }, ficha: { v: 2, anamnesis: {} } },
    { motivo: 'Dolor de cabeza', diagnostico: 'Cefalea tensional', diagnostico_categorias: [], indicaciones: 'Descansar la vista cada hora. Tomar agua.', proximo_control_dias: 365, estado_correccion: 'Sin evaluar', evolucion_calculada: 'Sin cambios' })
  if (r.error) throw new Error(r.error.message)
  // una compra con lentes en proceso
  const { data: factura, error: ef } = await admin.c.rpc('crear_factura_venta', { p_optica_id: admin.optica, p_paciente_id: p.id, p_metodo_pago: 'directo', p_lineas: [{ tipo: 'servicio', descripcion: 'Lentes de captura', cantidad: 1, precio_unitario: 120 }], p_registrado_por: admin.uid })
  if (ef) throw new Error(ef.message)
  const facturaId = Array.isArray(factura) ? factura[0].id : factura.id
  const { error: eo } = await admin.c.rpc('crear_orden_laboratorio', { p_factura_id: facturaId, p_datos: { tipo_lente: 'monofocal', fecha_prometida: hoyLocal(5), laboratorio: 'Lab E Dos E' } })
  if (eo) throw new Error(eo.message)
  await admin.c.from('citas').insert({ optica_id: admin.optica, paciente_id: p.id, paciente: nombre, cedula: p.cedula, telefono: p.telefono, fecha: hoyLocal(-100), hora: '09:10 AM', motivo: 'Examen de Control', estado: 'Atendida' })
  await admin.c.from('citas').insert({ optica_id: admin.optica, paciente_id: p.id, paciente: nombre, cedula: p.cedula, telefono: p.telefono, fecha: hoyLocal(-20), hora: '09:20 AM', motivo: 'Dolor de cabeza', estado: 'Atendida' })
  await admin.c.from('citas').insert({ optica_id: admin.optica, paciente_id: p.id, paciente: nombre, cedula: p.cedula, telefono: p.telefono, fecha: hoyLocal(6), hora: '10:10 AM', motivo: 'Examen de Control', estado: 'Pendiente' })

  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(async () => {
    await page.getByText(nombre).first().click()
    await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 8_000 })
  }).toPass({ timeout: 60_000 })

  // Resumen: arriba los avisos (si los hay), la franja de datos, la última atención y la actividad, y al final la fidelización
  await expect(page.getByRole('region', { name: 'Datos del paciente' })).toBeVisible()
  await expect(page.getByText('Compras', { exact: true }).first()).toBeVisible()
  await foto(page, 'perfil-resumen-con-datos')

  // Citas
  await page.getByRole('tab', { name: /Citas/ }).click()
  await expect(page.getByRole('region', { name: 'Visitas por año' })).toBeVisible()
  await foto(page, 'perfil-citas-con-datos')

  // Diagnóstico: la consulta más reciente NO tuvo refracción
  await page.getByRole('tab', { name: /Diagnóstico/ }).click()
  await expect(page.getByText('Cefalea tensional').first()).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ojo derecho' })).toHaveCount(0)
  await expect(page.getByText('Refracción final')).toHaveCount(0)
  await foto(page, 'diagnostico-sin-refraccion-vista-tecnica')
  await page.getByRole('button', { name: 'Para el paciente' }).click()
  await expect(page.getByRole('region', { name: 'Lo que te indicó tu optómetra' })).toContainText('Descansar la vista')
  await foto(page, 'diagnostico-sin-refraccion-vista-paciente')
  // la consulta con refracción
  await page.getByRole('button', { name: 'Vista técnica' }).click()
  await page.locator('#diagnostico-consulta').click()
  await page.getByRole('option', { name: /Miopía/ }).click()
  await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('OD · Ojo derecho')
  await foto(page, 'diagnostico-con-refraccion-vista-tecnica')
  await page.getByRole('button', { name: 'Para el paciente' }).click()
  await expect(page.getByRole('region', { name: 'Ojo derecho' })).toContainText('Tienes miopía')
  await foto(page, 'diagnostico-con-refraccion-vista-paciente')

  // Compras: contenedor blanco con «Nueva venta» en su encabezado y el estado del pedido (En proceso, Listo, Entregado) dentro de la compra
  await page.getByRole('tab', { name: /Compras/ }).click()
  const compras = page.getByRole('region', { name: 'Compras del paciente' })
  await expect(compras).toBeVisible()
  await expect(compras.getByRole('button', { name: '+ Nueva venta' })).toBeVisible()
  await expect(compras.getByText('En proceso')).toBeVisible()
  const [bc, bn] = [await compras.boundingBox(), await compras.getByRole('button', { name: '+ Nueva venta' }).boundingBox()]
  expect(bn.y).toBeGreaterThanOrEqual(bc.y)
  expect(bn.y + bn.height).toBeLessThanOrEqual(bc.y + 80) // dentro del encabezado del contenedor
  await expect(page.getByRole('tab', { name: /Órdenes de laboratorio|Pedidos/ })).toHaveCount(0)
  await foto(page, 'perfil-compras')
})
