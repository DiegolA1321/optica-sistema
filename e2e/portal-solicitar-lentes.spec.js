// «Solicitar lentes nuevos» de punta a punta, en la óptica de pruebas (migración 0129): el paciente pide desde su portal; la solicitud llega a Ventas («Por vender», «Desde el portal») y al Inicio
// («Requiere tu atención»); el personal la toma («En atención») y la cierra («No compró»); y el paciente ve cada estado en su portal: Recibida · En atención · Atendida.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function entrarPaciente(page) {
  await page.goto(`/?optica=${SLUG_PRUEBAS}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Ej. 0912345678 o tu usuario'), process.env.E2E_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mis compras' })).toBeVisible()
}

test('el paciente solicita lentes, el personal la atiende y el paciente ve su estado', async ({ browser }) => {
  test.setTimeout(240_000)
  // Parte sin ninguna solicitud en curso del paciente fijo (una corrida cortada antes pudo dejarla): se cierran con la misma función de «No compró».
  {
    const { createClient } = await import('@supabase/supabase-js')
    const { credencial } = await import('./ayudas.js')
    const { correo, clave } = credencial('ADMIN', 'E2E')
    const limpio = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    await limpio.auth.signInWithPassword({ email: correo, password: clave })
    const { data: abiertas } = await limpio.from('pases_a_venta').select('id').is('consulta_id', null).neq('estado', 'descartado').neq('estado', 'vendido')
    for (const x of abiertas || []) await limpio.rpc('descartar_pase', { p_pase_id: x.id, p_motivo: 'otro', p_detalle: 'E2E limpieza' })
  }
  const portal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await entrarPaciente(portal)

  // 1. El paciente pide: una opción y un comentario. Sin elegir, no deja enviar.
  await portal.getByRole('button', { name: 'Solicitar lentes nuevos' }).click()
  const ventana = portal.getByRole('dialog', { name: 'Solicitar lentes nuevos' })
  await ventana.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(ventana.getByRole('alert')).toContainText('Elige qué te interesa.')
  await ventana.getByRole('radio', { name: /Lentes de sol/ }).click()
  await ventana.getByRole('textbox').fill('Los quiero con marco oscuro')
  await ventana.getByRole('button', { name: 'Enviar solicitud' }).click()
  await expect(ventana).toHaveCount(0, { timeout: 20_000 })
  const filaPaciente = portal.getByRole('list', { name: 'Tus solicitudes de lentes' }).getByRole('listitem').first()
  await expect(filaPaciente).toContainText('Lentes de sol')
  await expect(filaPaciente).toContainText('Recibida')
  await expect(portal.getByRole('button', { name: 'Solicitar lentes nuevos' })).toBeDisabled() // una sola en curso

  // 2. El personal la ve en el CRM (Para contactar: «Recibió su diagnóstico y no ha comprado», con «Pidió lentes desde su portal»)
  const personal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
  await iniciarSesion(personal, 'ADMIN', 'E2E')
  await personal.getByRole('button', { name: /^CRM y fidelización/ }).first().click()
  await personal.getByRole('tab', { name: /Para contactar/ }).click()
  const fila = personal.getByRole('listitem').filter({ hasText: 'E Dos E Portal Auditoria' }).filter({ has: personal.getByRole('button', { name: /^Contactar a / }) })
  await expect(fila).toContainText('Pidió lentes desde su portal', { timeout: 20_000 })
  await expect(fila).toContainText('Por vender')

  // 3. La solicitud pasa a «En atención» (la función que usa el sistema al tomarla) y el paciente lo ve
  const { createClient } = await import('@supabase/supabase-js')
  const { credencial } = await import('./ayudas.js')
  const { correo, clave } = credencial('ADMIN', 'E2E')
  const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  expect((await api.auth.signInWithPassword({ email: correo, password: clave })).error).toBeNull()
  const pg = (await import('pg')).default
  const c = new pg.Client()
  await c.connect()
  const pases = (await c.query("select id from pases_a_venta where consulta_id is null and estado not in ('descartado', 'vendido') limit 1")).rows
  await c.end()
  expect(pases.length).toBe(1)
  expect((await api.rpc('tomar_solicitud_portal', { p_pase_id: pases[0].id })).error).toBeNull()
  await portal.reload()
  await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  await expect(portal.getByRole('list', { name: 'Tus solicitudes de lentes' })).toContainText('En atención', { timeout: 30_000 })

  // 4. «No compró» la cierra y el paciente la ve «Atendida» (sin el motivo, que es de la óptica); ya puede pedir otra
  expect((await api.rpc('descartar_pase', { p_pase_id: pases[0].id, p_motivo: 'precio', p_detalle: null })).error).toBeNull()
  await portal.reload()
  await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
  const lista = portal.getByRole('list', { name: 'Tus solicitudes de lentes' })
  await expect(lista).toContainText('Atendida', { timeout: 30_000 })
  await expect(lista).not.toContainText('precio')
  await expect(portal.getByRole('button', { name: 'Solicitar lentes nuevos' })).toBeEnabled()
})
