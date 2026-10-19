// La ficha clínica de cinco pasos, de punta a punta con datos reales (óptica de pruebas, solo ella) y a 1093 px de ancho (laptop con escala del 125 %):
// llena los cinco pasos, comprueba lo que se pidió (orden de los ojos, nombres de pasos en una línea, transposición, adición en azul, agudeza con la receta nueva en un solo dato, antecedentes
// precargados, últimas visitas en solo lectura, motivo del catálogo, estado de corrección con la receta nueva), TERMINA la atención y verifica lo guardado en la base y su reflejo en el perfil.
// Capturas de cada paso en docs/ficha-cinco-pasos/.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, crearCitaDeHoyParaPaula, credencial, irAPasoFicha } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 800 }, actionTimeout: 15_000 })
test.describe.configure({ mode: 'serial' })

const CARPETA = 'docs/ficha-cinco-pasos'
const foto = async (page, nombre) => {
  fs.mkdirSync(CARPETA, { recursive: true })
  // La ficha se desplaza dentro de su zona: para ver el paso completo se alarga la ventana solo el tiempo de la captura (el ancho sigue siendo 1093 px).
  await page.setViewportSize({ width: 1093, height: 2600 })
  await page.waitForTimeout(700)
  await page.screenshot({ path: `${CARPETA}/${nombre}-1093.png` })
  await page.setViewportSize({ width: 1093, height: 800 })
  await page.waitForTimeout(200)
}

let nombre = ''
let cliente = null
let pacienteId = null

async function sesionOptometra() {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('OPTOMETRA', 'E2E')
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del optómetra para preparar los datos.')
  const { data: perfil } = await c.from('perfiles').select('optica_id').eq('id', data.user.id).single()
  return { c, opticaId: perfil.optica_id }
}

test.beforeAll(async () => {
  nombre = await crearCitaDeHoyParaPaula('E2E')
  const { c, opticaId } = await sesionOptometra()
  cliente = c
  const { data: p } = await c.from('pacientes').select('id').eq('nombre', nombre).single()
  pacienteId = p.id
  // Una consulta anterior real: da contexto (alergia, antecedentes, última graduación) y se precargan sus antecedentes.
  const { error } = await c.from('consultas').insert({
    optica_id: opticaId, paciente_id: pacienteId, paciente: nombre, fecha: '2026-04-20', motivo: 'Examen de Control', usa_lentes: true,
    antecedentes: 'Hipertensión', alergias: 'Penicilina', antecedentes_familiares: 'Diabetes',
    datos_clinicos: { od: { esfera: '-1.25', cilindro: '-0.50', eje: '90', avSc: '20/40', avCc: '20/20' }, oi: { esfera: '-1.00', cilindro: '-0.75', eje: '85', avSc: '20/50', avCc: '20/25' }, medidas: { adicion: '+1.00', dp: '62' }, examen: {} },
    diagnostico: 'Miopía', diagnostico_categorias: ['Miopía'], lente_recomendado: 'Monofocal', indicaciones: 'Control anual', proximo_control_dias: 180, estado_correccion: 'Bien corregido', evolucion_calculada: 'Primera consulta',
  })
  if (error) throw new Error('No se pudo crear la consulta anterior: ' + error.message)
})

test('ficha de cinco pasos: se llena, se termina y todo queda como se pidió', async ({ page }) => {
  test.setTimeout(240_000)
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 45_000 })
  await page.getByText(nombre).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: 'Ingresar' }).first().click()
  await expect(page.getByText('Paso 1 de 5')).toBeVisible({ timeout: 20_000 })

  // ── La barra: cinco pasos, cada nombre en UNA línea, sin desplazamiento horizontal ──
  const barra = page.getByRole('navigation', { name: 'Pasos de la ficha clínica' })
  for (const [n, t] of [[1, 'Anamnesis'], [2, 'Agudeza visual'], [3, 'Refracción'], [4, 'Salud ocular'], [5, 'Diagnóstico y receta']]) {
    const boton = barra.getByRole('button', { name: new RegExp(`^Paso ${n}: ${t}`) })
    await expect(boton).toBeVisible()
    const nombreDelPaso = boton.getByText(t, { exact: true })
    const caja = await nombreDelPaso.evaluate((el) => ({ alto: el.getBoundingClientRect().height, lineHeight: parseFloat(getComputedStyle(el).lineHeight), sobra: el.scrollWidth > el.clientWidth + 1 }))
    expect(caja.alto, `«${t}» en una sola línea`).toBeLessThanOrEqual(caja.lineHeight * 1.2)
    expect(caja.sobra, `«${t}» sin recortarse`).toBe(false)
  }
  const ancho = await page.evaluate(() => ({ doc: document.documentElement.scrollWidth, ven: window.innerWidth }))
  expect(ancho.doc, 'sin desplazamiento horizontal').toBeLessThanOrEqual(ancho.ven)

  // ── Paso 1 · Anamnesis ──
  await expect(page.getByText('(de la cita)')).toBeVisible() // el motivo viene del catálogo, con la cita
  await expect(page.getByRole('button', { name: 'Cambiar' })).toBeVisible()
  await expect(page.getByText('Ya registrados el')).toBeVisible() // antecedentes precargados
  const panel = page.getByRole('complementary', { name: 'Contexto del paciente' })
  await expect(panel).toContainText('Penicilina')
  await expect(panel).toContainText('-1.25 -0.50 × 90°')
  await page.getByRole('button', { name: 'Borrosidad de cerca' }).click()
  await page.getByRole('button', { name: 'Dolor de cabeza' }).click()
  await page.getByLabel(/Lo que cuenta el paciente/).fill('Le cuesta leer el celular sin alejarlo; termina el día con dolor de cabeza.')
  await page.getByRole('button', { name: /actualizar/ }).click()
  await expect(page.getByRole('button', { name: 'Ninguna conocida' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Ninguno' }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Queratocono' }).click()
  await page.getByLabel('Cuáles').fill('Losartán 50 mg')
  await page.getByRole('button', { name: 'Hipertensión' }).click()
  await page.getByLabel('Desde cuándo').fill('3 años')
  await foto(page, 'paso-1-anamnesis')
  // Las últimas visitas se abren en solo lectura
  await panel.getByRole('button', { name: /Examen de Control/ }).click()
  await expect(page.getByRole('heading', { name: /Ficha del/ })).toBeVisible()
  await expect(page.getByRole('dialog').last()).toContainText('Penicilina')
  await page.getByRole('dialog').last().getByRole('button', { name: 'Cerrar' }).last().click()

  // ── Paso 2 · Agudeza visual ──
  await irAPasoFicha(page, 2, 'Agudeza visual')
  const filas = page.locator('table').first().locator('tbody tr')
  await expect(filas.nth(0)).toContainText('Ojo derecho') // el derecho arriba, como en la receta
  await expect(filas.nth(1)).toContainText('Ojo izquierdo')
  await expect(filas.nth(2)).toContainText('Ambos ojos')
  await page.locator('#avOdSc').selectOption('20/50'); await page.getByLabel('Ojo derecho, sin corrección: letras falladas').fill('1')
  await page.locator('#avOiSc').selectOption('20/40')
  await page.locator('#avAmbSc').selectOption('20/40')
  await page.locator('#avOdCc').selectOption('20/25'); await page.locator('#avOiCc').selectOption('20/25')
  await page.getByLabel('De cerca, sin corrección', { exact: true }).selectOption('J3')
  await page.getByLabel('De cerca, con su corrección actual', { exact: true }).selectOption('J1')
  await page.getByRole('button', { name: 'Copiar de la última receta' }).click()
  await expect(page.locator('#actOdEsfera')).toHaveValue('-1.25')
  await page.locator('#dp').fill('62'); await page.locator('#dpOd').fill('31'); await page.locator('#dpOi').fill('31'); await page.locator('#dpCerca').fill('59')
  await page.locator('#coverTipo').selectOption('Exoforia'); await page.locator('#coverMagnitud').fill('4'); await page.locator('#coverDistancia').selectOption('ambas')
  await page.locator('#testMotor').fill('Movimientos suaves y completos en las nueve posiciones')
  // Ojo izquierdo a la izquierda y derecho a la derecha en las tarjetas lado a lado
  const lentes = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Lentes actuales' }) })
  const [xOi, xOd] = await Promise.all([lentes.getByRole('group', { name: 'Ojo izquierdo' }).boundingBox(), lentes.getByRole('group', { name: 'Ojo derecho' }).boundingBox()])
  expect(xOi.x, 'OI a la izquierda de OD (lentes actuales)').toBeLessThan(xOd.x)
  await foto(page, 'paso-2-agudeza-visual')

  // ── Paso 3 · Refracción ──
  await irAPasoFicha(page, 3, 'Refracción')
  await page.locator('#objMetodo').selectOption('autorrefractometro')
  for (const [id, v] of [['objOdEsfera', '-1.50'], ['objOdCilindro', '-0.75'], ['objOdEje', '90'], ['objOiEsfera', '-1.25'], ['objOiCilindro', '-0.75'], ['objOiEje', '85']]) await page.locator('#' + id).fill(v)
  await page.getByRole('button', { name: 'Usar como punto de partida' }).click()
  await expect(page.locator('#odEsfera')).toHaveValue('-1.50')
  for (const [id, v] of [['kOdK1', '43.25'], ['kOdK2', '44.00'], ['kOdEje', '90']]) await page.locator('#' + id).fill(v)
  // Refracción final: OD −1.75 −0.75 × 10; OI con cilindro POSITIVO (+0.50 × 90) para probar la transposición
  for (const [id, v] of [['odEsfera', '-1.75'], ['odCilindro', '-0.75'], ['odEje', '10'], ['oiEsfera', '-1.50'], ['oiCilindro', '0.50'], ['oiEje', '90']]) await page.locator('#' + id).fill(v)
  await expect(page.getByText('El cilindro va en negativo')).toBeVisible()
  await page.getByRole('button', { name: 'Transponer' }).click()
  await expect(page.locator('#oiEsfera')).toHaveValue('-1.00')
  await expect(page.locator('#oiCilindro')).toHaveValue('-0.50')
  await expect(page.locator('#oiEje')).toHaveValue('180')
  // Adición en azul (paciente de 36 años: «discreta» no aplica; se comprueba el color del bloque) y prisma por ojo
  await page.locator('#adicionOd').fill('1.50')
  await page.getByLabel('Igual en ambos ojos').uncheck()
  await page.locator('#adicionOi').fill('1.75')
  await page.locator('#prismaOdCant').fill('2'); await page.locator('#prismaOdBase').selectOption('Nasal')
  await page.locator('#avOdRx').selectOption('20/20'); await page.getByLabel('Ojo derecho: letras falladas').fill('2')
  await page.locator('#avOiRx').selectOption('20/25'); await page.locator('#avAmbRx').selectOption('20/20'); await page.locator('#cercaRx').selectOption('J1')
  const final = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Refracción final' }) })
  const [fOi, fOd] = await Promise.all([final.getByRole('group', { name: 'Ojo izquierdo' }).boundingBox(), final.getByRole('group', { name: 'Ojo derecho' }).boundingBox()])
  expect(fOi.x, 'OI a la izquierda de OD (refracción final)').toBeLessThan(fOd.x)
  const claseAdicion = await page.getByRole('heading', { name: /^Adición/ }).locator('xpath=ancestor::section[1]').getAttribute('class')
  expect(claseAdicion).not.toMatch(/amber|yellow/) // el amarillo es advertencia
  // Campos del tamaño de lo que se escribe: un número no se estira a todo el ancho
  const anchoNumero = (await page.locator('#odEsfera').boundingBox()).width
  expect(anchoNumero, 'un número es un campo pequeño').toBeLessThan(90)
  await foto(page, 'paso-3-refraccion')
  // La agudeza con la receta nueva es UN solo dato: se ve en la tabla del paso 2
  await irAPasoFicha(page, 2, 'Agudeza visual')
  await expect(page.locator('[data-av-rx="Od"]')).toHaveText('20/20 −2')
  await expect(page.locator('[data-av-rx="Cerca"]')).toHaveText('J1')

  // ── Paso 4 · Salud ocular ──
  await irAPasoFicha(page, 4, 'Salud ocular')
  const izq = page.getByRole('group', { name: 'Ojo izquierdo' }).first()
  await izq.getByRole('button', { name: 'Sin hallazgos' }).first().click()
  await page.getByRole('group', { name: 'Ojo derecho' }).first().getByRole('button', { name: 'Igual en el otro ojo' }).first().click()
  await expect(page.locator('#bioOdCornea')).toHaveValue('Sin hallazgos')
  await page.locator('#fondoOi').fill('Papila de bordes definidos, relación copa/disco 0.3.')
  await page.getByRole('group', { name: 'Ojo derecho' }).nth(1).getByRole('button', { name: 'Igual en el otro ojo' }).click()
  await page.locator('#pioOd').fill('14'); await page.locator('#pioOi').fill('15')
  await page.getByLabel('Hora de la medición: hora').selectOption('3'); await page.getByLabel('Hora de la medición: minutos').selectOption('20'); await page.getByLabel('Hora de la medición: AM o PM').selectOption('PM')
  await page.locator('#pioMetodo').selectOption({ index: 1 })
  await page.locator('#colorPrueba').selectOption('Ishihara'); await page.locator('#colorResultado').fill('14 de 14'); await page.getByRole('button', { name: 'Normal' }).click()
  await foto(page, 'paso-4-salud-ocular')

  // ── Paso 5 · Diagnóstico y receta ──
  await irAPasoFicha(page, 5, 'Diagnóstico y receta')
  // Las categorías son las del catálogo de la óptica
  await expect(page.getByRole('button', { name: /^Miop[ií]a$/ }).first()).toBeVisible()
  await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
  await page.getByLabel(/Añadir recomendación de lente/).check()
  await page.getByLabel('Lente a recomendar').fill('Progresivo, policarbonato, antirreflejo')
  await page.locator('#indicaciones').fill('Uso permanente. Pausa visual cada 20 minutos frente a pantallas.')
  await page.getByRole('radio', { name: /Agendar después/ }).check()
  // La vista previa del panel muestra los MISMOS valores que se guardarán (OI transpuesto, adición por ojo, prisma, DP por ojo, lente)
  const resumen = page.locator('[data-receta-resumen]')
  await expect(resumen).toContainText('−1.00')
  await expect(resumen).toContainText('180°')
  await expect(resumen).not.toContainText('−1.50 −0.50')
  await expect(resumen).toContainText('OD +1.50 · OI +1.75')
  await expect(resumen).toContainText('OD 31 · OI 31')
  await expect(resumen).toContainText('OD 2Δ nasal')
  await expect(resumen).toContainText('Progresivo, policarbonato, antirreflejo')
  await foto(page, 'paso-5-diagnostico-y-receta')
  await page.getByRole('button', { name: /Ver la hoja completa/ }).click()
  const hoja = page.locator('[data-hoja-receta]')
  await expect(hoja).toContainText('Prisma')
  await expect(hoja).toContainText('+1.75')
  await expect(hoja).toContainText('Con la receta nueva')
  await expect(hoja).toContainText('20/20 −2')
  await expect(hoja).toContainText('Progresivo, policarbonato, antirreflejo')
  await foto(page, 'paso-5b-hoja-de-la-receta')
  await page.getByRole('dialog').last().getByRole('button', { name: 'Cerrar' }).last().click()
  // El estado de los pasos
  await expect(barra.getByRole('button', { name: /^Paso 4: Salud ocular, Completo/ })).toBeVisible()

  // ── Terminar atención ──
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar atención' }).click()
  const terminada = page.getByRole('status').filter({ hasText: 'Atención terminada' })
  await expect(terminada).toContainText('la cita quedó atendida', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: /Imprimir \/ Descargar PDF/ })).toBeEnabled()

  // ── Lo guardado en la base ──
  const { data: guardadas } = await cliente.from('consultas').select('*').eq('paciente_id', pacienteId).eq('fecha', new Date().toISOString().slice(0, 10).replace(/./, (c) => c)).order('created_at', { ascending: false })
  const { data: todas } = await cliente.from('consultas').select('*').eq('paciente_id', pacienteId).order('created_at', { ascending: false })
  const c = (guardadas?.length ? guardadas : todas)[0]
  expect(c.motivo).toBe('Consulta General') // el motivo del catálogo (el de la cita)
  expect(c.detalle_consulta).toContain('dolor de cabeza') // lo que cuenta el paciente, aparte
  const d = c.datos_clinicos
  expect(d.oi).toMatchObject({ esfera: '-1.00', cilindro: '-0.50', eje: '180', avSc: '20/40', avRx: '20/25' })
  expect(d.od).toMatchObject({ esfera: '-1.75', cilindro: '-0.75', eje: '10', avSc: '20/50', avScF: '1', avRx: '20/20', avRxF: '2' })
  expect(d.medidas).toMatchObject({ adicionOd: '+1.50', dp: '62', dpOd: '31', dpOi: '31', dpCerca: '59', prismaOdCant: '2', prismaOdBase: 'Nasal' })
  expect(d.medidas.adicionOi).toBe('+1.75')
  expect(d.ficha.v).toBe(2)
  expect(d.ficha.anamnesis.sintomas).toEqual(expect.arrayContaining(['Borrosidad de cerca', 'Dolor de cabeza']))
  expect(d.ficha.coverTest).toMatchObject({ tipo: 'Exoforia', magnitud: '4', distancia: 'ambas' })
  expect(d.ficha.objetiva.metodo).toBe('autorrefractometro')
  expect(d.ficha.salud.pio).toMatchObject({ od: '14', oi: '15', hora: '03:20 PM' })
  expect(d.ficha.salud.color).toMatchObject({ resultado: '14 de 14', interpretacion: 'Normal' })
  expect(c.estado_correccion).toBe('Bien corregido') // con la agudeza con la receta nueva (20/20 y 20/25)
  expect(c.antecedentes).toContain('Hipertensión')
  expect(d.medidas.alt ?? '').toBe('') // las alturas no van en la ficha
  const { data: cita } = await cliente.from('citas').select('estado').eq('paciente_id', pacienteId).eq('estado', 'Atendida').order('fecha', { ascending: false }).limit(1)
  expect(cita?.length).toBe(1)

  // ── Su reflejo en el perfil (pestaña Graduación) ──
  await page.getByRole('button', { name: /Volver a/ }).first().click()
  await expect(page.getByRole('tab', { name: /Graduación/ })).toBeVisible({ timeout: 30_000 })
  await page.getByRole('tab', { name: /Graduación/ }).click()
  await expect(page.getByRole('tabpanel').first()).toContainText('20/20')
  await expect(page.getByRole('tabpanel').first()).toContainText('OD +1.50 · OI +1.75')
  await foto(page, 'perfil-graduacion')
})
