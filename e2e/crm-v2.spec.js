// CRM v2, de punta a punta. El recorrido que escribe corre en la óptica de pruebas ('E2E', crea sus propios pacientes con el prefijo "E Dos E "):
// contactar por WhatsApp, anotar "volver a contactar en 3 días", verlo reaparecer solo ese día y que el paciente que agenda quede resuelto.
// La Demo (solo lectura) se usa para mirar: pestañas, sin desplazamiento horizontal y números que coinciden con los de otras pantallas.
// Los saltos de tiempo se hacen en la base (volver_el = hoy), porque esperar 3 días no es una prueba.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, credencial, nombrePrueba, cedulaValida, telefonoPrueba, elegirFecha } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })
test.describe.configure({ mode: 'serial' })

const A = nombrePrueba() // contactar y volver a contactar
const B = nombrePrueba() // agenda una cita después del contacto
const C = nombrePrueba() // no desea recibir mensajes

const iso = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Pacientes con el control vencido (registrados hace 200 días, sin consultas), creados con la sesión del administrador de pruebas.
async function crearPacientes(nombres) {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('ADMIN', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del administrador para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  for (const nombre of nombres) {
    const { error: e2 } = await cliente.from('pacientes').insert({
      optica_id: perfil.optica_id, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
      evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: iso(-200), estado_clinico: 'Activo',
    })
    if (e2) throw new Error(`No se pudo crear el paciente de prueba: ${e2.message}`)
  }
}

// Acceso directo a la base (solo la óptica de pruebas) para lo que la pantalla no puede hacer: adelantar el día de un "volver a contactar" y agendar una cita.
async function enLaBase(fn) {
  const c = new pg.Client()
  await c.connect()
  try { return await fn(c) } finally { await c.end() }
}

async function abrirCrm(page, pestana = 'Para contactar') {
  await page.getByRole('button', { name: /^CRM y fidelización/ }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'CRM y fidelización' })).toBeVisible()
  await page.getByRole('tab', { name: new RegExp(pestana) }).click()
}
const filaDe = (page, nombre) => page.getByRole('listitem').filter({ hasText: nombre }).filter({ has: page.getByRole('button', { name: /^Contactar a / }) }) // (el panel de arriba también lista nombres)

test.beforeEach(async ({ page }) => {
  // window.open se anota en vez de abrir WhatsApp: se comprueba a dónde iría.
  await page.addInitScript(() => { window.__abiertos = []; window.open = (url) => { window.__abiertos.push(String(url)); return null } })
})

test('1 · Contactar abre WhatsApp con el mensaje escrito, queda en el Historial de contactos y "volver a contactar en 3 días" saca al paciente de la lista', async ({ page }) => {
  await crearPacientes([A, B, C])
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page)
  await expect(filaDe(page, A)).toBeVisible()
  await expect(filaDe(page, A)).toContainText('Control vencido')

  await filaDe(page, A).getByRole('button', { name: `Contactar a ${A}` }).click()
  // La ventana de «Contactar» trae el mensaje de la plantilla; «Enviar por WhatsApp» lo abre y deja el contacto registrado.
  const contactar = page.getByRole('dialog', { name: 'Contactar', exact: true })
  await expect(contactar.getByLabel(/^Mensaje/)).toHaveValue(new RegExp(`^Hola ${A}`))
  await contactar.getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  await expect(page.getByText(`Contacto con ${A} registrado`)).toBeVisible()
  const abiertos = await page.evaluate(() => window.__abiertos)
  expect(abiertos).toHaveLength(1)
  expect(decodeURIComponent(abiertos[0])).toContain(`Hola ${A}`)
  await expect(filaDe(page, A)).toContainText('Hoy · WhatsApp') // contactado y falta anotar qué pasó

  await filaDe(page, A).getByRole('button', { name: `Registrar resultado de ${A}` }).click()
  const ventana = page.getByRole('dialog', { name: 'Registrar resultado' })
  await ventana.getByLabel(/Volver a contactar/).check()
  await ventana.getByRole('button', { name: '3 días' }).click()
  await ventana.getByRole('button', { name: 'Guardar resultado' }).click()
  await expect(ventana).toHaveCount(0)
  await expect(filaDe(page, A)).toHaveCount(0) // descansa hasta dentro de 3 días

  // Historial de contactos: el contacto, con su resultado
  await page.getByRole('tab', { name: /Historial de contactos/ }).click()
  await page.getByLabel('Buscar paciente').fill(A)
  await expect(page.getByRole('list', { name: 'Contactos' }).getByRole('listitem').filter({ hasText: A })).toContainText('Volver a contactar')
})

test('2 · Llegado el día, el paciente reaparece solo, primero en la lista, y también en "Requieren atención"', async ({ page }) => {
  await enLaBase((c) => c.query(
    `update public.crm_contactos set volver_el = (now() at time zone 'America/Guayaquil')::date
      where resultado = 'volver_a_contactar' and paciente_id in (select id from public.pacientes_base where nombre = $1)`, [A]))
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page)
  const primero = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /^Contactar a / }) }).first()
  await expect(primero).toContainText(A)
  await expect(primero).toContainText('Volver a contactar')
  await page.getByRole('button', { name: /^Requieren atención/ }).click()
  const avisos = page.getByRole('dialog')
  await expect(avisos).toContainText('que toca volver a contactar hoy')
  await expect(avisos).toContainText(A)
})

test('3 · Si el paciente agenda una cita después del contacto, el contacto queda resuelto solo', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page)
  await filaDe(page, B).getByRole('button', { name: `Contactar a ${B}` }).click()
  await page.getByRole('dialog', { name: 'Contactar', exact: true }).getByRole('button', { name: 'Enviar por WhatsApp' }).click()
  await expect(filaDe(page, B)).toContainText('Hoy · WhatsApp')
  // El paciente agenda (la cita se crea ahora, después del contacto).
  await enLaBase((c) => c.query(
    `insert into public.citas_base (optica_id, paciente_id, paciente, fecha, hora, estado, motivo, origen)
     select optica_id, id, nombre, current_date + 5, '03:00 PM', 'Pendiente', 'Control visual', 'staff' from public.pacientes_base where nombre = $1`, [B]))
  await page.reload()
  await abrirCrm(page)
  await expect(filaDe(page, B)).toHaveCount(0)
  await page.getByRole('tab', { name: /Historial de contactos/ }).click()
  await page.getByLabel('Buscar paciente').fill(B)
  await expect(page.getByRole('list', { name: 'Contactos' }).getByRole('listitem').filter({ hasText: B })).toContainText('Agendó')
})

test('4 · "No desea recibir mensajes" lo saca de la lista y apaga sus dos permisos', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page)
  await filaDe(page, C).getByRole('button', { name: `Registrar resultado de ${C}` }).click()
  const ventana = page.getByRole('dialog', { name: 'Registrar resultado' })
  await ventana.getByLabel(/^WhatsApp$/).check().catch(() => {})
  await ventana.getByLabel(/No desea recibir mensajes/).check()
  await ventana.getByRole('button', { name: 'Guardar resultado' }).click()
  await expect(ventana).toHaveCount(0)
  await expect(filaDe(page, C)).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Incluir a quienes/ })).toHaveCount(0) // ya no hay un botón para verlo: la lista es solo lo que hay que contactar hoy
  // Y el permiso quedó apagado en su perfil.
  const permisos = await enLaBase((c) => c.query('select acepta_recordatorios, acepta_promociones from public.pacientes_base where nombre = $1', [C]))
  expect(permisos.rows[0]).toEqual({ acepta_recordatorios: false, acepta_promociones: false })
})

test('5 · Campaña: se prepara para un grupo y cada envío queda marcado', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page, 'Campañas')
  await page.getByRole('button', { name: /Nueva campaña/ }).first().click()
  const nueva = page.getByRole('dialog', { name: 'Nueva campaña' })
  await nueva.getByLabel(/^Control vencido/).check()
  await nueva.getByLabel('Nombre de la campaña').fill('E2E Control vencido')
  await nueva.getByRole('button', { name: 'Crear campaña' }).click()
  const lista = page.getByRole('dialog', { name: /E2E Control vencido/ })
  await expect(lista).toBeVisible()
  await lista.getByRole('button', { name: new RegExp(`Enviar por WhatsApp a ${A}`) }).click()
  await expect(lista.getByRole('listitem').filter({ hasText: A })).toContainText('Enviado')
  await lista.getByRole('button', { name: 'Cerrar' }).last().click()
  await expect(page.getByText(/\d+ de \d+ enviados/)).toBeVisible()
})

test('6 · Ninguna pestaña tiene desplazamiento horizontal a 1366×768', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await abrirCrm(page)
  for (const pestana of ['Para contactar', 'Historial de contactos', 'Campañas', 'Fidelización']) {
    await page.getByRole('tab', { name: new RegExp(pestana) }).click()
    await expect(page.getByRole('tabpanel')).toBeVisible()
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(desborde, `desplazamiento horizontal en ${pestana}`).toBeLessThanOrEqual(0)
  }
})

// Lo que dice el Inicio y lo que muestra el CRM es lo mismo: el aviso de control vencido cuenta exactamente la lista "Para contactar".
async function numerosDelInicioYDelCrm(page) {
  // El aviso puede quedar tras "Ver todo" (la tarjeta muestra tres): se lee en la ventana de avisos de Pacientes, que los trae todos.
  let textoInicio = ''
  const areaPacientes = page.getByRole('region', { name: 'Requiere tu atención: Pacientes' })
  await expect(areaPacientes).toBeVisible({ timeout: 20_000 }) // el Inicio ya cargó (y con él, los contactos del CRM)
  await page.waitForTimeout(1500)
  const abrirAvisos = areaPacientes.getByRole('button', { name: /con el control vencido$/ })
  if (await abrirAvisos.count()) {
    await abrirAvisos.click()
    textoInicio = await page.getByRole('dialog').innerText()
    await page.keyboard.press('Escape')
  }
  const delInicio = textoInicio.match(/(\d+)\s+pacientes?\s+con el control vencido/)
  await abrirCrm(page)
  const pildora = page.getByRole('button', { name: /^Control vencido \(\d+\)/ })
  await expect(pildora).toBeVisible()
  const delCrm = Number((await pildora.innerText()).match(/\((\d+)\)/)[1])
  expect(delInicio ? Number(delInicio[1]) : 0, 'el aviso del Inicio y el filtro del CRM cuentan lo mismo').toBe(delCrm)
  return delCrm
}

test('7 · Óptica de pruebas: el aviso del Inicio cuenta lo mismo que "Para contactar", sin el que está en descanso ni el que no desea mensajes', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const n = await numerosDelInicioYDelCrm(page)
  expect(n).toBeGreaterThanOrEqual(1) // quedan: los de las pruebas anteriores que siguen por contactar (A descansa o vuelve, B resuelto, C no desea)
  for (const [nombre, aparece] of [[A, true], [B, false], [C, false]]) {
    await expect(filaDe(page, nombre)).toHaveCount(aparece ? 1 : 0)
  }
})

test('8 · Demo (solo lectura): control vencido da el mismo número en el Inicio y en el CRM', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'DEMO')
  await numerosDelInicioYDelCrm(page)
})

test('9 · Crear un paciente pregunta por los dos permisos: recordatorios marcado, promociones y saludos desmarcado', async ({ page }) => {
  const nombre = nombrePrueba()
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await page.getByRole('button', { name: /^Pacientes/ }).first().click()
  await page.getByRole('button', { name: 'Crear paciente' }).first().click()
  const registro = page.getByRole('dialog', { name: 'Crear paciente' })
  await expect(registro.getByRole('checkbox', { name: /Recordatorios de salud/ })).toBeChecked()
  await expect(registro.getByRole('checkbox', { name: /Promociones y saludos/ })).not.toBeChecked()
  await registro.locator('#p-nombre').fill(nombre)
  await registro.locator('#p-cedula').fill(cedulaValida())
  await registro.locator('#p-telefono').fill(telefonoPrueba())
  await elegirFecha(registro, 'p-nacimiento', '1990-05-15')
  await registro.getByRole('checkbox', { name: /Promociones y saludos/ }).check()
  await registro.getByRole('button', { name: 'Registrar paciente' }).click()
  await expect(page.getByRole('dialog', { name: 'Paciente registrado' })).toBeVisible({ timeout: 15_000 })
  const fila = await enLaBase((c) => c.query('select acepta_recordatorios, acepta_promociones, consentimiento_actualizado_por from public.pacientes_base where nombre = $1', [nombre]))
  expect(fila.rows[0].acepta_recordatorios).toBe(true)
  expect(fila.rows[0].acepta_promociones).toBe(true)
  expect(fila.rows[0].consentimiento_actualizado_por).toBeTruthy() // quedó anotado quién lo registró
})
