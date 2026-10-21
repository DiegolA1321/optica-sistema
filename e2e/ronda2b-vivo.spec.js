// Ronda 2b — lo que se comprueba EN VIVO con la pantalla real (óptica de pruebas, que escribe y limpia lo suyo):
//   1. El paciente cancela su cita desde el portal: la ventana pide el motivo y queda guardado, con el paciente como autor.
//   2. «Descartar» un aviso de «Requiere tu atención»: pide el motivo, saca el caso, queda registrado (quién y por qué) y «Volver a mostrar» lo trae de vuelta.
//   3. Un aviso interno del administrador se ve en el Inicio de su destinatario, resaltado como no leído.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, escribirSecreto, prepararAvisosInicio, SLUG_PRUEBAS } from './ayudas.js'
import { limpiarSoporteDePruebas } from './limpiar-soporte.js'

const NOMBRE_PORTAL = 'E Dos E Portal Auditoria'
const bd = async (fn) => { const c = new pg.Client(); await c.connect(); try { return await fn(c) } finally { await c.end() } }
const q = (t, p) => bd(async (c) => (await c.query(t, p)).rows)
const diaHabil = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test('Portal: el paciente cancela su cita y la ventana le pide el motivo, que queda guardado con él como autor', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1366, height: 768 })
  const optica = (await q('select id, settings from opticas where slug = $1', [SLUG_PRUEBAS]))[0]
  const paciente = (await q('select id, nombre, cedula from pacientes_base where optica_id = $1 and nombre = $2', [optica.id, NOMBRE_PORTAL]))[0]
  await q('delete from citas_base where paciente_id = $1', [paciente.id])
  const ajustes = optica.settings || {}
  let citaId = null
  try {
    // El botón «Cancelar cita» del portal solo sale si la óptica deja reagendar/cancelar al paciente.
    await q("update opticas set settings = coalesce(settings, '{}'::jsonb) || '{\"permitirReagendarPaciente\": true, \"horasAntesReagendar\": 2}'::jsonb where id = $1", [optica.id])
    citaId = (await q(`insert into citas_base (optica_id, paciente_id, paciente, cedula, fecha, hora, estado, origen, duracion_minutos, motivo)
      values ($1, $2, $3, $4, $5, '10:00 AM', 'Pendiente', 'paciente', 40, 'Consulta General') returning id`, [optica.id, paciente.id, paciente.nombre, paciente.cedula, diaHabil(10)]))[0].id

    await page.goto(`/?optica=${SLUG_PRUEBAS}`)
    await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
    await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.E2E_PORTAL_CEDULA)
    await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
    await page.getByRole('button', { name: 'Entrar', exact: true }).click()
    await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
    await page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: 'Mis citas', exact: true }).click()
    await page.getByRole('button', { name: 'Cancelar cita' }).first().click()

    const ventana = page.getByRole('dialog', { name: '¿Cancelar esta cita?' })
    await expect(ventana.getByRole('radio')).toHaveCount(3) // No puedo asistir · Ya no necesito la cita · Otro (MOTIVOS_PACIENTE)
    const confirmar = ventana.getByRole('button', { name: /Sí, cancelar|Cancelar mi cita|Cancelar cita/ }).last()
    await expect(confirmar).toBeDisabled() // sin motivo no se puede cancelar
    await ventana.getByRole('radio', { name: 'No puedo asistir' }).click()
    await ventana.getByLabel(/Detalle/).fill('E2E: tengo un viaje')
    await page.screenshot({ path: 'docs/ronda2-capturas/portal-cancelar-con-motivo.png' })
    await expect(confirmar).toBeEnabled()
    await confirmar.click()
    await expect(page.getByRole('dialog', { name: '¿Cancelar esta cita?' })).toHaveCount(0, { timeout: 20_000 })

    const cita = (await q('select estado from citas_base where id = $1', [citaId]))[0]
    expect(cita.estado).toBe('Cancelada')
    const evento = (await q("select actor_tipo, datos from citas_eventos where cita_id = $1 and tipo = 'cancelada'", [citaId]))[0]
    expect(evento.actor_tipo).toBe('paciente')
    expect(evento.datos.motivo).toMatch(/no puede asistir|No puedo asistir/i)
    expect(evento.datos.detalle).toBe('E2E: tengo un viaje')
  } finally {
    await q('delete from citas_base where paciente_id = $1', [paciente.id])
    await q('update opticas set settings = $2::jsonb where id = $1', [optica.id, JSON.stringify(ajustes)])
  }
})

test('Inicio: «Descartar» un aviso pide el motivo, lo saca de la lista, queda registrado y «Volver a mostrar» lo restaura', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1093, height: 768 })
  await prepararAvisosInicio('E2E')
  const optica = (await q('select id from opticas where slug = $1', [SLUG_PRUEBAS]))[0]
  await q('delete from avisos_descartados where optica_id = $1', [optica.id])
  try {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    const area = page.getByRole('region', { name: 'Requiere tu atención: Inventario' })
    await expect(area).toBeVisible({ timeout: 20_000 })
    await area.getByRole('button', { name: /con stock bajo$/ }).click()
    const ventana = page.getByRole('dialog')
    const antes = await ventana.getByRole('button', { name: /^Descartar el aviso de / }).count()
    expect(antes).toBeGreaterThan(0)
    const boton = ventana.getByRole('button', { name: /^Descartar el aviso de / }).first()
    const nombre = (await boton.getAttribute('aria-label')).replace('Descartar el aviso de ', '')
    await boton.click()
    const panel = ventana.getByRole('group', { name: `Descartar el aviso de ${nombre}` })
    await expect(panel.getByRole('button', { name: 'Descartar el aviso' })).toBeDisabled() // sin motivo no se descarta
    await panel.getByRole('radio', { name: 'No se repondrá' }).click()
    await panel.getByLabel(/Detalle/).fill('E2E: producto descontinuado')
    await page.screenshot({ path: 'docs/ronda2-capturas/descartar-aviso.png' })
    await panel.getByRole('button', { name: 'Descartar el aviso' }).click()
    await expect(page.getByText(`Aviso de ${nombre} descartado.`)).toBeVisible({ timeout: 15_000 })

    // Queda registrado: quién, por qué y cuándo.
    const fila = (await q("select tipo, motivo, detalle, descartado_nombre, descartado_por from avisos_descartados where optica_id = $1", [optica.id]))[0]
    expect(fila.tipo).toBe('inventario:stock_bajo')
    expect(fila.motivo).toBe('No se repondrá')
    expect(fila.detalle).toBe('E2E: producto descontinuado')
    expect(fila.descartado_nombre.length).toBeGreaterThan(0)
    expect(fila.descartado_por).toBeTruthy()

    // Sale de la lista y queda en «Descartados», desde donde se vuelve a mostrar.
    const lista = page.getByRole('dialog')
    if (await lista.count()) {
      await expect(lista.getByRole('button', { name: `Descartar el aviso de ${nombre}` })).toHaveCount(0)
      await lista.getByText(/^Descartados \(\d+\)/).click()
      await lista.getByRole('button', { name: `Volver a mostrar el aviso de ${nombre}` }).click()
      await expect(page.getByText(`El aviso de ${nombre} vuelve a mostrarse.`)).toBeVisible({ timeout: 15_000 })
    }
    expect((await q('select count(*)::int n from avisos_descartados where optica_id = $1', [optica.id]))[0].n).toBe(0)
  } finally {
    await q('delete from avisos_descartados where optica_id = $1', [optica.id])
  }
})

test.describe('Aviso interno en el Inicio de su destinatario', () => {
  test.beforeAll(limpiarSoporteDePruebas)
  test.afterAll(limpiarSoporteDePruebas)

  test('el administrador publica un aviso para Optómetra y Paula lo ve en su Inicio, resaltado como no leído', async ({ browser }) => {
    test.setTimeout(240_000)
    const titulo = `E2E Aviso ${Date.now().toString(36)}`
    const ctxAdmin = await browser.newContext({ viewport: { width: 1093, height: 768 } })
    const admin = await ctxAdmin.newPage()
    await iniciarSesion(admin, 'ADMIN', 'E2E')
    await admin.getByRole('button', { name: 'Soporte', exact: true }).first().click()
    await admin.getByRole('tab', { name: /^Avisos/ }).click()
    await admin.getByRole('button', { name: /Nuevo aviso/ }).first().click()
    const v = admin.getByRole('dialog', { name: 'Nuevo aviso' })
    await v.getByLabel('Título').fill(titulo)
    await v.getByLabel('Mensaje').fill('E2E: reunión de optómetras el lunes a las 8.')
    await v.getByLabel('Para').selectOption('rol')
    await v.getByLabel('Rol').selectOption({ label: 'Optómetra' })
    await v.getByRole('button', { name: 'Publicar aviso' }).click()
    await expect(admin.getByRole('dialog', { name: 'Nuevo aviso' })).toHaveCount(0, { timeout: 20_000 })
    await ctxAdmin.close()

    const ctxPaula = await browser.newContext({ viewport: { width: 1093, height: 768 } })
    const paula = await ctxPaula.newPage()
    await iniciarSesion(paula, 'OPTOMETRA', 'E2E')
    const avisos = paula.locator('main').getByRole('region', { name: 'Avisos' })
    await expect(avisos).toBeVisible({ timeout: 30_000 })
    const suyo = avisos.getByRole('listitem').filter({ hasText: titulo })
    await expect(suyo).toBeVisible()
    await expect(suyo.getByRole('button', { name: 'Leído' })).toBeVisible() // lo no leído lleva su botón y su resalte
    await paula.screenshot({ path: 'docs/ronda2-capturas/inicio-optometra-aviso-interno.png' })
    await suyo.getByRole('button', { name: 'Leído' }).click()
    await expect(suyo.getByRole('button', { name: 'Leído' })).toHaveCount(0, { timeout: 15_000 })
    await ctxPaula.close()
  })
})
