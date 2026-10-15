// Inventario v2 de punta a punta, en la óptica de pruebas (solo ella): el recorrido del kárdex y, en la Demo (SOLO LECTURA),
// la forma de la pantalla. Necesita la migración 0111 aplicada.
//
// Recorrido (óptica de pruebas): crear una montura con sus datos, registrar un ingreso, vender (con la misma función de la base que usa
// la pantalla de Ventas), contar y ajustar por conteo, y revisar el historial del producto y la pestaña Inventario de Reportes.
import { test, expect } from '@playwright/test'
import { iniciarSesion, PREFIJO, credencial, cedulaValida, telefonoPrueba } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const sufijo = () => Math.random().toString(36).slice(2, 7)
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const irA = async (page, modulo) => { await page.getByRole('button', { name: modulo, exact: true }).first().click() }

// ¿Hay algún desplazamiento horizontal? La página o cualquier elemento que lo permita con más ancho que su caja.
async function desplazamientoHorizontal(page) {
  return page.evaluate(() => {
    const culpables = []
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) culpables.push('la página')
    for (const el of document.querySelectorAll('main *, [role="dialog"], [role="dialog"] *')) {
      const o = getComputedStyle(el).overflowX
      if ((o === 'auto' || o === 'scroll') && el.scrollWidth > el.clientWidth + 1) culpables.push((el.getAttribute('aria-label') || el.className || el.tagName).toString().slice(0, 60))
    }
    return culpables
  })
}

// La sesión del administrador de la óptica de pruebas, para lo que la pantalla ya hace con sus funciones (vender).
async function clienteAdmin() {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('ADMIN', 'E2E')
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (error) throw new Error('No se pudo iniciar la sesión del administrador de pruebas.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', data.user.id).single()
  return { cliente, usuarioId: data.user.id, optica: perfil.optica_id }
}

test.describe('Inventario v2: el recorrido del kárdex (óptica de pruebas)', () => {
  test.describe.configure({ mode: 'serial' })
  const nombre = `${PREFIJO}Montura kárdex ${sufijo()}`

  test('1 · crear una montura con sus datos opcionales: se ve el margen y las medidas', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    await page.getByRole('button', { name: 'Agregar producto' }).click()
    const alta = page.getByRole('dialog', { name: 'Agregar producto' })
    await alta.getByLabel('Descripción de la montura o accesorio').fill(nombre)
    await alta.getByLabel('Existencia inicial').fill('10')
    await alta.getByLabel('Precio ($)').fill('50')
    await alta.getByRole('button', { name: /Datos de la montura/ }).click()
    await alta.getByLabel('Marca').fill('E2E Marca')
    await alta.getByLabel('Calibre').fill('52')
    await alta.getByLabel('Puente').fill('18')
    await alta.getByLabel('Varilla').fill('140')
    await alta.getByLabel('Costo ($)').fill('20')
    await expect(alta.getByText('Margen: $30.00 (60%)')).toBeVisible()
    await alta.getByRole('button', { name: 'Guardar producto' }).click()
    await expect(page.getByText('Producto añadido al inventario.')).toBeVisible({ timeout: 20_000 })

    // La fila solo resume; todo lo demás está en el detalle.
    const fila = page.getByRole('row').filter({ hasText: nombre })
    await expect(fila).toContainText('10 u.')
    await expect(fila.getByRole('button')).toHaveCount(1) // solo el nombre: ningún ícono de acción
    await fila.click()
    const detalle = page.getByRole('dialog', { name: `Producto ${nombre}` })
    await expect(detalle.getByText('52-18-140 mm')).toBeVisible()
    await expect(detalle.getByText('$30.00 · 60%')).toBeVisible()
    await detalle.getByRole('tab', { name: 'Movimientos' }).click()
    await expect(detalle.getByRole('row').filter({ hasText: 'Saldo inicial' })).toContainText('10')
  })

  test('1b · el costo no llega al navegador de quien solo puede ver el inventario (se oculta en el servidor)', async () => {
    const { cliente, optica } = await clienteAdmin()
    const { data: prod } = await cliente.from('inventario').select('id').eq('optica_id', optica).eq('nombre', nombre).single()
    const propio = await cliente.from('inventario_costos').select('costo').eq('producto_id', prod.id)
    expect(propio.data?.map((c) => Number(c.costo))).toEqual([20]) // con Inventario "editar" se lee
    const { createClient } = await import('@supabase/supabase-js')
    const { correo, clave } = credencial('RECEPCION', 'E2E') // Recepción solo puede ver el inventario
    const solo = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
    expect((await solo.auth.signInWithPassword({ email: correo, password: clave })).error).toBeNull()
    const visto = await solo.from('inventario').select('*').eq('id', prod.id)
    expect(visto.data).toHaveLength(1) // ve el producto…
    expect(Object.keys(visto.data[0])).not.toContain('costo') // …sin costo en la fila
    const costos = await solo.from('inventario_costos').select('costo').eq('producto_id', prod.id)
    expect(costos.error).toBeNull()
    expect(costos.data).toEqual([]) // y la tabla de costos le devuelve 0 filas
    const escribe = await solo.from('inventario_costos').update({ costo: 1 }).eq('producto_id', prod.id).select()
    expect(escribe.data ?? []).toEqual([]) // ni puede cambiarlo
  })

  test('2 · registrar un ingreso con su motivo', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
    await page.getByRole('dialog', { name: `Producto ${nombre}` }).getByRole('button', { name: 'Registrar ingreso' }).click()
    const ingreso = page.getByRole('dialog', { name: 'Registrar ingreso' })
    await ingreso.getByLabel('Unidades recibidas').fill('5')
    await expect(ingreso.getByText(/Existencia: 10 → 15/)).toBeVisible()
    await ingreso.getByLabel(/Motivo o referencia/).fill(`${PREFIJO}Factura de compra 001-123`)
    await ingreso.getByRole('button', { name: 'Registrar ingreso' }).click()
    await expect(page.getByText(new RegExp(`Ingreso por compra registrado: .* queda con 15 u\\.`))).toBeVisible({ timeout: 20_000 })
    const detalle = page.getByRole('dialog', { name: `Producto ${nombre}` })
    await expect(detalle.getByText('15', { exact: true }).first()).toBeVisible()
    await detalle.getByRole('tab', { name: 'Movimientos' }).click()
    const mov = detalle.getByRole('row').filter({ hasText: 'Ingreso por compra' })
    await expect(mov).toContainText('+5')
    await expect(mov).toContainText('15')
    await expect(mov).toContainText(`${PREFIJO}Factura de compra 001-123`)
  })

  test('3 · una venta descuenta el stock y deja su movimiento ligado al comprobante', async ({ page }) => {
    const { cliente, usuarioId, optica } = await clienteAdmin()
    const { data: prod } = await cliente.from('inventario').select('id').eq('optica_id', optica).eq('nombre', nombre).single()
    const { data: paciente, error: errorPaciente } = await cliente.from('pacientes').insert({
      optica_id: optica, nombre: `E Dos E Kárdex ${sufijo()}`, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
      evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyISO(), estado_clinico: 'Activo',
    }).select('id').single()
    expect(errorPaciente?.message).toBeUndefined()
    const { data: factura, error } = await cliente.rpc('crear_factura_venta', {
      p_optica_id: optica, p_paciente_id: paciente.id, p_metodo_pago: 'directo', p_registrado_por: usuarioId,
      p_lineas: [{ producto_id: prod.id, tipo: 'producto', descripcion: nombre, cantidad: 3, precio_unitario: 50 }],
    })
    expect(error?.message).toBeUndefined()
    expect(Array.isArray(factura) ? factura[0].monto_total : factura.monto_total).toBeTruthy()

    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    const fila = page.getByRole('row').filter({ hasText: nombre })
    await expect(fila).toContainText('12 u.', { timeout: 25_000 })
    await fila.click()
    const detalle = page.getByRole('dialog', { name: `Producto ${nombre}` })
    await detalle.getByRole('tab', { name: 'Movimientos' }).click()
    const venta = detalle.getByRole('row').filter({ hasText: /Venta/ }).first()
    await expect(venta).toContainText('-3')
    await expect(venta).toContainText('12')
    await expect(venta).toContainText(/CV-\d{4}/) // el comprobante al que corresponde
    await detalle.getByRole('tab', { name: /^Ventas/ }).click()
    await expect(detalle.getByText('3 u.')).toBeVisible()
  })

  test('4 · conteo físico a ciegas: se cuenta, se ven las diferencias al revisar, y al confirmar queda el acta', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    await page.getByRole('button', { name: 'Conteo físico' }).click()
    const conteo = page.getByRole('dialog', { name: 'Conteo físico' })
    await expect(conteo.getByRole('button', { name: 'Revisar diferencias' })).toBeDisabled()
    await expect(conteo.getByRole('columnheader', { name: /Sistema|Diferencia/ })).toHaveCount(0) // a ciegas
    await conteo.getByLabel('Buscar producto para contar').fill(nombre)
    await conteo.getByLabel(`Contado de ${nombre}`).fill('10')
    await expect(conteo.getByText('1 contado')).toBeVisible()
    await expect(conteo.getByText(/con diferencia/)).toHaveCount(0)
    await conteo.getByRole('button', { name: 'Revisar diferencias' }).click()
    const revisar = conteo.getByRole('row').filter({ hasText: nombre })
    await expect(revisar).toContainText('12')
    await expect(revisar).toContainText('10')
    await expect(revisar).toContainText('−2')
    await expect(revisar).toContainText('−$100.00') // 2 unidades × $50
    await conteo.getByRole('button', { name: 'Confirmar conteo' }).click()
    await expect(page.getByText('Conteo físico registrado: 1 ajuste.')).toBeVisible({ timeout: 20_000 })
    const acta = page.getByRole('dialog', { name: 'Conteo registrado' })
    await expect(acta.getByText('Productos contados')).toBeVisible()
    await expect(acta.getByRole('row').filter({ hasText: nombre })).toContainText('−$100.00')
    await expect(acta.getByText('−$40.00')).toBeVisible() // a costo: 2 × $20
    await expect(acta.getByRole('button', { name: /Imprimir o guardar PDF/ })).toBeVisible()
    await acta.getByRole('button', { name: 'Cerrar' }).last().click()
    await expect(page.getByRole('row').filter({ hasText: nombre })).toContainText('10 u.')
    // El historial guarda el acta.
    await page.getByRole('button', { name: 'Conteo físico' }).click()
    await page.getByRole('dialog', { name: 'Conteo físico' }).getByRole('button', { name: /Historial/ }).click()
    const historial = page.getByRole('dialog', { name: 'Historial de conteos' })
    await historial.getByRole('button', { name: /^Ver el acta/ }).first().click()
    await expect(page.getByRole('dialog', { name: 'Acta del conteo' }).getByRole('row').filter({ hasText: nombre })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(historial).toBeVisible() // vuelve al historial
    expect(await desplazamientoHorizontal(page)).toEqual([])
  })

  test('5 · el historial queda completo y en orden, con quién lo hizo; el stock ya no se edita a mano', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
    const detalle = page.getByRole('dialog', { name: `Producto ${nombre}` })
    await detalle.getByRole('tab', { name: 'Movimientos' }).click()
    const filas = detalle.getByRole('table').getByRole('row')
    await expect(filas).toHaveCount(1 + 4) // saldo inicial, ingreso, venta y conteo
    const textos = await filas.allTextContents()
    // Del más reciente al más antiguo, con lo que quedó después de cada uno.
    expect(textos[1]).toMatch(/Ajuste por conteo.*-2.*10.*Conteo físico/)
    expect(textos[2]).toMatch(/Venta.*-3.*12/)
    expect(textos[3]).toMatch(/Ingreso por compra.*\+5.*15/)
    expect(textos[4]).toMatch(/Saldo inicial.*10.*10/)
    for (const t of textos.slice(1)) expect(t).toMatch(/\S/)
    await expect(detalle.getByRole('table').getByText(/QA|Tester|Administrador|Ana|Diego/i).first()).toBeVisible() // quién lo hizo
    // El formulario de editar ya no tiene el campo de existencia.
    await detalle.getByRole('button', { name: /^Editar/ }).click()
    const edicion = page.getByRole('dialog', { name: 'Editar producto' })
    await expect(edicion.getByLabel('Existencia inicial')).toHaveCount(0)
    await expect(edicion.getByText(/Se cambia con «Registrar ingreso» o «Ajustar stock»/)).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('6 · Reportes › Inventario: el valor a costo, el margen y lo más vendido coinciden con lo hecho', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Reportes')
    await page.getByRole('tab', { name: 'Inventario' }).click()
    const valor = page.getByRole('button', { name: /^Valor del inventario a costo: / })
    await expect(valor).toBeVisible({ timeout: 25_000 })
    await expect(valor).toHaveAccessibleName(/\$\d/)
    await expect(page.getByRole('button', { name: /^Margen promedio: 60%/ })).toBeVisible() // vendió 3 a $50 con costo $20
    await expect(page.getByRole('button', { name: new RegExp(`^${nombre}: 3 unidades por \\$150\\.00`) })).toBeVisible()
    await valor.click()
    await expect(page.getByRole('dialog').getByRole('row').filter({ hasText: nombre })).toContainText('$200.00') // 10 u. × $20
    await page.keyboard.press('Escape')
    expect(await desplazamientoHorizontal(page)).toEqual([])
  })

  test('7 · descontinuar conserva el producto y su historial (no se elimina)', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Inventario')
    await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: /Eliminar/ })).toHaveCount(0)
    await page.getByRole('dialog').getByRole('button', { name: 'Descontinuar' }).click()
    await page.getByRole('dialog', { name: 'Descontinuar producto' }).getByRole('button', { name: 'Descontinuar', exact: true }).click()
    await expect(page.getByRole('row').filter({ hasText: nombre })).toHaveCount(0, { timeout: 20_000 })
    await page.getByRole('button', { name: /^Descontinuados \(/ }).click()
    await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
    await page.getByRole('dialog').getByRole('tab', { name: 'Movimientos' }).click()
    await expect(page.getByRole('dialog').getByRole('table').getByRole('row')).toHaveCount(1 + 4)
  })
})

test.describe('Inventario v2: la forma de la pantalla (Demo, solo lectura)', () => {
  test.beforeEach(async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', 'DEMO')
    await irA(page, 'Inventario')
    await expect(page.getByRole('heading', { level: 1, name: 'Inventario' })).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('main .animate-pulse')).toHaveCount(0, { timeout: 20_000 })
  })

  test('un solo nombre: "Monturas", y nunca "Armazones"', async ({ page }) => {
    const texto = await page.locator('main').innerText()
    expect(texto).toMatch(/Montura/)
    expect(texto).not.toMatch(/armaz/i)
    await expect(page.getByRole('group', { name: 'Filtros' }).getByRole('button', { name: /^Montura \(\d+\)$/ })).toBeVisible()
  })

  test('las cuatro tarjetas abren una ventana con su desglose, todas igual; el stock bajo no es una tarjeta', async ({ page }) => {
    await expect(page.getByRole('button', { name: /^Stock bajo:/ })).toHaveCount(0)
    for (const [tarjeta, ventana] of [[/^Productos: /, 'Productos'], [/^Unidades en stock: /, 'Unidades en stock'], [/^Valor del inventario: /, 'Valor del inventario'], [/^Sin venderse en 90 días: /, 'Sin venderse en 90 días']]) {
      await page.getByRole('button', { name: tarjeta }).click()
      await expect(page.getByRole('dialog', { name: ventana })).toBeVisible()
      expect(await desplazamientoHorizontal(page), ventana).toEqual([])
      await page.keyboard.press('Escape')
    }
    await expect(page.getByRole('button', { name: /^Valor del inventario: / })).toHaveAccessibleName(/a precio de venta/)
    await page.getByRole('button', { name: /^Productos: / }).click()
    await page.getByRole('dialog', { name: 'Productos' }).getByRole('button', { name: /^Ver los productos de / }).first().click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Limpiar' })).toBeVisible()
  })

  test('el conteo es a ciegas y ofrece la hoja en blanco y el historial', async ({ page }) => {
    await page.getByRole('button', { name: 'Conteo físico' }).click()
    const conteo = page.getByRole('dialog', { name: 'Conteo físico' })
    await expect(conteo.getByRole('columnheader', { name: /Sistema|Diferencia/ })).toHaveCount(0)
    await expect(conteo.getByRole('button', { name: /Hoja en blanco/ })).toBeVisible()
    await conteo.getByRole('button', { name: /Historial/ }).click()
    await expect(page.getByRole('dialog', { name: 'Historial de conteos' })).toBeVisible()
    await expect(page.getByRole('dialog', { name: 'Historial de conteos' }).getByText(/Todavía no hay conteos registrados|Cerrar/).first()).toBeVisible({ timeout: 15_000 })
    expect(await desplazamientoHorizontal(page)).toEqual([])
  })

  test('todos los filtros muestran su número y la fila solo resume (sin íconos de acción)', async ({ page }) => {
    const filtros = page.getByRole('group', { name: 'Filtros' }).getByRole('button')
    for (const t of await filtros.allTextContents()) expect(t, `el filtro "${t}" no tiene número`).toMatch(/\(\d+\)/)
    const tabla = page.getByRole('table')
    expect(await tabla.getByRole('columnheader').allTextContents()).toEqual(expect.arrayContaining(['Producto', 'Categoría', 'Existencia', 'Precio'].map((c) => expect.stringContaining(c))))
    await expect(tabla.getByRole('button', { name: /Editar|Eliminar|Vender|reporte/i })).toHaveCount(0)
  })

  test('al hacer clic en la fila se abre el detalle con todas las acciones, y no hay desplazamiento horizontal', async ({ page }) => {
    expect(await desplazamientoHorizontal(page), 'la lista').toEqual([])
    await page.getByRole('table').getByRole('row').nth(1).click()
    const detalle = page.getByRole('dialog')
    for (const n of ['Editar', 'Ajustar stock', 'Registrar ingreso', 'Descontinuar']) await expect(detalle.getByRole('button', { name: new RegExp(n) })).toBeVisible()
    await expect(detalle.getByRole('button', { name: /Eliminar/ })).toHaveCount(0)
    expect(await desplazamientoHorizontal(page), 'el detalle').toEqual([])
    await detalle.getByRole('tab', { name: 'Movimientos' }).click()
    await expect(detalle.getByRole('table').getByRole('row').nth(1)).toBeVisible({ timeout: 20_000 })
    expect(await desplazamientoHorizontal(page), 'el historial').toEqual([])
    await detalle.getByRole('tab', { name: /^Ventas/ }).click()
    expect(await desplazamientoHorizontal(page), 'las ventas').toEqual([])
  })

  test('el conteo físico y Reportes › Inventario caben a 1366×768 sin desplazamiento horizontal', async ({ page }) => {
    await page.getByRole('button', { name: 'Conteo físico' }).click()
    const conteo = page.getByRole('dialog', { name: 'Conteo físico' })
    await expect(conteo.getByRole('table').getByRole('row').nth(1)).toBeVisible()
    expect(await desplazamientoHorizontal(page), 'el conteo').toEqual([])
    await page.keyboard.press('Escape')
    await irA(page, 'Reportes')
    await page.getByRole('tab', { name: 'Inventario' }).click()
    await expect(page.getByRole('button', { name: /^Valor del inventario a costo: / })).toBeVisible({ timeout: 25_000 })
    for (const n of ['Margen promedio', 'Rotación', 'Monturas sin venderse en 90 días']) await expect(page.getByRole('button', { name: new RegExp(`^${n}: `) })).toBeVisible()
    expect(await desplazamientoHorizontal(page), 'Reportes › Inventario').toEqual([])
    expect(await page.getByRole('tab').allTextContents()).toEqual(['Resumen', 'Citas', 'Clínico', 'Ventas', 'Laboratorios', 'Inventario'])
  })
})
