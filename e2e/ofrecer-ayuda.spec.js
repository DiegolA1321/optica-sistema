// «Ofrecer ayuda», de punta a punta con dos sesiones: el soporte ofrece ayuda con dos módulos (Ventas e Inventario) y el administrador de la óptica las recibe en la
// campanita. Con Ventas abre la conversación, ve la guía y responde; con Inventario dice «No usamos este módulo» (y lo deshace desde Configuración). Cada paso también
// se comprueba del lado del servidor: no se repite la oferta hasta 30 días después, y con «No usamos este módulo» ya no se le ofrece.
//
// Qué escribe y dónde: todo en la óptica de pruebas (E2E, QA Test Claude) y se limpia antes y después. La ventana «Ofrecer ayuda» del Inicio del superadmin es de
// la óptica real (Solna): se abre y se ve su mensaje, su vista previa y su botón, pero NO se envía, para no escribirle una consulta a una óptica real; el
// envío a la óptica de pruebas lo hace el superadmin por la API, con su sesión real (la misma función del servidor que usa el botón).
// Necesita la migración 0122 aplicada y SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD en el entorno (o en .env.test); sin ellas, se omite.
import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'
import { hayOfrecerAyuda, limpiarAyudasDePruebas } from './limpiar-ayuda.js'

test.use({ viewport: { width: 1366, height: 768 } })

test.beforeAll(limpiarAyudasDePruebas)
test.afterAll(limpiarAyudasDePruebas)

async function entrarComoSuperadmin(page) {
  await page.goto('/?sitio=admin')
  await escribirSecreto(page, page.locator('#usuario-solo'), process.env.SUPERADMIN_EMAIL)
  await escribirSecreto(page, page.locator('#password-solo'), process.env.SUPERADMIN_PASSWORD)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Soporte', exact: true }).first()).toBeVisible({ timeout: 30_000 })
}

// La sesión real del superadmin por la API (no se guarda ni se imprime la contraseña).
async function sesionSuperadmin() {
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await c.auth.signInWithPassword({ email: process.env.SUPERADMIN_EMAIL, password: process.env.SUPERADMIN_PASSWORD })
  if (error) throw new Error(`No se pudo entrar como superadmin: ${error.message}`)
  return c
}
async function idOpticaDePruebas() {
  const c = new pg.Client()
  await c.connect()
  try { return (await c.query('select id from opticas where slug = $1', [SLUG_PRUEBAS])).rows[0].id } finally { await c.end() }
}

test('El soporte ofrece ayuda; el administrador la ve, abre la guía y responde (Ventas) y dice «No usamos este módulo» (Inventario); se puede deshacer', async ({ browser }) => {
  test.skip(!process.env.SUPERADMIN_EMAIL || !process.env.SUPERADMIN_PASSWORD, 'Faltan SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD')
  test.skip(!(await hayOfrecerAyuda()), 'Falta aplicar la migración 0122 (Ofrecer ayuda como conversación de Soporte)')
  test.setTimeout(300_000)
  const optica = await idOpticaDePruebas()
  const api = await sesionSuperadmin()

  // ── 1. La ventana del Inicio del superadmin: mensaje propuesto, vista previa y botón (se abre y se cierra sin enviar)
  const contextoSuper = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const superadmin = await contextoSuper.newPage()
  await entrarComoSuperadmin(superadmin)
  const modulos = superadmin.getByRole('list', { name: 'Módulos' })
  await expect(modulos).toBeVisible({ timeout: 60_000 })
  const sinUso = modulos.getByRole('button', { name: /Sin uso en 30 días/ }).first()
  if (await sinUso.count()) {
    await sinUso.click()
    const detalle = superadmin.getByRole('dialog').first()
    const ofrecer = detalle.getByRole('button', { name: 'Ofrecer ayuda' })
    if (await ofrecer.count()) {
      await ofrecer.click()
      const ventana = superadmin.getByRole('dialog', { name: /^Ofrecer ayuda con / })
      await expect(ventana.getByLabel('Mensaje para el administrador')).toHaveValue(/^Vimos que en los últimos 30 días no usaron .+\. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí\.$/)
      await expect(ventana.getByText(/de 2000/)).toHaveCount(0) // el contador solo aparece cerca del límite
      const vista = ventana.getByRole('region', { name: 'Vista previa' })
      await expect(vista).toContainText('El soporte te ofrece ayuda con')
      await expect(vista).toContainText('No usamos este módulo')
      await expect(vista.getByRole('button')).toHaveCount(0) // los botones de la muestra no se pulsan
      expect(await ventana.textContent()).not.toMatch(/https?:|localhost|vercel/i)
      await expect(ventana.getByRole('button', { name: 'Enviar a la óptica' })).toBeEnabled()
      await ventana.getByRole('button', { name: 'Cancelar' }).click() // NO se envía: es la óptica real
      await expect(ventana).toHaveCount(0)
    }
  }

  // ── 2. El soporte ofrece ayuda con Ventas y con Inventario a la óptica de pruebas (la misma función del servidor que usa el botón)
  const MENSAJE = 'Vimos que en los últimos 30 días no usaron Ventas. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí.'
  const { data: ofertaVentas, error: errVentas } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'ventas', p_mensaje: MENSAJE })
  expect(errVentas).toBeNull()
  const { data: ofertaInventario, error: errInventario } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'inventario', p_mensaje: 'Vimos que en los últimos 30 días no usaron Inventario. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí.' })
  expect(errInventario).toBeNull()
  const codigo = `SOP-${String(ofertaVentas[0].numero).padStart(4, '0')}`
  // No se repite hasta 30 días después
  const { error: repetida } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'ventas', p_mensaje: 'Otra vez' })
  expect(repetida?.message).toMatch(/Ya se ofreció ayuda con este módulo el \d\d\/\d\d\/\d{4}\. Podrás volver a ofrecerla el \d\d\/\d\d\/\d{4}/)

  // ── 3. El administrador de la óptica: campanita (las dos) → conversación de Ventas con las tres opciones
  const contextoOptica = await browser.newContext({ viewport: { width: 1366, height: 768 } })
  const admin = await contextoOptica.newPage()
  await iniciarSesion(admin, 'ADMIN', 'E2E')
  await admin.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(admin.getByText('El soporte te ofrece ayuda con Inventario')).toBeVisible({ timeout: 30_000 })
  const alerta = admin.getByText('El soporte te ofrece ayuda con Ventas')
  await expect(alerta).toBeVisible()
  await alerta.click()
  const conversacion = admin.getByRole('dialog')
  await expect(conversacion).toContainText(`${codigo} · Ayuda con Ventas`, { timeout: 20_000 })
  await expect(conversacion.getByText(MENSAJE)).toBeVisible()
  await expect(conversacion.getByText('Iniciada por el soporte').first()).toBeVisible()
  const opciones = conversacion.getByRole('region', { name: 'Qué quieres hacer con esta ayuda' })
  await expect(opciones.getByRole('button', { name: /Ver la guía de Ventas/ })).toBeVisible()
  await expect(opciones.getByRole('button', { name: /^Responder$/ })).toBeVisible()
  await expect(opciones.getByRole('button', { name: 'No usamos este módulo' })).toBeVisible()
  // Abrir la de Ventas bajó solo esa campanita: la de Inventario sigue ahí
  await admin.keyboard.press('Escape')
  await admin.getByRole('button', { name: 'Notificaciones' }).click()
  await expect(admin.getByText('El soporte te ofrece ayuda con Ventas')).toHaveCount(0)
  await expect(admin.getByText('El soporte te ofrece ayuda con Inventario')).toBeVisible()
  await admin.keyboard.press('Escape')

  // ── 4. «Ver la guía de Ventas» abre la Ayuda de Ventas en el mismo sistema (sin dirección escrita)
  const pestanaSistema = () => admin.getByRole('tab', { name: /Soporte del sistema/ })
  await pestanaSistema().click()
  await admin.getByRole('button', { name: 'Ayuda con Ventas' }).click()
  await admin.getByRole('dialog').getByRole('button', { name: /Ver la guía de Ventas/ }).click()
  await expect(admin.getByRole('tab', { name: 'Ayuda' })).toHaveAttribute('aria-selected', 'true')
  await expect(admin.getByLabel('Filtrar la ayuda por módulo')).toHaveValue('ventas')
  await expect(admin.getByRole('group', { name: 'Ayuda de Ventas' })).toBeVisible()

  // ── 5. «Responder» sigue la conversación en Soporte; el soporte la ve con su etiqueta y la respuesta
  await pestanaSistema().click()
  await admin.getByRole('button', { name: 'Ayuda con Ventas' }).click()
  const ventanaAdmin = admin.getByRole('dialog')
  await ventanaAdmin.getByRole('button', { name: /^Responder$/ }).click()
  await ventanaAdmin.getByLabel('Tu mensaje').fill('E2E: gracias, lo vemos esta semana')
  await ventanaAdmin.getByRole('button', { name: 'Enviar', exact: true }).click()
  await expect(ventanaAdmin.getByText('E2E: gracias, lo vemos esta semana')).toBeVisible({ timeout: 20_000 })
  await ventanaAdmin.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  await superadmin.reload()
  await superadmin.getByRole('button', { name: 'Soporte', exact: true }).first().click()
  await superadmin.getByRole('checkbox', { name: /Incluir entornos de prueba/ }).check({ force: true })
  const lista = superadmin.getByRole('list', { name: 'Consultas de soporte' })
  const fila = lista.getByRole('listitem').filter({ hasText: 'Ayuda con Ventas' }).first()
  await expect(fila).toContainText('Iniciada por el soporte', { timeout: 30_000 })
  await fila.getByRole('button', { name: 'Ayuda con Ventas' }).click()
  const ventanaSuper = superadmin.getByRole('dialog')
  await expect(ventanaSuper.getByText('E2E: gracias, lo vemos esta semana')).toBeVisible({ timeout: 20_000 })
  await expect(ventanaSuper.getByText('Iniciada por el soporte').first()).toBeVisible()
  await ventanaSuper.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  // ── 6. En Inventario: «No usamos este módulo» pide confirmar, cierra la conversación y el soporte ya no puede ofrecerle ayuda
  await admin.reload()
  await pestanaSistema().click()
  await admin.getByRole('button', { name: 'Ayuda con Inventario' }).click()
  const decision = admin.getByRole('dialog')
  await decision.getByRole('button', { name: 'No usamos este módulo' }).click()
  await expect(decision.getByRole('region', { name: 'Qué quieres hacer con esta ayuda' })).toContainText('Puedes deshacerlo en Configuración')
  await decision.getByRole('button', { name: 'Sí, no usamos este módulo' }).click()
  await expect(decision.getByText(/Ayuda cerrada/)).toBeVisible({ timeout: 20_000 })
  await expect(decision.getByRole('region', { name: 'Qué quieres hacer con esta ayuda' })).toHaveCount(0)
  await decision.getByRole('button', { name: 'Cerrar', exact: true }).last().click()

  const { data: marcados } = await api.from('modulos_no_usados').select('modulo').eq('optica_id', optica)
  expect(marcados.map((m) => m.modulo)).toEqual(['inventario'])
  const { error: yaNoUsan } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'inventario', p_mensaje: 'Hola' })
  expect(yaNoUsan?.message).toMatch(/no usa este módulo/)

  // ── 7. Configuración › «Módulos que no usamos»: se deshace, y el límite de 30 días sigue
  await admin.getByRole('button', { name: 'Configuración', exact: true }).first().click()
  await admin.getByRole('tab', { name: 'Privacidad' }).click()
  const seccion = admin.getByRole('region', { name: 'Módulos que no usamos' })
  await expect(seccion.getByText('Inventario', { exact: true })).toBeVisible({ timeout: 20_000 })
  await seccion.getByRole('button', { name: 'Volver a usar Inventario' }).click()
  await expect(seccion.getByText(/Todavía no marcaste ningún módulo como no usado/)).toBeVisible({ timeout: 20_000 })
  const { error: sigueElLimite } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'inventario', p_mensaje: 'Hola' })
  expect(sigueElLimite?.message).toMatch(/Ya se ofreció ayuda con este módulo/)
  const { data: otro, error: errOtro } = await api.rpc('ofrecer_ayuda', { p_optica: optica, p_modulo: 'reportes', p_mensaje: 'Hola con Reportes' })
  expect(errOtro).toBeNull() // con otro módulo sí se puede
  expect(otro[0].numero).toBeGreaterThan(ofertaInventario[0].numero)

  // Sin desplazamiento horizontal a 1366×768
  expect(await admin.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await contextoSuper.close()
  await contextoOptica.close()
})
