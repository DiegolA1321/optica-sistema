// Detalle de la cita (8 oct): el estado va en la cabecera, una cita "Por registrar" se registra desde el detalle sin cambiar su
// estado, y una cita Atendida también ofrece "Agendar otra cita". ESCRIBE datos: corre en la óptica de pruebas (E2E).
import { test, expect } from '@playwright/test'
import { iniciarSesion, credencial, cedulaValida, telefonoPrueba, nombrePrueba } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function crearCita({ estado, motivo }) {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión de Recepción para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const nombre = nombrePrueba()
  const cedula = cedulaValida()
  let ultimo
  for (let i = 0; i < 40; i++) {
    ;({ error: ultimo } = await cliente.from('citas').insert({
      optica_id: perfil.optica_id, paciente: nombre, cedula, telefono: telefonoPrueba(), fecha: '2026-01-05',
      hora: `${String(1 + (i % 11)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')} PM`, motivo, estado,
    }))
    if (!ultimo || ultimo.code !== '23505') break
  }
  if (ultimo) throw new Error('No se pudo crear la cita de prueba: ' + ultimo.message)
  return { nombre, cedula }
}

async function abrirDetalle(page, nombre) {
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  await page.getByTitle('Ver el detalle de la cita').first().click()
  return page.getByRole('dialog')
}

test('Por registrar: el detalle ofrece "Registrar paciente" y vincula sin cambiar el estado; el estado va en la cabecera', async ({ page }) => {
  const { nombre } = await crearCita({ estado: 'No Asistió', motivo: 'Consulta General' })
  await iniciarSesion(page, 'ADMIN', 'E2E')
  let detalle = await abrirDetalle(page, nombre)
  await expect(detalle.getByRole('status', { name: 'Estado: No asistió' })).toBeVisible()
  await expect(detalle.getByRole('region', { name: 'Cambiar el estado de la cita' })).toHaveCount(0)
  await detalle.getByRole('button', { name: 'Registrar paciente' }).click()

  const registro = page.getByRole('dialog', { name: 'Registrar paciente' })
  await expect(registro).toBeVisible()
  await expect(registro.getByText('Quedará vinculado a esta cita.')).toBeVisible()
  await registro.getByRole('button', { name: 'Registrar paciente' }).click()
  await expect(page.getByText('Paciente registrado y vinculado a la cita.')).toBeVisible({ timeout: 15_000 })

  detalle = await abrirDetalle(page, nombre)
  await expect(detalle.getByRole('status', { name: 'Estado: No asistió' })).toBeVisible()
  await expect(detalle.getByRole('button', { name: 'Registrar paciente' })).toHaveCount(0)
  await expect(detalle.getByRole('link', { name: 'Ver perfil' })).toBeVisible()
})

test('Una cita Atendida también ofrece "Agendar otra cita"', async ({ page }) => {
  const { nombre } = await crearCita({ estado: 'Atendida', motivo: 'Consulta General' })
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const detalle = await abrirDetalle(page, nombre)
  await expect(detalle.getByRole('status', { name: 'Estado: Atendida' })).toBeVisible()
  await expect(detalle.getByRole('button', { name: 'Agendar otra cita' })).toBeVisible()
})
