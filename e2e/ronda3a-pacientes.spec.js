// Ronda 3a (21 oct. 2026): la lista de Pacientes (tarjetas, filtros, columnas), crear con pasaporte y editar con el calendario flotante, la barra lateral de 232 px,
// los avisos del Inicio ordenados por urgencia y el WhatsApp de los avisos con la plantilla del CRM (y su contacto en el Seguimiento). Óptica de pruebas (E2E).
// Con E2E_CAPTURAS=1 guarda capturas a 1093 px en docs/ronda3a-capturas/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, nombrePrueba, telefonoPrueba, elegirFecha, prepararAvisosInicio, credencial, crearCitaDeHoyParaPaula, cancelarCitasDePrueba } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 768 } })

const foto = async (page, nombre) => {
  if (!process.env.E2E_CAPTURAS) return
  fs.mkdirSync('docs/ronda3a-capturas', { recursive: true })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `docs/ronda3a-capturas/${nombre}.png` })
}
const irA = (page, modulo) => page.getByRole('button', { name: modulo, exact: true }).first().click()

test('barra lateral de 232 px en toda la app, con los nombres del menú en una línea', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const lateral = page.locator('aside').first()
  await expect(lateral).toBeVisible()
  expect(Math.round((await lateral.boundingBox()).width)).toBe(232)
  const opciones = await lateral.locator('nav button').evaluateAll((bs) => bs.map((b) => { const t = b.querySelector('span'); return { nombre: b.getAttribute('aria-label'), alto: t.getBoundingClientRect().height, recortado: t.scrollWidth > t.clientWidth + 1 } }))
  expect(opciones.length).toBeGreaterThan(6)
  for (const o of opciones) {
    expect(o.alto, `«${o.nombre}» en una sola línea`).toBeLessThan(24)
    expect(o.recortado, `«${o.nombre}» se lee completo`).toBe(false)
  }
  // ningún módulo se rompe: se recorren y ninguno desplaza la pantalla a lo ancho
  for (const m of ['Inicio', 'Citas médicas', 'Pacientes', 'Ventas', 'Inventario', 'CRM y fidelización', 'Mi horario', 'Reportes', 'Usuarios y permisos', 'Configuración']) {
    await irA(page, m)
    await page.waitForTimeout(500)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${m} sin desplazamiento horizontal`).toBe(true)
  }
})

test('Inicio: «Requiere tu atención» ordena rojo, ámbar y azul, y el desenlace no ofrece «Todas»', async ({ page }) => {
  test.setTimeout(150_000)
  await prepararAvisosInicio('E2E')
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const panel = page.getByRole('region', { name: 'Requiere tu atención', exact: true })
  await expect(panel).toBeVisible({ timeout: 25_000 })
  // dentro de cada columna, los avisos van por urgencia (el título de cada aviso empieza con «Urgente», «Pendiente» o «Informativo»)
  const rango = { Urgente: 0, Pendiente: 1, Informativo: 2 }
  const columnas = await panel.locator('section[aria-label^="Requiere tu atención:"]').all()
  for (const col of columnas) {
    const tonos = await col.locator('ul button[title]').evaluateAll((bs) => bs.map((b) => b.title.split(':')[0]))
    expect(tonos.length).toBeLessThanOrEqual(3)
    const rangos = tonos.map((t) => rango[t])
    expect(rangos, `orden de ${tonos.join(', ')}`).toEqual([...rangos].sort((a, b) => a - b))
  }
  const periodo = page.getByRole('group', { name: 'Período del desenlace' })
  await expect(periodo.getByRole('button')).toHaveText(['Hoy', 'Esta semana', 'Este mes'])
  await foto(page, 'inicio-administrador')
})

test('Pacientes: cuatro tarjetas que filtran con su mismo número, «Filtrar» solo con lo que no tiene tarjeta y las columnas nuevas', async ({ page }) => {
  test.setTimeout(150_000)
  await prepararAvisosInicio('E2E')
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Pacientes')
  const tarjetaDe = (t) => page.getByRole('button', { name: new RegExp('\\d+\\s*' + t) })
  await expect(tarjetaDe('Total de pacientes')).toBeVisible({ timeout: 30_000 })
  const tarjetas = ['Total de pacientes', 'Nuevos este mes', 'Con control vencido', 'Con saldo pendiente']
  for (const t of tarjetas) await expect(tarjetaDe(t)).toBeVisible()
  for (const viejo of ['Bien corregidos', 'Requieren ajuste', 'Sin agudeza visual con corrección']) await expect(page.getByText(viejo)).toHaveCount(0)
  // un solo camino (regla 8): ya no hay fila de filtros rápidos; en «Filtrar» solo quedan los que no tienen tarjeta
  await expect(page.locator('button[aria-pressed][title]').filter({ hasText: /^(Todos|Nuevos este mes|Control vencido|Con saldo pendiente|Sin consulta|Dados de alta)/ })).toHaveCount(0)
  await page.getByRole('button', { name: /^Filtrar/ }).click()
  await expect(page.getByRole('button', { name: /Sin consulta/ }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: /Dados de alta/ }).first()).toBeVisible()
  await page.keyboard.press('Escape')
  for (const quitado of ['Consultaron y no compraron', 'Visitas recientes', 'Control sin agendar']) await expect(page.getByRole('button', { name: new RegExp(quitado) })).toHaveCount(0)
  // columnas: paciente, contacto, última visita, próxima cita y acciones; sin «Corrección»
  const encabezado = page.locator('thead th')
  await expect(encabezado).toHaveText([/Paciente/, 'Contacto', 'Última visita', 'Próxima cita', 'Acciones'])
  await expect(page.getByText('Requiere ajuste')).toHaveCount(0)
  // cada tarjeta deja la lista con exactamente su número (regla 5)
  for (const t of tarjetas) {
    const tarjeta = tarjetaDe(t)
    const n = Number((await tarjeta.innerText()).match(/^\d+/)[0])
    await tarjeta.click()
    const total = await page.getByRole('status').filter({ hasText: /paciente/ }).first().innerText()
    const filas = Number((total.match(/(?:Mostrando )?(\d+)/) || [])[1])
    expect(filas, `«${t}»: la lista trae ${filas} y la tarjeta dice ${n}`).toBe(n)
  }
  await tarjetaDe('Total de pacientes').click()
  await foto(page, 'pacientes-lista')
})

test('Pacientes: crear con pasaporte (sin dígito verificador), editar con el calendario flotante, y el paciente aparece en todos lados', async ({ page }) => {
  test.setTimeout(240_000)
  const nombre = nombrePrueba()
  const pasaporte = 'ZQ' + String(Math.floor(Math.random() * 1e7)).padStart(7, '0')
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Pacientes')
  await page.getByRole('button', { name: 'Crear paciente' }).first().click()
  const registro = page.getByRole('dialog', { name: 'Crear paciente' })
  await registro.locator('#p-nombre').fill(nombre)
  // una cédula inventada no pasa; un pasaporte sí, sin esa validación
  await registro.locator('#p-cedula').fill('1715613222')
  await registro.getByRole('button', { name: 'Registrar paciente' }).click()
  await expect(registro.getByText(/Esa cédula no es válida/)).toBeVisible()
  await registro.getByLabel('Tipo de documento').selectOption('pasaporte')
  await expect(registro.getByText(/no pasa por la validación de la cédula ecuatoriana/)).toBeVisible()
  await registro.locator('#p-cedula').fill(pasaporte)
  // el calendario se abre ENCIMA del formulario: el formulario no cambia de alto y el calendario cabe entero en la pantalla
  const altoAntes = (await registro.boundingBox()).height
  await registro.locator('#p-nacimiento').click()
  const calendario = page.getByRole('dialog', { name: 'Elegir fecha' })
  await expect(calendario).toBeVisible()
  await expect(calendario).toBeInViewport({ ratio: 1 })
  expect(Math.abs((await registro.boundingBox()).height - altoAntes), 'el calendario no empuja el formulario').toBeLessThan(2)
  await expect(calendario.getByLabel('Año', { exact: true })).toBeVisible() // selección rápida de año
  await foto(page, 'paciente-crear-calendario-abierto')
  await calendario.getByLabel('Año', { exact: true }).selectOption('1985')
  await calendario.getByLabel('Mes', { exact: true }).selectOption('2')
  await calendario.getByRole('button', { name: '12', exact: true }).click()
  await registro.locator('#p-telefono').fill(telefonoPrueba())
  await registro.getByRole('button', { name: 'Registrar paciente' }).click()
  // mensaje de confirmación y las dos salidas
  await expect(page.getByText('Paciente ingresado al sistema exitosamente.')).toBeVisible({ timeout: 15_000 })
  const hecho = page.getByRole('dialog', { name: 'Paciente registrado' })
  await expect(hecho.getByRole('button', { name: 'Ir al perfil' })).toBeVisible()
  await expect(hecho.getByRole('button', { name: 'Atender ahora' })).toBeVisible()
  await foto(page, 'paciente-registrado')
  await hecho.getByRole('button', { name: 'Ir al perfil' }).click()
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toBeVisible()
  await expect(page.getByText(pasaporte).first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { level: 1, name: nombre })).toHaveCount(0)

  // aparece en la lista (con su tipo de documento), en la búsqueda de citas y en el buscador de ventas
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  const fila = page.locator('tr').filter({ hasText: nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await expect(fila).toContainText('Pasaporte')
  await expect(fila).toContainText('Sin cita')
  await expect(fila).toContainText('Sin consultas')
  await irA(page, 'Citas médicas')
  await page.getByRole('button', { name: 'Gestionar cita' }).click()
  await page.getByPlaceholder(/Escriba para buscar/).fill(nombre.slice(0, 18))
  await expect(page.getByRole('dialog').getByText(nombre).first()).toBeVisible({ timeout: 15_000 })
  await page.keyboard.press('Escape')

  // editar: solo se exigen nombre y documento; lo que falta se sugiere (no bloquea); el calendario flotante también aquí
  await irA(page, 'Pacientes')
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await page.locator('tr').filter({ hasText: nombre }).getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Editar datos' }).dispatchEvent('click')
  const edicion = page.getByRole('dialog', { name: 'Editar paciente' })
  await expect(edicion.getByLabel('Tipo de documento')).toHaveValue('pasaporte')
  await expect(edicion.locator('#p-cedula')).toHaveValue(pasaporte)
  await edicion.locator('#p-telefono').fill('')
  await edicion.locator('#p-nombre').fill(nombre + ' Editado')
  await edicion.locator('#p-nacimiento').click()
  await expect(page.getByRole('dialog', { name: 'Elegir fecha' })).toBeInViewport({ ratio: 1 })
  await foto(page, 'paciente-editar-calendario-abierto')
  await page.keyboard.press('Escape')
  await edicion.getByRole('button', { name: 'Guardar cambios' }).click()
  await expect(page.getByText(/Expediente del paciente actualizado correctamente\. Te sugerimos completar el teléfono, el correo/)).toBeVisible({ timeout: 15_000 })
  // el cambio se ve en la lista y en el perfil
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre + ' Editado')
  await expect(page.locator('tr').filter({ hasText: nombre + ' Editado' })).toHaveCount(1, { timeout: 20_000 })
})

test('WhatsApp de los avisos: el control vencido usa la plantilla que la óptica personalizó y queda en el Seguimiento del CRM', async ({ page }) => {
  test.setTimeout(240_000)
  await prepararAvisosInicio('E2E')
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('ADMIN', 'E2E')
  const api = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  await api.auth.signInWithPassword({ email: correo, password: clave })
  const PROPIA = 'Hola {nombre}, mensaje propio de {óptica} para tu control (E2E).'
  await api.rpc('guardar_plantilla_crm', { p_motivo: 'control_vencido', p_texto: PROPIA })
  try {
    await page.addInitScript(() => { window.open = (url) => { window.__abiertos = [...(window.__abiertos || []), String(url)]; return null } })
    await iniciarSesion(page, 'ADMIN', 'E2E')
    const area = page.getByRole('region', { name: 'Requiere tu atención: Pacientes' })
    await expect(area).toBeVisible({ timeout: 25_000 })
    await area.getByRole('button', { name: /con el control vencido$/ }).click()
    const caso = page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'E Dos E Control Vencido' })
    await caso.getByRole('button', { name: 'WhatsApp' }).click()
    await expect(page.getByText(/WhatsApp abierto para E Dos E Control Vencido\. Queda en el Seguimiento del CRM\./)).toBeVisible({ timeout: 15_000 })
    const url = await page.evaluate(() => (window.__abiertos || []).at(-1))
    const texto = decodeURIComponent(new URL(url).searchParams.get('text'))
    expect(texto).toBe('Hola E Dos E Control Vencido, mensaje propio de QA Test Claude para tu control (E2E).')
    // el contacto está en el Seguimiento del CRM
    await page.keyboard.press('Escape')
    await irA(page, 'CRM y fidelización')
    await page.getByRole('tab', { name: /Seguimiento/ }).click()
    await expect(page.getByText('E Dos E Control Vencido').first()).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Control vencido').first()).toBeVisible()
    await foto(page, 'crm-seguimiento-contacto-de-aviso')
  } finally {
    await api.rpc('guardar_plantilla_crm', { p_motivo: 'control_vencido', p_texto: '' }) // vuelve al mensaje base
  }
})

test('WhatsApp de «Contactar al paciente»: usa la plantilla «Cita no efectuada» del CRM y deja el contacto en el seguimiento de la cita y en el CRM', async ({ page }) => {
  test.setTimeout(240_000)
  await prepararAvisosInicio('E2E')
  await page.addInitScript(() => { window.open = (url) => { window.__abiertos = [...(window.__abiertos || []), String(url)]; return null } })
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const area = page.getByRole('region', { name: 'Requiere tu atención: Citas' })
  await expect(area).toBeVisible({ timeout: 25_000 })
  await area.getByRole('button', { name: /por contactar$/ }).click()
  const caso = page.getByRole('dialog').getByRole('listitem').filter({ hasText: 'E Dos E Faltó A Su Cita' })
  await caso.getByRole('button', { name: 'Escribir por WhatsApp' }).click()
  await expect(page.getByText(/WhatsApp abierto para E Dos E Faltó A Su Cita\. Queda en el Seguimiento del CRM\./)).toBeVisible({ timeout: 15_000 })
  const url = await page.evaluate(() => (window.__abiertos || []).at(-1))
  const texto = decodeURIComponent(new URL(url).searchParams.get('text'))
  expect(texto).toMatch(/^Hola E Dos E Faltó A Su Cita, te escribimos de QA Test Claude\. No pudimos atenderte en tu cita del .+ a las 09:00 AM\./)
})
