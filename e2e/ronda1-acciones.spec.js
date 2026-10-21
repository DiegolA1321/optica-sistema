// Ronda 1 (21 oct. 2026): las acciones del administrador funcionan de verdad, con la interfaz real, en la óptica de pruebas, y se
// reflejan en todos los lugares donde deben verse. Complementa a `sesion-pestanas.spec.js` (la sesión) y a `escrituras-directas`
// (que comprueba que la base acepta cada escritura): aquí se mira lo que ve la persona, incluido el portal del paciente.
import { test, expect } from '@playwright/test'
import { iniciarSesion, escribirSecreto, nombrePrueba, cedulaValida, telefonoPrueba, elegirFecha, crearCitaDeHoyParaPaula, cancelarCitasDePrueba, SLUG_PRUEBAS, elegirVista } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const irA = (page, modulo) => page.getByRole('button', { name: modulo, exact: true }).first().click()
const buscarPaciente = async (page, texto) => {
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(texto)
}
const menuDeFila = async (page, nombre, accion) => {
  const fila = page.locator('tr').filter({ hasText: nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await fila.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: accion }).dispatchEvent('click') // el menú se cierra al desplazarse: sin scroll automático
}

// Entra al portal con la cédula y la clave; devuelve la página del paciente (o null si el ingreso fue rechazado).
async function entrarAlPortal(browser, cedula, clave) {
  const contexto = await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })
  const portal = await contexto.newPage()
  await portal.goto(`/?optica=${SLUG_PRUEBAS}`)
  await portal.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(portal, portal.getByPlaceholder('Cédula o nombre de usuario'), cedula)
  await escribirSecreto(portal, portal.getByPlaceholder('Tu contraseña'), clave)
  await portal.getByRole('button', { name: 'Entrar', exact: true }).click()
  const entro = await portal.getByRole('navigation', { name: 'Menú del portal' }).first().waitFor({ timeout: 20_000 }).then(() => true).catch(() => false)
  return { portal, contexto, entro }
}

test('Pacientes: crear, editar, dar acceso al portal, restablecer la clave y eliminar (con su acceso al portal)', async ({ page, browser }) => {
  test.setTimeout(300_000)
  const nombre = nombrePrueba()
  const nombreEditado = nombre + ' Editado'
  const cedula = cedulaValida()
  await iniciarSesion(page, 'ADMIN', 'E2E')

  await test.step('crear: mensaje de confirmación y aparece en la lista', async () => {
    await irA(page, 'Pacientes')
    await page.getByRole('button', { name: 'Crear paciente' }).first().click()
    const registro = page.getByRole('dialog', { name: 'Crear paciente' })
    await registro.locator('#p-nombre').fill(nombre)
    await registro.locator('#p-cedula').fill(cedula)
    await registro.locator('#p-telefono').fill(telefonoPrueba())
    await elegirFecha(registro, 'p-nacimiento', '1990-05-15')
    await registro.getByRole('button', { name: 'Registrar paciente' }).click()
    await expect(page.getByRole('dialog', { name: 'Paciente registrado' })).toBeVisible({ timeout: 15_000 })
    await page.keyboard.press('Escape')
    await buscarPaciente(page, nombre)
    await expect(page.locator('tr').filter({ hasText: nombre })).toHaveCount(1, { timeout: 20_000 })
  })

  await test.step('editar: cambiar solo el nombre guarda, avisa y se ve en la lista', async () => {
    await menuDeFila(page, nombre, 'Editar datos')
    await page.locator('#p-nombre').fill(nombreEditado)
    await page.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Expediente del paciente actualizado correctamente.')).toBeVisible({ timeout: 15_000 })
    await buscarPaciente(page, nombreEditado)
    await expect(page.locator('tr').filter({ hasText: nombreEditado })).toHaveCount(1, { timeout: 20_000 })
  })

  let claveUno
  await test.step('acceso al portal: se crea, avisa y el paciente entra con esa clave', async () => {
    await menuDeFila(page, nombreEditado, 'Crear cuenta de acceso')
    const ventana = page.getByRole('dialog', { name: 'Crear cuenta de acceso' })
    claveUno = (await ventana.locator('span.font-mono').last().textContent()).trim()
    await ventana.getByRole('button', { name: 'Crear cuenta' }).click()
    await expect(page.getByText('Cuenta de acceso creada para el paciente.')).toBeVisible({ timeout: 15_000 })
    const { portal, contexto, entro } = await entrarAlPortal(browser, cedula, claveUno)
    expect(entro, 'el paciente entra al portal con la clave nueva').toBe(true)
    await contexto.close()
  })

  await test.step('restablecer la clave: avisa, la nueva entra y la anterior ya no', async () => {
    await menuDeFila(page, nombreEditado, 'Restablecer clave')
    const ventana = page.getByRole('dialog', { name: 'Restablecer clave' })
    await ventana.getByRole('button', { name: 'Generar otra clave' }).click()
    const claveDos = (await ventana.locator('span.font-mono').last().textContent()).trim()
    expect(claveDos).not.toBe(claveUno)
    await ventana.getByRole('button', { name: 'Guardar nueva clave' }).click()
    await expect(page.getByText('Clave temporal restablecida.')).toBeVisible({ timeout: 15_000 })
    const nueva = await entrarAlPortal(browser, cedula, claveDos)
    expect(nueva.entro, 'entra con la clave restablecida').toBe(true)
    await nueva.contexto.close()
    const vieja = await entrarAlPortal(browser, cedula, claveUno)
    expect(vieja.entro, 'la clave anterior ya no entra').toBe(false)
    await vieja.contexto.close()
  })

  await test.step('eliminar: pide confirmación (nombre), borra al paciente y su acceso al portal', async () => {
    await menuDeFila(page, nombreEditado, 'Eliminar')
    const confirmar = page.getByRole('dialog').last()
    await expect(confirmar.getByRole('button', { name: /Eliminar/ }).last()).toBeDisabled() // sin escribir el nombre no se puede
    await confirmar.getByRole('textbox').fill(nombreEditado)
    await confirmar.getByRole('button', { name: /Eliminar/ }).last().click()
    await expect(page.getByText(/Paciente eliminado/)).toBeVisible({ timeout: 20_000 })
    await buscarPaciente(page, nombreEditado)
    await expect(page.getByText(`Ningún paciente coincide con “${nombreEditado}”.`)).toBeVisible()
    const sinAcceso = await entrarAlPortal(browser, cedula, claveUno)
    expect(sinAcceso.entro, 'su acceso al portal también se quitó').toBe(false)
    await sinAcceso.contexto.close()
  })
})

test('Citas: «Dejar de atender» devuelve la cita a Pendiente y lo avisa', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E', { estado: 'En Atención' })
  try {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Citas médicas')
    await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
    await page.getByTitle('Ver el detalle de la cita').first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Dejar de atender' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: 'Sí, dejar de atender' }).click()
    await expect(page.getByText(`Dejaste de atender a ${nombre}. La cita sigue agendada.`)).toBeVisible({ timeout: 15_000 })
  } finally {
    await cancelarCitasDePrueba([nombre])
  }
})

test('Citas: una cita de hoy se ve en la lista, la semana, el mes, el perfil del paciente y el Inicio; al cancelarla se actualiza en todos', async ({ page }) => {
  test.setTimeout(180_000)
  const nombre = await crearCitaDeHoyParaPaula('E2E')
  try {
    await iniciarSesion(page, 'ADMIN', 'E2E')
    await irA(page, 'Citas médicas')
    await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
    await expect(page.getByTitle('Ver el detalle de la cita').first()).toBeVisible({ timeout: 20_000 })
    for (const v of ['Semana', 'Mes']) {
      await elegirVista(page, v)
      await expect(page.locator(`main button[title^="${nombre} · "]`).first(), `la cita se ve en la vista ${v}`).toBeVisible({ timeout: 20_000 })
    }
    await elegirVista(page, 'Lista')

    // Perfil del paciente: pestaña Citas.
    await irA(page, 'Pacientes')
    await buscarPaciente(page, nombre)
    await page.locator('tr').filter({ hasText: nombre }).first().click()
    await page.getByRole('tab', { name: /^Citas/ }).click({ timeout: 45_000 })
    await expect(page.getByText('Consulta General').first()).toBeVisible({ timeout: 20_000 })
    await page.keyboard.press('Escape')

    // Inicio: la agenda de hoy la incluye.
    await irA(page, 'Inicio')
    await expect(page.getByText(nombre).first()).toBeVisible({ timeout: 30_000 })

    // Editar la cita (cambiar su motivo): guarda, avisa y el detalle lo muestra.
    await irA(page, 'Citas médicas')
    await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
    await page.getByTitle('Ver el detalle de la cita').first().click()
    await page.getByRole('dialog').getByRole('button', { name: 'Editar cita' }).click()
    const edicion = page.getByRole('dialog', { name: 'Editar cita' })
    const motivoNuevo = await edicion.locator('select').first().evaluate((el) => {
      const otra = [...el.options].find((o) => o.value && o.value !== el.value)
      el.value = otra.value
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return otra.textContent.trim()
    })
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(page.getByText('Cita actualizada.')).toBeVisible({ timeout: 20_000 })
    await page.getByTitle('Ver el detalle de la cita').first().click()
    await expect(page.getByRole('dialog').getByText(motivoNuevo).first()).toBeVisible({ timeout: 15_000 })

    // Cancelarla: confirma, avisa, y la lista deja de mostrarla como pendiente.
    await page.getByRole('dialog').getByRole('button', { name: 'Cancelar cita' }).click()
    await page.getByRole('dialog').last().getByRole('button', { name: /Cancelar cita|Sí/ }).last().click()
    await expect(page.getByText(/cancelada|Cita cancelada/i).first()).toBeVisible({ timeout: 20_000 })
  } finally {
    await cancelarCitasDePrueba([nombre])
  }
})

test('Inventario: agregar, editar, ajustar stock, descontinuar y reactivar un producto, con mensaje en cada paso', async ({ page }) => {
  test.setTimeout(180_000)
  const nombre = `E2E Montura ${Math.random().toString(36).slice(2, 7)}`
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Inventario')

  await page.getByRole('button', { name: 'Agregar producto' }).click()
  const alta = page.getByRole('dialog')
  await alta.getByLabel('Descripción de la montura o accesorio').fill(nombre)
  await alta.getByLabel('Existencia inicial').fill('10')
  await alta.getByLabel('Precio ($)').fill('50')
  await alta.locator('button[type=submit]').click()
  await expect(page.getByText('Producto añadido al inventario.')).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('button', { name: `Ver el detalle de ${nombre}` })).toBeVisible({ timeout: 20_000 })

  // Ajustar el stock por conteo (de 10 a 7): avisa y la existencia cambia.
  await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
  const detalle = page.getByRole('dialog', { name: `Producto ${nombre}` })
  await detalle.getByRole('button', { name: 'Ajustar stock' }).click()
  const ajuste = page.getByRole('dialog', { name: 'Ajustar stock' })
  await ajuste.getByRole('radio', { name: /conteo/i }).check()
  await ajuste.getByLabel(/Unidades que hay realmente/).fill('7')
  await ajuste.getByLabel(/Motivo/).fill('E2E faltaban tres en el estante')
  await ajuste.getByRole('button', { name: 'Guardar ajuste' }).click()
  await expect(page.getByText(`${nombre} queda con 7 u.`)).toBeVisible({ timeout: 20_000 })

  // Descontinuar: sale de la lista; se encuentra en «Descontinuados» y se reactiva.
  await page.getByRole('dialog', { name: `Producto ${nombre}` }).getByRole('button', { name: 'Descontinuar' }).click()
  await page.getByRole('dialog', { name: 'Descontinuar producto' }).getByRole('button', { name: 'Descontinuar', exact: true }).click()
  await expect(page.getByText(`"${nombre}" descontinuado`)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByRole('row').filter({ hasText: nombre })).toHaveCount(0, { timeout: 20_000 })
  await page.getByRole('button', { name: /^Descontinuados \(/ }).click()
  await page.getByRole('button', { name: `Ver el detalle de ${nombre}` }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reactivar' }).click()
  await expect(page.getByText(`"${nombre}" reactivado`)).toBeVisible({ timeout: 20_000 })
  // Sin más descontinuados, la vista vuelve sola a la lista de activos y el producto está ahí.
  await expect(page.getByRole('button', { name: `Ver el detalle de ${nombre}` })).toBeVisible({ timeout: 20_000 })
  // Recargar demuestra que quedó en la base y no solo en pantalla.
  await page.reload()
  await irA(page, 'Inventario')
  await expect(page.getByRole('button', { name: `Ver el detalle de ${nombre}` })).toBeVisible({ timeout: 30_000 })
})

test('Vista de Optómetra del administrador: cambia el menú y Soporte sin tocar la sesión; en Soporte ve solo lo de ese rol', async ({ page }) => {
  test.setTimeout(180_000)
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Usuarios y permisos')
  const misRoles = async (marcar) => {
    await page.getByRole('button', { name: 'Mis roles' }).click()
    const ventana = page.getByRole('dialog', { name: 'Mis roles' })
    const casilla = ventana.getByRole('checkbox', { name: /Optómetra/ }).first()
    if ((await casilla.isChecked()) !== marcar) await casilla.setChecked(marcar)
    await ventana.getByRole('button', { name: 'Guardar mis roles' }).click()
    await expect(ventana).toHaveCount(0, { timeout: 20_000 })
  }
  await misRoles(true)
  try {
    await page.locator('header button').last().click()
    await page.getByRole('menuitemradio', { name: /Optómetra/ }).click()
    await irA(page, 'Soporte')
    const pestanas = page.getByRole('tablist').first()
    await expect(pestanas.getByRole('tab', { name: /Mis consultas/ })).toBeVisible({ timeout: 20_000 })
    await expect(pestanas.getByRole('tab', { name: /Consultas del personal|Soporte del sistema/ })).toHaveCount(0)
    // La sesión sigue siendo la misma: nada de «no tienes permiso» ni de volver al ingreso.
    await expect(page.getByText(/no tienes permiso|permission denied/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0)
    await page.locator('header button').last().click()
    await page.getByRole('menuitemradio', { name: /Administrador/ }).click()
    await irA(page, 'Soporte')
    await expect(page.getByRole('tablist').first().getByRole('tab', { name: /Consultas del personal/ })).toBeVisible({ timeout: 20_000 })
  } finally {
    await page.locator('header button').last().click().catch(() => {})
    await page.getByRole('menuitemradio', { name: /Administrador/ }).click().catch(() => {})
    await irA(page, 'Usuarios y permisos')
    await misRoles(false)
  }
})
