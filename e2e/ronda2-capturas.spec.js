// Capturas de la Ronda 2 a 1093 px (laptop con la escala del 125 %): Citas en Lista, Semana y Mes (con canceladas y no efectuadas visibles), el detalle de una cita en cada
// estado, la ventana de inactividad, el Inicio de cada perfil y una lista de «Requiere tu atención». Solo corre con E2E_CAPTURAS=1; siembra sus propios datos
// («E Dos E Captura …») en la óptica de pruebas, que la limpieza global quita antes de la siguiente corrida.
//   E2E_CAPTURAS=1 npx playwright test e2e/ronda2-capturas.spec.js
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, credencial, cedulaValida, telefonoPrueba, prepararAvisosInicio } from './ayudas.js'

const CARPETA = process.env.E2E_CAPTURAS_DIR || 'docs/ronda2-capturas'
test.skip(!process.env.E2E_CAPTURAS, 'solo con E2E_CAPTURAS=1')
test.use({ viewport: { width: 1093, height: 768 } })
test.describe.configure({ mode: 'serial' })

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const mas = (dias) => { const d = new Date(); d.setDate(d.getDate() + dias); return iso(d) }
const foto = async (page, nombre) => { fs.mkdirSync(CARPETA, { recursive: true }); await page.waitForTimeout(400); await page.screenshot({ path: `${CARPETA}/${nombre}.png` }) }

const NOMBRES = {}
test.beforeAll(async () => {
  await prepararAvisosInicio('E2E')
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('ADMIN', 'E2E')
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: s, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del administrador')
  const { data: perfil } = await c.from('perfiles').select('optica_id').eq('id', s.user.id).single()
  const { data: equipo } = await c.rpc('equipo_optica')
  const paula = (equipo || []).find((m) => /Paula/.test(m.nombre))
  const hoy = mas(0)
  // [clave, nombre, fecha, hora, estado, extra]
  const s_user = s.user.id
  const filas = [
    ['atendida', 'Ana Atendida', hoy, '09:00 AM', 'Atendida'],
    ['noefectuada', 'Nora No Efectuada', hoy, '10:00 AM', 'No Asistió'],
    ['cancelada', 'Carla Cancelada', hoy, '11:00 AM', 'Cancelada', { cancelada_por: 'paciente' }],
    ['atencion', 'Elena En Atención', hoy, '12:00 PM', 'En Atención', { atendido_por: s.user.id }],
    ['espera', 'Eva En Espera', hoy, '01:20 PM', 'En Espera', { asignado_a: paula?.id }],
    ['pendiente', 'Paula Pendiente', hoy, '03:20 PM', 'Pendiente', { asignado_a: paula?.id }],
    ['pendiente2', 'Pedro Pendiente', hoy, '04:20 PM', 'Pendiente'],
    ['manana', 'Mario Mañana', mas(1), '09:40 AM', 'Pendiente'],
    ['manana2', 'Marta Mañana', mas(1), '10:20 AM', 'Cancelada', { cancelada_por: 'recepcion' }],
    ['semana', 'Sara Semana', mas(3), '03:00 PM', 'Pendiente'],
    ['semana2', 'Saúl Semana', mas(2), '11:00 AM', 'No Asistió'],
    ['mes', 'Mía Mes', mas(10), '10:00 AM', 'Pendiente'],
  ]
  for (const [clave2, nombre, fecha, hora, estado, extra = {}] of filas) {
    const nombreCompleto = `E Dos E Captura ${nombre}`
    NOMBRES[clave2] = nombreCompleto
    const { data: p, error: ep } = await c.from('pacientes').insert({ optica_id: perfil.optica_id, nombre: nombreCompleto, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15', evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoy, estado_clinico: 'Activo' }).select().single()
    if (ep) throw new Error(ep.message)
    const { error: ec } = await c.from('citas').insert({ optica_id: perfil.optica_id, paciente_id: p.id, paciente: nombreCompleto, cedula: p.cedula, telefono: p.telefono, fecha, hora, motivo: 'Consulta General', estado, ...extra })
    if (ec) throw new Error(`${nombre}: ${ec.message}`)
  }
})

test('Citas: Lista, Semana y Mes con canceladas y no efectuadas visibles', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await expect(page.getByText(NOMBRES.pendiente).first()).toBeVisible({ timeout: 20_000 })
  await foto(page, 'citas-lista')
  await page.getByRole('button', { name: /Calendario/ }).click()
  await foto(page, 'citas-calendario-menu')
  await page.getByRole('menuitemradio', { name: /Semana/ }).click()
  await expect(page.getByText(NOMBRES.pendiente).first()).toBeVisible({ timeout: 20_000 })
  await foto(page, 'citas-semana')
  await page.getByRole('button', { name: /Calendario/ }).click()
  await page.getByRole('menuitemradio', { name: /Mes/ }).click()
  await page.waitForTimeout(600)
  await foto(page, 'citas-mes')
  // Rango: el periodo único de la barra
  await page.getByRole('button', { name: 'Lista', exact: true }).click()
  await page.getByRole('button', { name: /^Rango/ }).click()
  await foto(page, 'citas-lista-rango')
})

test('Detalle de la cita en cada estado', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await expect(page.getByText(NOMBRES.pendiente).first()).toBeVisible({ timeout: 20_000 })
  for (const [clave, archivo] of [['pendiente', 'pendiente'], ['espera', 'en-espera'], ['atencion', 'en-atencion'], ['atendida', 'atendida'], ['noefectuada', 'no-efectuada'], ['cancelada', 'cancelada']]) {
    await page.getByRole('button', { name: NOMBRES[clave], exact: true }).first().click()
    await expect(page.getByRole('dialog').getByRole('heading', { name: NOMBRES[clave] })).toBeVisible()
    await foto(page, `detalle-${archivo}`)
    await page.keyboard.press('Escape')
  }
})

test('Inicio de cada perfil y una lista de «Requiere tu atención»', async ({ page, context }) => {
  for (const [cuenta, archivo] of [['ADMIN', 'admin'], ['OPTOMETRA', 'optometra'], ['RECEPCION', 'recepcion'], ['VENTAS', 'ventas']]) {
    await iniciarSesion(page, cuenta, 'E2E')
    await expect(page.locator('main').first().getByRole('region', { name: /Totales|Desenlace de mis citas|Desenlace de las citas|Para vender/ }).first()).toBeVisible({ timeout: 20_000 })
    await foto(page, `inicio-${archivo}`)
    if (cuenta === 'ADMIN') {
      await page.getByRole('region', { name: 'Requiere tu atención: Inventario' }).getByRole('button', { name: /stock bajo/ }).first().click()
      await foto(page, 'requiere-atencion-lista')
      await page.keyboard.press('Escape')
    }
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await context.clearCookies()
    await page.goto('about:blank')
  }
})

test('La ventana de inactividad', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await expect(page.locator('main').first().getByRole('region', { name: 'Totales' })).toBeVisible({ timeout: 20_000 })
  await page.clock.install()
  await page.clock.fastForward('29:30')
  await expect(page.getByRole('dialog', { name: '¿Sigues ahí?' })).toBeVisible()
  await foto(page, 'ventana-inactividad')
})
