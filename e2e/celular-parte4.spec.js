// Panel del personal en celular y tablet, parte 4: la ficha clínica, a 360, 390, 430 y 820 px (óptica de pruebas, con el optómetra: escribe, así que NO es la Demo).
//   * Una atención entera: los tres pasos, una refracción con valores negativos, «Terminar atención» y el PDF descargado.
//   * La ficha ocupa la pantalla completa (sin la barra de abajo del sistema), con la cabecera y el pie fijos y todo dentro de la pantalla; lo que se toca mide 44 px y lo que se escribe, 16 px.
//   * Los dos ojos uno debajo del otro (celular) o lado a lado (tablet); los campos de esfera y cilindro piden el teclado de texto (con «−» y «.»).
//   * El borrador (guardado en la base) se recupera de la computadora al celular y del celular a la computadora.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula, credencial } from './ayudas.js'

const barra = (page) => page.locator('nav[aria-label="Menú del panel"]')

async function medir(page, raiz) {
  return page.evaluate((sel) => {
    const base = document.querySelector(sel)
    const visible = (e) => { const c = e.getBoundingClientRect(); const s = getComputedStyle(e); return c.width > 0 && c.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' }
    const chicos = [], letra = []
    for (const e of base.querySelectorAll('button, a[href], [role="button"], input:not([type=hidden]), select, textarea, summary')) {
      if (!visible(e)) continue
      const casilla = e.tagName === 'INPUT' && /^(checkbox|radio)$/.test(e.type)
      const c = (casilla ? (e.closest('label') || e) : e).getBoundingClientRect()
      const nombre = (e.getAttribute('aria-label') || e.textContent || e.placeholder || e.id || e.tagName).trim().slice(0, 40)
      if (c.height < 43.5 || c.width < 43.5) chicos.push(`${nombre} (${Math.round(c.width)}x${Math.round(c.height)})`)
      if (!casilla && /^(INPUT|SELECT|TEXTAREA)$/.test(e.tagName) && parseFloat(getComputedStyle(e).fontSize) < 16) letra.push(nombre)
    }
    return { desborda: document.documentElement.scrollWidth > window.innerWidth + 1 || base.scrollWidth > base.clientWidth + 1, chicos, letra }
  }, raiz)
}
const limpio = { desborda: false, chicos: [], letra: [] }

// Abre la ficha desde el perfil del paciente («Atender»); sin cita atendida de antes aparece el aviso de la primera consulta.
async function abrirFicha(page, nombre, { celular = true } = {}) {
  if (celular) await barra(page).getByRole('button', { name: 'Pacientes', exact: true }).click()
  else await page.getByRole('button', { name: 'Pacientes', exact: true }).first().click()
  await page.getByPlaceholder(/Buscar paciente/).fill(nombre)
  if (celular) await page.locator('[data-paciente-id]').first().locator('button').first().click()
  else { await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 45_000 }); await page.getByRole('button', { name: 'Ver perfil 360°' }).first().click() }
  await expect(page.getByRole('tab', { name: /Citas/ })).toBeVisible({ timeout: 45_000 })
  await page.getByRole('button', { name: /^(Atender|Seguir atendiendo)/ }).first().click()
  await expect(celular ? page.locator('.ficha-celular') : page.getByText('Paso 1 de 3')).toBeVisible({ timeout: 20_000 })
  const primera = page.getByRole('button', { name: 'Entendido, completar antecedentes' })
  if (await primera.waitFor({ timeout: 4_000 }).then(() => true, () => false)) await primera.click()
}

let cliente = null
test.beforeAll(async () => {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('OPTOMETRA', 'E2E')
  cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del optómetra para comprobar lo guardado.')
})

for (const ancho of [360, 390, 430, 820]) {
  test.describe(`Ficha clínica a ${ancho} px`, () => {
    test.use({ viewport: { width: ancho, height: 800 }, isMobile: true, hasTouch: true, actionTimeout: 15_000, acceptDownloads: true })

    test('una atención entera: tres pasos, valores negativos, terminar y descargar el PDF', async ({ page }) => {
      test.setTimeout(240_000)
      const nombre = await crearCitaDeHoyParaPaula('E2E')
      await iniciarSesion(page, 'OPTOMETRA', 'E2E')
      await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
      await abrirFicha(page, nombre)

      // ── Pantalla completa, con cabecera y pie fijos; la barra de abajo del sistema queda debajo ──
      const ficha = page.locator('.ficha-celular')
      const caja = await ficha.boundingBox()
      expect([Math.round(caja.x), Math.round(caja.y), Math.round(caja.width), Math.round(caja.height)]).toEqual([0, 0, ancho, 800])
      const tapaLaBarra = await page.evaluate(() => { const b = document.querySelector('nav[aria-label="Menú del panel"]').getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return Boolean(e?.closest('.ficha-celular')) })
      expect(tapaLaBarra, 'la ficha cubre la barra de abajo del sistema').toBe(true)
      await expect(page.getByRole('button', { name: /^Volver a / })).toBeVisible()
      await expect(ancho < 768 ? page.getByText('Paso 1 de 3') : page.getByRole('navigation', { name: 'Pasos de la ficha clínica' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Ver documento' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Anterior' })).toHaveCount(0) // en el primer paso no hay anterior
      let m = await medir(page, '.ficha-celular')
      expect(m, `Paso 1: ${JSON.stringify(m)}`).toEqual(limpio)

      // ── Paso 1 → 2 con «Siguiente» ──
      await page.getByRole('button', { name: 'Borrosidad de cerca' }).click()
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await expect(page.getByRole('button', { name: /^Refracción/ })).toBeVisible()
      for (const b of ['Agudeza visual', 'Lentes actuales y distancia pupilar', 'Refracción', 'Cover test y motilidad', 'Salud ocular']) {
        await expect(page.getByRole('button', { name: new RegExp(`^${b}`) })).toHaveAttribute('aria-expanded', 'false')
      }
      m = await medir(page, '.ficha-celular')
      expect(m, `Paso 2 cerrado: ${JSON.stringify(m)}`).toEqual(limpio)

      // Bloques abiertos: todo cabe, sin desplazamiento de lado, con 44 px y 16 px
      for (const b of ['Agudeza visual', 'Lentes actuales y distancia pupilar', 'Refracción', 'Cover test y motilidad', 'Salud ocular']) await page.getByRole('button', { name: new RegExp(`^${b}`) }).click()
      m = await medir(page, '.ficha-celular')
      expect(m, `Paso 2 abierto: ${JSON.stringify(m)}`).toEqual(limpio)

      // Los dos ojos: uno debajo del otro en el celular (derecho primero); lado a lado en tablet vertical (derecho a la izquierda, como en el diseño)
      const final = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Refracción final' }) }).last()
      const [od, oi] = await Promise.all([final.getByRole('group', { name: 'Ojo derecho' }).boundingBox(), final.getByRole('group', { name: 'Ojo izquierdo' }).boundingBox()])
      if (ancho < 768) { expect(od.y, 'OD arriba de OI').toBeLessThan(oi.y); expect(Math.abs(od.x - oi.x)).toBeLessThan(2) } else { expect(od.x, 'OD a la izquierda de OI').toBeLessThan(oi.x); expect(Math.abs(od.y - oi.y)).toBeLessThan(2) }
      // Los campos de la refracción son grandes
      expect((await page.locator('#odEsfera').boundingBox()).height).toBeGreaterThanOrEqual(44)
      // Teclado: esfera y cilindro piden el de texto (trae «−» y «.» en iPhone y Android); eje, el numérico
      for (const id of ['odEsfera', 'odCilindro', 'oiEsfera', 'oiCilindro']) await expect(page.locator('#' + id)).toHaveAttribute('inputmode', 'text')
      await expect(page.locator('#odEje')).toHaveAttribute('inputmode', 'numeric')
      await expect(page.locator('#kOdK1')).toHaveAttribute('inputmode', 'decimal')

      // Valores negativos
      for (const [id, v] of [['odEsfera', '-1.75'], ['odCilindro', '-0.75'], ['odEje', '10'], ['oiEsfera', '-1.50'], ['oiCilindro', '-0.50'], ['oiEje', '90']]) await page.locator('#' + id).fill(v)
      await expect(page.locator('#odEsfera')).toHaveValue('-1.75')
      await expect(page.getByRole('button', { name: /^Refracción/ })).toContainText('Registrado')

      // «Ver documento» abre la vista previa a pantalla completa, con «Cerrar»
      await page.getByRole('button', { name: 'Ver documento' }).click()
      const previa = page.getByRole('dialog', { name: /Vista previa del diagnóstico/ })
      await expect(previa).toBeVisible()
      await page.waitForTimeout(500)
      const cp = await previa.boundingBox()
      expect([Math.round(cp.width), Math.round(cp.height)]).toEqual([ancho, 800])
      await expect(previa.locator('[data-hoja-receta]')).toContainText('−1.75')
      await previa.getByRole('button', { name: 'Cerrar' }).last().click()
      await expect(previa).toHaveCount(0)

      // ── Paso 3 ──
      await page.getByRole('button', { name: 'Siguiente' }).click()
      await expect(page.getByRole('button', { name: 'Anterior' })).toBeVisible()
      await expect(page.getByRole('button', { name: /Terminar atención/ })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0)
      await expect(page.getByRole('button', { name: /Imprimir diagnóstico/ })).toBeHidden() // un solo camino: «Ver documento»
      await expect(page.locator('[data-vista-previa-documento]')).toBeHidden()
      await page.getByRole('button', { name: /^Miop[ií]a$/ }).first().click()
      await page.getByRole('radio', { name: /Agendar después/ }).check()
      m = await medir(page, '.ficha-celular')
      expect(m, `Paso 3: ${JSON.stringify(m)}`).toEqual(limpio)

      // ── Terminar atención: la misma ventana, a pantalla completa, con Descargar PDF, Imprimir y Cerrar ──
      await page.getByRole('button', { name: /Terminar atención/ }).click()
      const confirmar = page.getByRole('dialog').last()
      await expect(confirmar).toBeVisible()
      await confirmar.getByRole('button', { name: 'Terminar atención' }).click()
      const documento = page.getByRole('dialog', { name: /Atención terminada/ })
      await expect(documento).toBeVisible({ timeout: 20_000 })
      await page.waitForTimeout(500)
      const cd = await documento.boundingBox()
      expect([Math.round(cd.width), Math.round(cd.height)]).toEqual([ancho, 800])
      await expect(documento.locator('[data-hoja-receta]')).toContainText('Diagnóstico')
      await expect(documento.getByRole('button', { name: /^Imprimir$/ })).toBeVisible()
      m = await medir(page, '[data-ventana]')
      expect(m, `Documento: ${JSON.stringify(m)}`).toEqual(limpio)
      const [descarga] = await Promise.all([page.waitForEvent('download'), documento.getByRole('button', { name: /Descargar PDF/ }).click()])
      expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i)
      const ruta = await descarga.path()
      const fs = await import('node:fs')
      const pdf = fs.readFileSync(ruta)
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
      expect(pdf.length).toBeGreaterThan(1500)
      await documento.getByRole('button', { name: 'Cerrar' }).last().click()
      await expect(page.getByRole('status').filter({ hasText: 'Atención terminada' })).toContainText('la cita quedó atendida', { timeout: 20_000 })
      await expect(page.getByRole('button', { name: 'Nueva consulta' })).toBeVisible()

      // ── Lo guardado en la base ──
      const { data: p } = await cliente.from('pacientes').select('id').eq('nombre', nombre).single()
      const { data: c } = await cliente.from('consultas').select('*').eq('paciente_id', p.id).order('created_at', { ascending: false }).limit(1).single()
      expect(c.datos_clinicos.od).toMatchObject({ esfera: '-1.75', cilindro: '-0.75', eje: '10' })
      expect(c.datos_clinicos.oi).toMatchObject({ esfera: '-1.50', cilindro: '-0.50', eje: '90' })
      expect(c.diagnostico_categorias).toContain('Miopía')
      const { data: cita } = await cliente.from('citas').select('estado').eq('paciente_id', p.id).eq('estado', 'Atendida')
      expect(cita?.length).toBe(1)
    })
  })
}

test.describe('Ficha clínica con el teléfono en horizontal (844 x 390)', () => {
  test.use({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, actionTimeout: 15_000 })
  test('cabecera y pie fijos, el contenido se desplaza entre los dos y nada se sale', async ({ page }) => {
    test.setTimeout(180_000)
    const nombre = await crearCitaDeHoyParaPaula('E2E')
    await iniciarSesion(page, 'OPTOMETRA', 'E2E')
    await expect(page.locator('.modo-celular')).toBeVisible({ timeout: 30_000 })
    await abrirFicha(page, nombre)
    await page.getByRole('button', { name: /^Paso 2: Examen/ }).click()
    await page.getByRole('button', { name: /^Refracción/ }).click()
    const [cab, pie, zona] = await Promise.all([page.locator('[data-ficha-cabecera]').boundingBox(), page.locator('[data-ficha-pie]').boundingBox(), page.locator('.ficha-scroll').boundingBox()])
    expect(Math.round(cab.y)).toBe(0)
    expect(Math.round(pie.y + pie.height)).toBe(390)
    expect(zona.height, 'queda sitio para el contenido entre la cabecera y el pie').toBeGreaterThan(120)
    await page.locator('#odEsfera').scrollIntoViewIfNeeded()
    const dentro = await page.locator('#odEsfera').boundingBox()
    expect(dentro.y).toBeGreaterThanOrEqual(cab.y + cab.height - 1)
    expect(dentro.y + dentro.height).toBeLessThanOrEqual(pie.y + 1)
    const m = await medir(page, '.ficha-celular')
    expect(m, JSON.stringify(m)).toEqual(limpio)
  })
})

test.describe('El borrador pasa de la computadora al celular y del celular a la computadora', () => {
  test('se recupera en el otro aparato', async ({ browser }) => {
    test.setTimeout(300_000)
    const nombre = await crearCitaDeHoyParaPaula('E2E')
    const { data: p } = await cliente.from('pacientes').select('id').eq('nombre', nombre).single()
    const { data: cita } = await cliente.from('citas').select('id').eq('paciente_id', p.id).single()
    const borrador = async () => (await cliente.rpc('leer_borrador_ficha', { p_paciente_id: p.id, p_cita_id: cita.id })).data
    const nuevo = (viewport, movil) => browser.newContext({ baseURL: test.info().project.use.baseURL, viewport, isMobile: movil, hasTouch: movil, locale: 'es-EC' })
    const esperarBorrador = async (texto) => { await expect.poll(async () => JSON.stringify(await borrador()), { timeout: 30_000 }).toContain(texto) }

    // 1) Se empieza en la computadora (1366 px)…
    const cA = await nuevo({ width: 1366, height: 800 }, false)
    const a = await cA.newPage()
    await iniciarSesion(a, 'OPTOMETRA', 'E2E')
    await abrirFicha(a, nombre, { celular: false })
    await a.getByRole('button', { name: /^Paso 2: Examen/ }).click()
    await a.getByRole('button', { name: /^Refracción/ }).click()
    await a.locator('#odEsfera').fill('-1.25'); await a.locator('#odCilindro').fill('-0.50'); await a.locator('#odEje').fill('80')
    await esperarBorrador('-1.25')
    await cA.close()

    // 2) …y se sigue en el celular: la ficha ofrece recuperar y deja los valores
    const cB = await nuevo({ width: 390, height: 800 }, true)
    const b = await cB.newPage()
    await iniciarSesion(b, 'OPTOMETRA', 'E2E')
    await abrirFicha(b, nombre)
    await expect(b.getByText('Hay una ficha a medias de este paciente')).toBeVisible({ timeout: 20_000 })
    await b.getByRole('button', { name: 'Recuperar' }).click()
    await b.getByRole('button', { name: /^Paso 2: Examen/ }).click()
    await b.getByRole('button', { name: /^Refracción/ }).click()
    await expect(b.locator('#odEsfera')).toHaveValue('-1.25')
    await expect(b.locator('#odCilindro')).toHaveValue('-0.50')
    // En el celular se agrega el ojo izquierdo: el borrador se vuelve a guardar solo
    await b.locator('#oiEsfera').fill('-2.00'); await b.locator('#oiCilindro').fill('-0.25'); await b.locator('#oiEje').fill('100')
    await expect(b.getByRole('status').filter({ hasText: /^Guardado/ })).toBeVisible({ timeout: 20_000 })
    await esperarBorrador('-2.00')
    await cB.close()

    // 3) De vuelta en la computadora: está lo del celular
    const cC = await nuevo({ width: 1366, height: 800 }, false)
    const c = await cC.newPage()
    await iniciarSesion(c, 'OPTOMETRA', 'E2E')
    await abrirFicha(c, nombre, { celular: false })
    await expect(c.getByText('Hay una ficha a medias de este paciente')).toBeVisible({ timeout: 20_000 })
    await c.getByRole('button', { name: 'Recuperar' }).click()
    await c.getByRole('button', { name: /^Paso 2: Examen/ }).click()
    await c.getByRole('button', { name: /^Refracción/ }).click()
    await expect(c.locator('#oiEsfera')).toHaveValue('-2.00')
    await expect(c.locator('#odEsfera')).toHaveValue('-1.25')
    await cC.close()
  })
})
