// Ficha clínica de tres pasos: (1) casi todo es opcional (solo el motivo y el diagnóstico obligan; si se registra algo de la refracción, van los dos ojos o «Ojo no evaluado» con motivo) y
// (2) el borrador vive en la base de datos: se guarda solo, se recupera desde otro computador, se descarta, la cita reagendada lo hereda y nada queda en el navegador. Sin capturas.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula, credencial, irAPasoFicha, abrirBloqueExamen } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 800 }, actionTimeout: 15_000 })
test.describe.configure({ mode: 'serial' })

let cliente = null
const ids = {}

async function sesionOptometra() {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('OPTOMETRA', 'E2E')
  const c = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await c.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del optómetra para preparar los datos.')
  const { data: perfil } = await c.from('perfiles').select('optica_id').eq('id', data.user.id).single()
  return { c, opticaId: perfil.optica_id }
}

// Abre la ficha del paciente desde su perfil («Atender»); si ya estaba en atención dice «Seguir atendiendo».
async function abrirFicha(page, nombre) {
  await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 45_000 })
  await page.getByText(nombre).first().click()
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: /^(Atender|Seguir atendiendo)/ }).first().click()
  await expect(page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 20_000 })
  const primera = page.getByRole('button', { name: 'Entendido, completar antecedentes' })
  if (await primera.waitFor({ timeout: 4_000 }).then(() => true, () => false)) await primera.click()
}

const borradorEnBase = async (pacienteId, citaId) => {
  const { data } = await cliente.rpc('leer_borrador_ficha', { p_paciente_id: pacienteId, p_cita_id: citaId })
  return data?.[0] || null
}

test.beforeAll(async () => {
  const { c } = await sesionOptometra()
  cliente = c
})

test('el examen es opcional: con solo el motivo y el diagnóstico se termina la atención', async ({ page }) => {
  test.setTimeout(180_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  const { data: p } = await cliente.from('pacientes').select('id').eq('nombre', nombre).single()
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await abrirFicha(page, nombre)
  // Ningún bloque del examen es obligatorio: a medias, la refracción exige los dos ojos
  await abrirBloqueExamen(page, 'Refracción')
  await page.locator('#odEsfera').fill('-1.00')
  await expect(page.getByRole('navigation', { name: 'Pasos de la ficha clínica' }).getByRole('button', { name: /^Paso 2: Examen, Incompleto/ })).toBeVisible()
  await irAPasoFicha(page, 3, 'Diagnóstico y receta')
  await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
  await page.getByRole('radio', { name: /Agendar después/ }).check()
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: /refracción final/i }).first()).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Estaba en el paso 3: lleva al Examen, con el bloque de la refracción abierto y lo que falta marcado
  await expect(page.getByText('Paso 2 de 3')).toBeVisible()
  await expect(page.getByRole('button', { name: /^Refracción/ })).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('Ingresa la esfera o marca «Ojo no evaluado»')).toBeVisible()
  // Marca el otro ojo como no evaluado, con su motivo: ya se puede terminar
  await page.getByRole('checkbox', { name: /Ojo no evaluado/ }).first().check()
  await page.getByLabel('¿Por qué no se evaluó?').fill('Prótesis ocular')
  // Sin nada del examen salvo eso: se termina con solo el motivo y el diagnóstico
  await irAPasoFicha(page, 3, 'Diagnóstico y receta')
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar atención' }).click()
  const documento = page.getByRole('dialog', { name: /Atención terminada/ })
  await expect(documento).toBeVisible({ timeout: 20_000 })
  await expect(documento.getByRole('button', { name: /Descargar PDF/ })).toBeVisible()
  await expect(documento.getByRole('button', { name: /^Imprimir$/ })).toBeVisible()
  await documento.getByRole('button', { name: 'Cerrar' }).last().click()
  const { data: c } = await cliente.from('consultas').select('motivo, diagnostico, datos_clinicos, estado_correccion').eq('paciente_id', p.id).order('created_at', { ascending: false }).limit(1).single()
  expect(c.diagnostico).toContain('Miop')
  expect(c.datos_clinicos.od.esfera).toBe('-1.00')
  expect(c.datos_clinicos.oi.esfera).toBe('')
  expect(c.datos_clinicos.ojo_no_evaluado.oi).toBe('Prótesis ocular')
  expect(c.datos_clinicos.od.avSc).toBe('') // la agudeza ya no es obligatoria
})

test('una ficha sin ningún dato del examen se guarda y se ve en el perfil como «Sin evaluar»', async ({ page }) => {
  test.setTimeout(180_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  const { data: p } = await cliente.from('pacientes').select('id').eq('nombre', nombre).single()
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await abrirFicha(page, nombre)
  await irAPasoFicha(page, 3, 'Diagnóstico y receta')
  await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
  await page.getByRole('radio', { name: /Agendar después/ }).check()
  await page.getByRole('button', { name: /Terminar atención/ }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Terminar atención' }).click()
  const documento = page.getByRole('dialog', { name: /Atención terminada/ })
  await expect(documento).toBeVisible({ timeout: 20_000 })
  // Sin refracción, el documento no lleva la tabla de graduación
  await expect(documento.locator('[data-hoja-receta]')).not.toContainText('Esfera')
  await documento.getByRole('button', { name: 'Cerrar' }).last().click()
  const { data: c } = await cliente.from('consultas').select('estado_correccion, datos_clinicos').eq('paciente_id', p.id).order('created_at', { ascending: false }).limit(1).single()
  expect(c.estado_correccion).toBe('Sin evaluar')
  expect(c.datos_clinicos.od.esfera).toBe('')
  // Se sigue viendo bien en el perfil: la pestaña Diagnóstico abre sin error
  await page.getByRole('button', { name: /Volver a/ }).first().click()
  await page.getByRole('tab', { name: /Diagnóstico/ }).click()
  await expect(page.getByRole('tabpanel').first()).toContainText('Miop')
})

test('el borrador vive en la base: se guarda solo, se recupera desde otro computador y se descarta', async ({ page, browser }) => {
  test.setTimeout(240_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  const { data: p } = await cliente.from('pacientes').select('id').eq('nombre', nombre).single()
  const { data: cita } = await cliente.from('citas').select('id').eq('paciente_id', p.id).limit(1).single()
  ids.paciente = p.id; ids.cita = cita.id
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await abrirFicha(page, nombre)
  await abrirBloqueExamen(page, 'Refracción')
  await page.locator('#odEsfera').fill('-2.25')
  // Se guarda solo, en la base (cifrado), y no en el navegador
  await expect.poll(async () => (await borradorEnBase(ids.paciente, ids.cita))?.datos?.odEsfera, { timeout: 20_000 }).toBe('-2.25')
  await expect(page.getByText(/Guardado (ahora|hace)/)).toBeVisible()
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('ficha-borrador')))).toEqual([])
  // Otro computador (otro navegador, otra sesión): al abrir la ficha de ese paciente ofrece recuperarla
  const otro = await browser.newContext({ viewport: { width: 1093, height: 800 } })
  try {
    const pagina2 = await otro.newPage()
    await iniciarSesion(pagina2, 'OPTOMETRA', 'E2E')
    await abrirFicha(pagina2, nombre)
    await expect(pagina2.getByText('Hay una ficha a medias de este paciente')).toBeVisible({ timeout: 20_000 })
    await pagina2.getByRole('button', { name: 'Recuperar' }).click()
    await abrirBloqueExamen(pagina2, 'Refracción')
    await expect(pagina2.locator('#odEsfera')).toHaveValue('-2.25')
  } finally {
    await otro.close()
  }
  // En la misma sesión, tras recargar: también se ofrece y se puede descartar («Empezar de cero»): la base queda sin borrador
  await page.reload()
  // La app vuelve a la ficha que estaba abierta
  await expect(page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 30_000 })
  const primera = page.getByRole('button', { name: 'Entendido, completar antecedentes' })
  if (await primera.waitFor({ timeout: 4_000 }).then(() => true, () => false)) await primera.click()
  await expect(page.getByText('Hay una ficha a medias de este paciente')).toBeVisible({ timeout: 20_000 })
  await page.getByRole('button', { name: 'Empezar de cero' }).click()
  await expect.poll(async () => await borradorEnBase(ids.paciente, ids.cita), { timeout: 15_000 }).toBeNull()
  await expect(page.getByText('Hay una ficha a medias de este paciente')).toHaveCount(0)
})

test('la cita reagendada hereda el borrador de la que no se efectuó y, al terminar, se borra', async () => {
  test.setTimeout(120_000)
  // Un borrador de la cita anterior, escrito con la sesión del optómetra
  const { error: e1 } = await cliente.rpc('guardar_borrador_ficha', { p_paciente_id: ids.paciente, p_cita_id: ids.cita, p_datos: { motivo: 'Consulta General', odEsfera: '-3.00' } })
  expect(e1).toBeNull()
  // La cita nueva (otro día) la crea quien reagenda; la base copia el borrador a la cita nueva
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').limit(1).single()
  const { data: nueva, error: e2 } = await cliente.from('citas').insert({ optica_id: perfil.optica_id, paciente_id: ids.paciente, paciente: 'Heredero', fecha: new Date(Date.now() + 86_400_000 * 3).toISOString().slice(0, 10), hora: '09:15 AM', motivo: 'Consulta General', estado: 'Pendiente' }).select('id').single()
  expect(e2).toBeNull()
  const { data: hereda } = await cliente.rpc('heredar_borrador_ficha', { p_cita_origen: ids.cita, p_cita_nueva: nueva.id })
  expect(hereda).toBe(true)
  expect((await borradorEnBase(ids.paciente, nueva.id))?.datos?.odEsfera).toBe('-3.00')
  // Sin borrador en la cita de origen no hay nada que heredar
  await cliente.rpc('borrar_borrador_ficha', { p_paciente_id: ids.paciente, p_cita_id: ids.cita })
  const { data: nada } = await cliente.rpc('heredar_borrador_ficha', { p_cita_origen: ids.cita, p_cita_nueva: nueva.id })
  expect(nada).toBe(false)
  await cliente.rpc('borrar_borrador_ficha', { p_paciente_id: ids.paciente, p_cita_id: nueva.id })
  expect(await borradorEnBase(ids.paciente, nueva.id)).toBeNull()
})
