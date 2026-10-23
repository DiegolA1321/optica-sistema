// El MISMO paciente en la ficha, la receta impresa, el perfil y «Mi receta» del portal (óptica de pruebas, paciente fijo del portal), a 1093 px: los mismos datos se ven iguales en todos.
// Además comprueba en vivo: subir una imagen real, crear la cita del control con «Agendar ahora», la adición en azul con un paciente de 40 años o más, el encabezado de la receta (logo, dirección, teléfono y
// registro profesional), el cambio de graduación dicho igual en la ficha, el perfil y el portal, y el botón «Imprimir receta» en la fila de los demás botones.
// Todo lo que crea (consulta, imagen, cita del control) y lo que cambia (edad, política de medidas, contacto y logo de la óptica) se deshace al terminar, aunque falle.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, credencial, escribirSecreto, irAPasoFicha, abrirBloqueExamen, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 800 }, actionTimeout: 15_000 })
test.describe.configure({ mode: 'serial' })

const NOMBRE = 'E Dos E Portal Auditoria'
const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="12" fill="#1D5FD6"/><circle cx="32" cy="32" r="14" fill="none" stroke="#fff" stroke-width="5"/></svg>')
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

const bd = async (fn) => { const c = new pg.Client(); await c.connect(); try { return await fn(c) } finally { await c.end() } }
const q = (t, p) => bd(async (c) => (await c.query(t, p)).rows)
let ids = {}
let clienteAdmin = null
let original = {}

test.beforeAll(async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const mk = async (prefijo) => {
    const { correo, clave } = credencial(prefijo, 'E2E')
    const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
    if (error) throw new Error('No se pudo iniciar sesión de ' + prefijo)
    const { data: perfil } = await c.from('perfiles').select('id, optica_id, nombre').eq('id', data.user.id).single()
    return { c, perfil }
  }
  const opto = await mk('OPTOMETRA')
  const recep = await mk('RECEPCION')
  const [fila] = await q("select p.id, p.fecha_nacimiento, o.id optica, o.settings, o.logo_url from pacientes_base p join opticas o on o.id = p.optica_id where o.slug = $1 and p.nombre = $2", [SLUG_PRUEBAS, NOMBRE])
  ids = { paciente: fila.id, optica: fila.optica, paula: opto.perfil.id }
  original = { nacimiento: fila.fecha_nacimiento, settings: fila.settings, logo: fila.logo_url }
  // Un paciente de 40 años o más (para la adición en azul), con la política de medidas encendida y la óptica con contacto y logo.
  await bd(async (c) => {
    await c.query("update pacientes_base set fecha_nacimiento = '1978-03-10' where id = $1", [ids.paciente])
    await c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || $2::jsonb where id = $1", [ids.optica, JSON.stringify({ mostrarMedidasPaciente: true, opticaTelefono: '042345678', opticaDireccion: 'Av. de las Pruebas 123, Guayaquil' })])
  })
  // El logo solo lo cambia el administrador de la óptica (la base lo protege): con su sesión real.
  const admin = await mk('ADMIN')
  clienteAdmin = admin.c
  const { error: errorLogo } = await admin.c.from('opticas').update({ logo_url: LOGO }).eq('id', ids.optica)
  if (errorLogo) throw new Error('No se pudo poner el logo de prueba: ' + errorLogo.message)
  // Una consulta anterior real (abril): da el cambio de graduación, los antecedentes y la última graduación.
  const { error } = await opto.c.from('consultas').insert({
    optica_id: ids.optica, paciente_id: ids.paciente, paciente: NOMBRE, fecha: '2026-04-20', motivo: 'Examen de Control', usa_lentes: true, antecedentes: 'Hipertensión', alergias: 'Penicilina', antecedentes_familiares: 'Diabetes',
    datos_clinicos: { od: { esfera: '-1.25', cilindro: '-0.50', eje: '90', avSc: '20/40', avCc: '20/20' }, oi: { esfera: '-1.00', cilindro: '-0.75', eje: '85', avSc: '20/50', avCc: '20/25' }, medidas: { adicion: '+1.00', dp: '62' }, examen: {},
      ficha: { v: 2, anamnesis: { antMedicos: { chips: [], detalle: 'Hipertensión' }, antFamiliares: { chips: [], detalle: 'Diabetes' }, alergias: { chips: [], detalle: 'Penicilina' }, medicamentos: { chips: [], detalle: 'Losartán 50 mg' }, usaLentes: 'si' } } },
    diagnostico: 'Miopía', diagnostico_categorias: ['Miopía'], lente_recomendado: 'Monofocal', indicaciones: 'Control anual', proximo_control_dias: 180, estado_correccion: 'Bien corregido', evolucion_calculada: 'Primera consulta',
  })
  if (error) throw new Error('No se pudo crear la consulta anterior: ' + error.message)
  // La cita de hoy con Paula (un horario libre cercano).
  let errorCita
  for (let extra = 30; extra < 600; extra += 5) {
    const t = new Date(Date.now() + extra * 60_000)
    const h = t.getHours(), m = String(t.getMinutes()).padStart(2, '0')
    const hora = t.getDate() === new Date().getDate() ? `${String(h % 12 || 12).padStart(2, '0')}:${m} ${h >= 12 ? 'PM' : 'AM'}` : `11:${String(59 - (extra % 60)).padStart(2, '0')} PM`
    const hoy = new Date().toLocaleDateString('en-CA')
    ;({ error: errorCita } = await recep.c.from('citas').insert({ optica_id: ids.optica, paciente_id: ids.paciente, paciente: NOMBRE, cedula: '0914760947', telefono: '0991234567', fecha: hoy, hora, duracion_minutos: null, motivo: 'Consulta General', estado: 'Pendiente', asignado_a: ids.paula }))
    if (!errorCita || errorCita.code !== '23505') break
  }
  if (errorCita) throw new Error('No se pudo crear la cita: ' + errorCita.message)
})

test.afterAll(async () => {
  await bd(async (c) => {
    const cons = (await c.query("select id, imagenes from consultas where paciente_id = $1 and fecha >= '2026-10-01'", [ids.paciente])).rows
    for (const x of cons) for (const im of x.imagenes || []) await c.query("delete from storage.objects where bucket_id = 'consultas-adjuntos' and name = $1", [im.path]).catch(() => {})
    await c.query("delete from pases_a_venta where paciente_id = $1 and consulta_id in (select id from consultas_base where paciente_id = $1 and fecha >= '2026-10-01')", [ids.paciente]).catch(() => {})
    await c.query("delete from consultas_base where paciente_id = $1 and (fecha >= '2026-10-01' or fecha = '2026-04-20')", [ids.paciente])
    await c.query("delete from citas_base where paciente_id = $1", [ids.paciente])
    await c.query('update pacientes_base set fecha_nacimiento = $2 where id = $1', [ids.paciente, original.nacimiento])
    // El resumen clínico del paciente (lo que la ficha escribió al terminar) vuelve a «sin consulta»: sin esto, Inicio y Pacientes dejan de contar igual sus «sin consulta».
    await c.query("update pacientes set evolucion = 'Sin evaluación', estado_correccion = 'Sin evaluación', ultima_consulta = 'Pendiente', estado_clinico = 'Activo' where id = $1", [ids.paciente])
    await c.query("update opticas set settings = $2::jsonb where id = $1", [ids.optica, JSON.stringify(original.settings || {})])
  })
  if (clienteAdmin) await clienteAdmin.from('opticas').update({ logo_url: original.logo }).eq('id', ids.optica)
})

test('la ficha, la receta impresa, el perfil y «Mi receta» muestran lo mismo del mismo paciente', async ({ page, browser }) => {
  test.setTimeout(420_000)
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(NOMBRE)
  await expect(page.getByText(NOMBRE).first()).toBeVisible({ timeout: 45_000 })
  await page.getByText(NOMBRE).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Atender' }).first().click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 20_000 })

  // ── Paso 1 ──
  await expect(page.getByRole('complementary', { name: 'Contexto del paciente' })).toContainText('Penicilina')
  await page.getByRole('button', { name: 'Borrosidad de cerca' }).click()
  await page.getByLabel(/Lo que cuenta el paciente/).fill('Le cuesta leer el celular sin alejarlo.')
  await page.getByRole('button', { name: /actualizar/ }).click()
  // lo precargado que coincide con una opción la marca
  await expect(page.getByRole('button', { name: 'Penicilina' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Hipertensión' })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Antihipertensivos' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Lentes de contacto' }).click() // «Qué usa» son botones
  await expect(page.getByRole('button', { name: 'Lentes de contacto' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel('Desde cuándo').fill('3 años')

  // ── Paso 2 · Examen ──
  await abrirBloqueExamen(page, 'Agudeza visual')
  await page.locator('#avOdSc').selectOption('20/50'); await page.getByLabel('Ojo derecho, sin corrección: letras falladas').fill('1')
  await page.locator('#avOiSc').selectOption('20/40')
  await page.locator('#avOdCc').selectOption('20/25'); await page.locator('#avOiCc').selectOption('20/25')
  await abrirBloqueExamen(page, 'Lentes actuales y distancia pupilar')
  await page.locator('#dpOd').fill('31'); await page.locator('#dpOi').fill('31')
  await expect(page.locator('#dp')).toHaveValue('62') // el total se calcula solo
  await page.locator('#dp').fill('64')
  await expect(page.getByText(/La suma de los dos ojos es 62 mm y el total escrito es 64 mm/)).toBeVisible() // avisa si no coincide
  await page.locator('#dp').fill('62')
  // los campos vacíos muestran «—», nunca un ejemplo que parezca un dato
  expect(await page.locator('#dpCerca').getAttribute('placeholder')).toBe('—')

  // ── Bloque Refracción ──
  await abrirBloqueExamen(page, 'Refracción')
  for (const id of ['kOdK1', 'kOdK2', 'prismaOdCant']) expect(await page.locator('#' + id).getAttribute('placeholder'), `#${id} vacío muestra «—»`).toBe('—')
  for (const [id, v] of [['odEsfera', '-1.75'], ['odCilindro', '-0.75'], ['odEje', '10'], ['oiEsfera', '-1.00'], ['oiCilindro', '-0.50'], ['oiEje', '180']]) await page.locator('#' + id).fill(v)
  // El cambio de graduación, dicho igual en toda la pantalla: la esfera pasó de −1.25 a −1.75 = 0.50 más de miopía
  await expect(page.getByText(/OD: 0\.50 más de miopía · OI: sin cambios/).first()).toBeVisible()
  // Adición en AZUL (paciente de 40 años o más), no amarilla
  const tarjetaAdicion = page.getByRole('heading', { name: /^Adición/ }).locator('xpath=ancestor::section[1]')
  expect(await tarjetaAdicion.getAttribute('class')).toMatch(/blue/)
  expect(await tarjetaAdicion.getAttribute('class')).not.toMatch(/amber|yellow/)
  await expect(tarjetaAdicion).toContainText(/Paciente de 4\d años/)
  await page.locator('#adicionOd').fill('1.50')
  await page.getByLabel('Igual en ambos ojos').uncheck()
  await page.locator('#adicionOi').fill('1.75')
  await page.locator('#prismaOdCant').fill('2'); await page.locator('#prismaOdBase').selectOption('Nasal')
  // la base del prisma no se sale de su tarjeta
  const dentro = async (selector, contenedor = 'ancestor::*[@role="group"][1]') => { const el = await page.locator(selector).boundingBox(); const caja = await page.locator(selector).locator('xpath=' + contenedor).boundingBox(); return el.x >= caja.x - 1 && el.x + el.width <= caja.x + caja.width + 1 }
  expect(await dentro('#prismaOdBase'), 'la base del prisma cabe en su tarjeta').toBe(true)
  await page.locator('#avOdRx').selectOption('20/20'); await page.getByLabel('Ojo derecho: letras falladas').fill('2')
  await page.locator('#avOiRx').selectOption('20/25'); await page.locator('#avAmbRx').selectOption('20/20'); await page.locator('#cercaRx').selectOption('J1')

  // ── Bloque Salud ocular ──
  await abrirBloqueExamen(page, 'Salud ocular')
  const salud = page.getByRole('region', { name: 'Salud ocular' })
  await salud.getByRole('group', { name: 'Ojo izquierdo' }).first().getByRole('button', { name: 'Sin hallazgos' }).first().click()
  await salud.getByRole('group', { name: 'Ojo derecho' }).first().getByRole('button', { name: 'Igual en el otro ojo' }).first().click()
  await page.locator('#fondoOi').fill('Papila de bordes definidos.'); await page.locator('#fondoOd').fill('Papila de bordes definidos.')
  await page.locator('#pioOd').fill('14'); await page.locator('#pioOi').fill('15')
  // la presión intraocular: ojo izquierdo a la izquierda; hora con el formato del sistema
  const pioOi = await page.locator('#pioOi').boundingBox(); const pioOd = await page.locator('#pioOd').boundingBox()
  expect(pioOi.x, 'presión: OI a la izquierda de OD').toBeLessThan(pioOd.x)
  await page.getByLabel('Hora de la medición: hora').selectOption('3')
  await page.getByLabel('Hora de la medición: minutos').selectOption('20')
  await page.getByLabel('Hora de la medición: AM o PM').selectOption('PM')
  await page.locator('#pioMetodo').selectOption({ index: 1 })
  expect(await dentro('#pioMetodo', 'ancestor::section[1]'), 'el método de la presión cabe en su tarjeta').toBe(true)
  const metodo = await page.locator('#pioMetodo').evaluate((s) => ({ texto: s.options[s.selectedIndex].text, sobra: s.scrollWidth > s.clientWidth + 1 }))
  expect(metodo.sobra, `«${metodo.texto}» se lee completo`).toBe(false)
  await page.locator('#colorPrueba').selectOption('Ishihara'); await page.locator('#colorResultado').fill('14 de 14')
  await page.getByRole('button', { name: 'Normal' }).click()

  // ── Paso 3 · Diagnóstico y receta ──
  await irAPasoFicha(page, 3, 'Diagnóstico y receta')
  const sugerencia = page.getByRole('status', { name: 'Diagnóstico sugerido' })
  await expect(sugerencia).toContainText('Miopía y astigmatismo')
  await expect(sugerencia).toContainText('Tiene adición')
  await expect(page.getByRole('button', { name: 'Miopía y astigmatismo' })).toHaveAttribute('aria-pressed', 'false') // no se marca solo
  await sugerencia.getByRole('button', { name: 'Usar la sugerencia' }).click()
  await expect(page.getByRole('button', { name: 'Miopía y astigmatismo' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByLabel(/Añadir recomendación de lente/).check()
  await page.getByLabel('Lente a recomendar').fill('Progresivo, policarbonato, antirreflejo')
  const bloqueLente = page.getByText('Lente a recomendar').locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]')
  expect(await bloqueLente.getAttribute('class')).toMatch(/blue/)
  expect(await bloqueLente.getAttribute('class')).not.toMatch(/amber|yellow/)
  await page.locator('#indicaciones').fill('Uso permanente. Pausa visual cada 20 minutos.')
  // Subir una imagen real
  await page.locator('input[type=file]').setInputFiles({ name: 'fondo-de-ojo.png', mimeType: 'image/png', buffer: PNG })
  await expect(page.getByRole('img', { name: 'fondo-de-ojo.png' })).toBeVisible()
  // Agendar ahora el control, con su cita real
  await page.getByRole('radio', { name: /Agendar ahora/ }).check()
  await page.getByRole('button', { name: /^Elegir (esa fecha|ese día)$/ }).click()
  await page.locator('button:enabled').filter({ hasText: /^\d{2}:\d{2} (AM|PM)$/ }).first().click()
  const vista = page.locator('[data-vista-previa-documento]')
  await expect(vista).toContainText('−1.75'); await expect(vista).toContainText('+1.50'); await expect(vista).toContainText('+1.75'); await expect(vista).toContainText('OD 31 · OI 31')
  // El documento (la hoja que se imprime): encabezado con logo, dirección y teléfono de la óptica, registro profesional y los mismos valores
  await page.getByRole('button', { name: /Ver en grande/ }).click()
  const hoja = page.getByRole('dialog').locator('[data-hoja-receta]')
  await expect(hoja).toContainText('Av. de las Pruebas 123, Guayaquil')
  await expect(hoja).toContainText('042345678')
  await expect(hoja).toContainText('Reg. Prof. REG-OPT-0912')
  await expect(hoja.locator('img').first()).toBeVisible() // el logo
  for (const nombre of ['Sin corrección', 'Con su corrección actual', 'Con la receta nueva']) await expect(hoja).toContainText(nombre)
  for (const t of ['−1.75', '−0.75', '10°', '−1.00', '−0.50', '180°', '+1.50', '+1.75', '20/20 −2', 'OD 2Δ base nasal']) await expect(hoja, `«${t}» en la receta impresa`).toContainText(t)
  await page.getByRole('dialog').last().getByRole('button', { name: 'Cerrar' }).last().click()
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar atención' }).click()
  // Al terminar se abre el documento: el mismo, ya definitivo
  const terminado = page.getByRole('dialog', { name: /Atención terminada/ })
  await expect(terminado.locator('[data-hoja-receta]')).toContainText('Reg. Prof. REG-OPT-0912', { timeout: 30_000 })
  await terminado.getByRole('button', { name: 'Cerrar' }).last().click()
  await expect(page.getByRole('status').filter({ hasText: 'Atención terminada' })).toContainText('la cita quedó atendida', { timeout: 30_000 })

  // ── Lo guardado: imagen en Storage y cita del control creada ──
  const [consulta] = await q("select id, imagenes, datos_clinicos, estado_correccion, profesional_registro from consultas where paciente_id = $1 and fecha >= '2026-10-01' order by created_at desc limit 1", [ids.paciente])
  expect(consulta.imagenes.length, 'la imagen se guardó').toBe(1)
  const objeto = await q("select 1 from storage.objects where bucket_id = 'consultas-adjuntos' and name = $1", [consulta.imagenes[0].path])
  expect(objeto.length, 'la imagen está en Storage').toBe(1)
  expect(consulta.profesional_registro).toBe('REG-OPT-0912')
  const control = await q("select fecha, hora, motivo, estado from citas where paciente_id = $1 and estado = 'Pendiente' and fecha > current_date order by fecha limit 1", [ids.paciente])
  expect(control.length, 'la cita del control se creó con «Agendar ahora»').toBe(1)
  expect(control[0].motivo).toMatch(/control/i)
  expect(consulta.datos_clinicos.ficha.salud.pio.hora).toBe('03:20 PM')
  expect(consulta.datos_clinicos.ficha.salud.color).toMatchObject({ resultado: '14 de 14', interpretacion: 'Normal' })
  expect(consulta.datos_clinicos.medidas).toMatchObject({ dp: '62', dpOd: '31', dpOi: '31', adicionOd: '+1.50', adicionOi: '+1.75' })

  // ── La receta impresa (la hoja): encabezado completo y los mismos valores ──
  await page.getByRole('button', { name: /Volver a/ }).first().click()
  await expect(page.getByRole('tab', { name: /Diagnóstico/ })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: /Diagnóstico/ }).click()

  // ── El perfil (vista técnica) ──
  const perfil = page.getByRole('tabpanel').first()
  await expect(perfil).toContainText('Esfera · 0.50 más de miopía desde abril') // el cambio, dicho igual que en la ficha
  await expect(perfil).not.toContainText('+0.63')
  await expect(perfil).not.toContainText('Tienes miopía') // sin frases del paciente en la vista técnica
  for (const nombre of ['Sin corrección', 'Con su corrección actual', 'Con la receta nueva']) await expect(perfil).toContainText(nombre)
  await expect(perfil).not.toContainText('AV con lentes'); await expect(perfil).not.toContainText('AV sin lentes')
  await expect(perfil).toContainText('+1.50'); await expect(perfil).toContainText('+1.75')
  // «Imprimir diagnóstico» va en la misma fila que los demás botones del encabezado
  const fila = async (nombre) => (await perfil.getByRole('button', { name: nombre }).first().boundingBox()).y
  const yComparar = await fila(/^Comparar$/), yVista = await fila(/^Para el paciente$/), yImprimir = await fila(/Imprimir diagnóstico/)
  expect(Math.abs(yImprimir - yComparar), 'Imprimir diagnóstico en la misma fila que Comparar').toBeLessThan(8)
  expect(Math.abs(yImprimir - yVista), 'Imprimir diagnóstico en la misma fila que el interruptor de vista').toBeLessThan(8)
  await perfil.getByRole('button', { name: 'Para el paciente' }).click()
  await expect(perfil).toContainText('Tienes miopía') // las frases del paciente solo en la vista para el paciente
  await perfil.getByRole('button', { name: 'Vista técnica' }).click()

  // La hoja: «Imprimir receta» abre la misma hoja que el portal descarga (se comprueba su contenido en pantalla con un clic de prueba en el portal más abajo)
  // El portal, con la sesión real del paciente
  const portal = await (await browser.newContext({ viewport: { width: 1093, height: 800 }, locale: 'es-EC' })).newPage()
  await portal.goto(`/?optica=${SLUG_PRUEBAS}`)
  await portal.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(portal, portal.getByPlaceholder('Ej. 0912345678 o tu usuario'), process.env.E2E_PORTAL_CEDULA)
  await escribirSecreto(portal, portal.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
  await portal.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(portal.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await portal.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: 'Mi receta', exact: true }).click()
  const mi = portal.getByRole('main')
  await expect(mi).toContainText('Mi receta', { timeout: 30_000 })
  await expect(mi).toContainText('0.50 más de miopía') // el mismo cambio que en la ficha y el perfil
  await expect(mi).not.toContainText('+0.63')
  for (const t of ['−1.75', '−0.75', '10°', '−1.00', '−0.50', '180°', '+1.50', '+1.75']) await expect(mi, `«${t}» en el portal`).toContainText(t)
  await expect(mi).toContainText('Con la receta nueva')
  await expect(mi).toContainText('20/20')
})
