// Escrituras directas a la base que el recorrido completo no cubre (inventario, avisos del CRM, horarios, configuración,
// usuarios y roles, mensajes, citas y datos del paciente). Sirven de red de seguridad antes de quitar a `authenticated` el
// permiso de escribir directo en las tablas (migración 0097): cada prueba espera la respuesta REST de la escritura y exige
// que la base la acepte (2xx), así que si faltara un permiso fallaría con 401/403.
// Todo lo que crean lleva el prefijo "E2E " y se borra o se restaura al terminar la prueba (también si la prueba falla).
import { test, expect } from '@playwright/test'
import { limpiarSoporteDePruebas } from './limpiar-soporte.js'
import { iniciarSesion, PREFIJO, PREFIJO_NOMBRE, crearCitaDeHoyParaPaula, cedulaValida, escribirSecreto, elegirFecha } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

// Espera una escritura REST a una tabla o vista y comprueba que la base la aceptó.
const escritura = (page, tabla, metodos = ['POST', 'PATCH', 'PUT', 'DELETE']) =>
  page.waitForResponse((r) => new RegExp('/rest/v1/' + tabla + '(\\?|$)').test(r.url()) && metodos.includes(r.request().method()), { timeout: 25_000 })
async function aceptada(promesa, que) {
  const r = await promesa
  const detalle = r.status() >= 300 ? await r.text().catch(() => '') : ''
  expect(r.status(), `${que}: ${r.request().method()} ${r.url().split('/rest/v1/')[1]?.split('?')[0]} ${detalle.slice(0, 300)}`).toBeLessThan(300)
}
// Ejecuta una acción y espera la escritura que provoca.
const conEscritura = async (page, tabla, que, accion, metodos) => {
  const espera = escritura(page, tabla, metodos)
  await accion()
  await aceptada(espera, que)
}

const sufijo = () => Math.random().toString(36).slice(2, 7)
const irA = async (page, modulo) => { await page.getByRole('button', { name: modulo, exact: true }).first().click() }
const fechaEn = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
// Una fecha lejana que sea día de semana (lunes a viernes): un domingo está cerrado y no admite registrar una ausencia.
const diaHabilEn = (dias) => {
  const d = new Date()
  d.setDate(d.getDate() + dias)
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const confirmarEliminar = (page) => page.getByRole('dialog').last().getByRole('button', { name: 'Sí, eliminar' })

test('Inventario: crear, editar y descontinuar un producto (inventario: insert y update; los productos no se eliminan)', async ({ page }) => {
  const nombre = `${PREFIJO}Montura ${sufijo()}`
  const nombre2 = `${nombre} editada`
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Inventario')

  await page.getByRole('button', { name: 'Agregar producto' }).click()
  const alta = page.getByRole('dialog')
  await alta.getByPlaceholder('Ej. Montura 1, marco negro, modelo X').fill(nombre)
  await alta.getByLabel('Existencia inicial').fill('5')
  await alta.getByPlaceholder('45.00').fill('12.50')
  await conEscritura(page, 'inventario', 'crear producto', () => alta.locator('button[type=submit]').click())
  const fila = page.getByRole('listitem').filter({ hasText: nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })

  await fila.getByRole('button', { name: /^Ver el detalle de / }).click()
  await page.getByRole('dialog').getByRole('button', { name: /^Editar/ }).click()
  const edicion = page.getByRole('dialog').last()
  await edicion.getByPlaceholder('Ej. Montura 1, marco negro, modelo X').fill(nombre2)
  await edicion.getByPlaceholder('45.00').fill('15')
  await conEscritura(page, 'inventario', 'editar producto', () => edicion.getByRole('button', { name: 'Guardar cambios' }).click())

  // Recargar demuestra que quedó en la base y no solo en pantalla.
  await page.reload()
  await irA(page, 'Inventario')
  const fila2 = page.getByRole('listitem').filter({ hasText: nombre2 })
  await expect(fila2).toContainText('15', { timeout: 25_000 })

  await fila2.getByRole('button', { name: /^Ver el detalle de / }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Descontinuar' }).click()
  await conEscritura(page, 'inventario', 'descontinuar producto', () => page.getByRole('dialog', { name: 'Descontinuar producto' }).getByRole('button', { name: 'Descontinuar', exact: true }).click())
  await expect(page.getByRole('listitem').filter({ hasText: nombre2 })).toHaveCount(0, { timeout: 20_000 })
})

test('CRM: crear una campaña (función crear_campana_crm) y que siga ahí al recargar', async ({ page }) => {
  const nombre = `${PREFIJO}campaña ${sufijo()}`
  // Una campaña necesita a quién enviarle: un paciente con el control vencido (se crea aparte; la limpieza lo borra).
  const { default: pg } = await import('pg')
  const c = new pg.Client()
  await c.connect()
  await c.query("insert into public.pacientes_base (optica_id, nombre, telefono, fecha_registro) select id, $1, '0991234567', current_date - 200 from public.opticas where slug = 'v8twzq'", [`${PREFIJO_NOMBRE}Campana ${sufijo()}`])
  await c.end()
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'CRM y fidelización')
  await page.getByRole('button', { name: 'Nueva campaña' }).first().click()
  const ventana = page.getByRole('dialog', { name: 'Nueva campaña' })
  await ventana.getByLabel('Nombre de la campaña').fill(nombre)
  await ventana.getByLabel(/^Control vencido/).check()
  const respuesta = page.waitForResponse((r) => r.url().includes('/rpc/crear_campana_crm'))
  await ventana.getByRole('button', { name: 'Crear campaña' }).click()
  expect((await respuesta).ok(), 'la campaña se guardó en la base').toBeTruthy()
  await page.reload()
  await irA(page, 'CRM y fidelización')
  await page.getByRole('tab', { name: /Campañas/ }).click()
  await expect(page.getByText(nombre)).toBeVisible({ timeout: 25_000 })
})

test('Horario general: cambiar y restaurar la duración de cada cita (disponibilidad: upsert)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Horario')
  await page.getByRole('tab', { name: 'Horario de la óptica' }).click()
  const campo = () => page.locator('input[type=number][step="5"]').first()
  const guardar = page.getByRole('button', { name: 'Guardar', exact: true })
  await expect(campo()).toBeVisible({ timeout: 20_000 })
  const original = Number(await campo().inputValue())
  try {
    await campo().fill(String(original + 5))
    await conEscritura(page, 'disponibilidad', 'guardar duración', () => guardar.click())
    await page.reload()
    await irA(page, 'Horario')
    await page.getByRole('tab', { name: 'Horario de la óptica' }).click()
    await expect(campo()).toHaveValue(String(original + 5), { timeout: 25_000 })
  } finally {
    await page.waitForTimeout(500)
    if (await campo().count() && Number(await campo().inputValue()) !== original) {
      await campo().fill(String(original))
      await conEscritura(page, 'disponibilidad', 'restaurar duración', () => guardar.click())
    }
  }
  await page.reload()
  await irA(page, 'Horario')
  await page.getByRole('tab', { name: 'Horario de la óptica' }).click()
  await expect(campo()).toHaveValue(String(original), { timeout: 25_000 })
})

test('Mi horario: solicitar una ausencia lejana y retirar la solicitud (funciones solicitar_ausencia y retirar_ausencia)', async ({ page }) => {
  const fecha = diaHabilEn(500)
  await iniciarSesion(page, 'OPTOMETRA', 'E2E')
  await irA(page, 'Mi horario')
  await page.getByRole('button', { name: 'Solicitar ausencia' }).click()
  const modal = page.getByRole('dialog', { name: 'Solicitar ausencia' })
  await elegirFecha(modal, 'ausencia-desde', fecha)
  await modal.getByPlaceholder('Ej. Control médico programado').fill(`${PREFIJO}ausencia de prueba`)
  await conEscritura(page, 'rpc/solicitar_ausencia', 'solicitar ausencia', () => modal.getByRole('button', { name: 'Enviar solicitud' }).click())
  const retirar = page.getByRole('button', { name: /Retirar la solicitud del/ }).first()
  await expect(retirar).toBeVisible({ timeout: 20_000 })
  await conEscritura(page, 'rpc/retirar_ausencia', 'retirar solicitud', () => retirar.click())
  await expect(page.getByText('Solicitud retirada.')).toBeVisible({ timeout: 20_000 })
})

test('Horarios del personal: asignar y restaurar el horario de una persona (rpc guardar_horario_persona)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Horario')
  await page.getByRole('tab', { name: /^Horarios del personal/ }).click()
  await page.getByRole('navigation', { name: 'Personal que atiende o trabaja' }).getByText(/^Vera/).click()
  const interruptor = () => page.getByRole('switch', { name: 'Lunes: tarde' })
  await expect(interruptor()).toBeVisible({ timeout: 20_000 })
  await interruptor().click() // medio día los lunes
  await conEscritura(page, 'rpc/guardar_horario_persona', 'asignar horario', () => page.getByRole('button', { name: 'Guardar horario' }).click())
  await expect(page.getByText(/^Horario de Vera .* guardado\.$/)).toBeVisible({ timeout: 20_000 })
  // Se devuelve a la persona al horario de la óptica.
  await page.getByRole('button', { name: 'Usar el horario de la óptica' }).click()
  await conEscritura(page, 'rpc/guardar_horario_persona', 'restaurar horario', () => page.getByRole('button', { name: 'Guardar horario' }).click())
  await expect(interruptor()).toHaveAttribute('aria-checked', 'true')
})

test('Configuración: datos de la óptica y catálogos (opticas: update)', async ({ page }) => {
  const marca = sufijo()
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Configuración')

  // Datos de la óptica (Página pública): se cambia la dirección y se restaura la original.
  await page.getByRole('tab', { name: 'Página pública' }).click()
  const direccion = page.getByLabel('Dirección')
  await expect(direccion).toBeVisible({ timeout: 20_000 })
  const original = await direccion.inputValue()
  try {
    await direccion.fill(`${PREFIJO}dirección ${marca}`)
    await conEscritura(page, 'opticas', 'guardar datos de la óptica', () => page.getByRole('button', { name: 'Guardar datos de la óptica' }).click())
    await page.reload()
    await irA(page, 'Configuración')
    await page.getByRole('tab', { name: 'Página pública' }).click()
    await expect(page.getByLabel('Dirección')).toHaveValue(`${PREFIJO}dirección ${marca}`, { timeout: 25_000 })
  } finally {
    const d = page.getByLabel('Dirección')
    if (await d.count() && (await d.inputValue()) !== original) {
      await d.fill(original)
      await conEscritura(page, 'opticas', 'restaurar datos de la óptica', () => page.getByRole('button', { name: 'Guardar datos de la óptica' }).click())
    }
  }

  await page.getByRole('tab', { name: 'Catálogos' }).click()
  for (const [placeholder, nombre] of [
    ['Ej. Revisión de lentes de contacto', `${PREFIJO}Motivo ${marca}`],
    ['Ej. Ambliopía', `${PREFIJO}Diagnóstico ${marca}`],
    ['Ej. Lentes de contacto', `${PREFIJO}Categoría ${marca}`],
  ]) {
    const entrada = page.getByPlaceholder(placeholder)
    const quitar = page.getByRole('button', { name: `Eliminar ${nombre}` })
    try {
      await entrada.fill(nombre)
      await conEscritura(page, 'opticas', `agregar «${nombre}»`, () => entrada.press('Enter'))
      await expect(quitar).toBeVisible({ timeout: 20_000 })
    } finally {
      // Aunque algo falle entre agregar y quitar, lo agregado no se queda en el catálogo (un residuo así llegó a la Demo el 7 oct).
      if (await quitar.count()) {
        await quitar.click()
        await conEscritura(page, 'opticas', `eliminar «${nombre}»`, () => confirmarEliminar(page).click())
        await expect(quitar).toHaveCount(0, { timeout: 20_000 })
      }
    }
  }
})

test('Usuarios: asignar y quitar un rol y cambiar un nombre, dejándolo todo como estaba (perfil_roles y perfiles)', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Usuarios y permisos')
  const abrirRosa = async () => {
    await page.getByRole('button', { name: /^Editar Rosa/ }).click()
    return page.getByRole('dialog').last()
  }
  let usuario = await abrirRosa()
  const nombreOriginal = await usuario.getByPlaceholder('Ej. Ana Torres').inputValue()
  const rolExtra = usuario.getByRole('checkbox', { name: /Ventas/ })
  await expect(rolExtra).not.toBeChecked() // Rosa es Recepción; "Ventas" es el rol que se le suma y se le quita
  try {
    await usuario.getByPlaceholder('Ej. Ana Torres').fill(`${nombreOriginal} Prueba`)
    await rolExtra.check()
    await conEscritura(page, 'perfil_roles', 'asignar rol', () => usuario.getByRole('button', { name: 'Guardar cambios' }).click(), ['POST'])
    await expect(page.getByText(`${nombreOriginal} Prueba`)).toBeVisible({ timeout: 20_000 })
  } finally {
    await page.waitForTimeout(500)
    usuario = await abrirRosa()
    await usuario.getByPlaceholder('Ej. Ana Torres').fill(nombreOriginal)
    const marcado = usuario.getByRole('checkbox', { name: /Ventas/ })
    if (await marcado.isChecked()) await marcado.uncheck()
    await conEscritura(page, 'perfil_roles', 'quitar rol', () => usuario.getByRole('button', { name: 'Guardar cambios' }).click(), ['DELETE'])
    await expect(page.getByText(nombreOriginal, { exact: true }).first()).toBeVisible({ timeout: 20_000 })
  }
})

// Hoy FALLA a propósito: crear o editar un rol da 403 «permission denied for function _catalogo_permisos» para el administrador
// (error real en producción, ver supabase/migrations/0099_roles_valida_definer.sql, borrador sin aplicar). Pasará al aplicarla.
test('Roles: crear, editar y eliminar un rol (roles: insert, update y delete)', async ({ page }) => {
  const rol = `${PREFIJO}Rol ${sufijo()}`
  const nombreRol = `${rol} editado`
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Usuarios y permisos')
  await page.getByRole('tab', { name: /^Roles/ }).click()

  await page.getByRole('button', { name: /Nuevo rol/ }).click()
  const formRol = page.getByRole('dialog').last()
  await formRol.getByPlaceholder('Ej. Optómetra principal').fill(rol)
  await formRol.getByRole('switch', { name: 'Pacientes: Ver' }).click()
  await conEscritura(page, 'roles', 'crear rol', () => formRol.getByRole('button', { name: 'Crear rol' }).click())
  await expect(page.getByRole('list', { name: 'Roles' }).getByText(rol)).toBeVisible({ timeout: 20_000 })
  try {
    await page.getByRole('button', { name: `Editar ${rol}` }).click()
    const edicion = page.getByRole('dialog').last()
    await edicion.getByPlaceholder('Ej. Optómetra principal').fill(nombreRol)
    await conEscritura(page, 'roles', 'editar rol', () => edicion.getByRole('button', { name: 'Guardar cambios' }).click())
    await expect(page.getByRole('list', { name: 'Roles' }).getByText(nombreRol)).toBeVisible({ timeout: 20_000 })
  } finally {
    const eliminar = page.getByRole('button', { name: new RegExp('^Eliminar ' + PREFIJO + 'Rol ') })
    if (await eliminar.count()) {
      await eliminar.first().click()
      await conEscritura(page, 'roles', 'eliminar rol', () => confirmarEliminar(page).click())
    }
  }
})

test('Soporte: el administrador envía una consulta al soporte (rpc crear_consulta_soporte)', async ({ page }) => {
  const asunto = `${PREFIJO}consulta de prueba ${sufijo()}`
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Soporte')
  await page.getByRole('tab', { name: /Soporte del sistema/ }).click() // el administrador escribe al soporte desde su pestaña
  await page.getByRole('button', { name: /Nueva consulta/ }).first().click()
  const v = page.getByRole('dialog', { name: 'Nueva consulta' })
  await v.getByLabel('Asunto').fill(asunto)
  await v.getByLabel('Descripción').fill(`${PREFIJO}mensaje de prueba, no requiere respuesta`)
  await conEscritura(page, 'rpc/crear_consulta_soporte', 'enviar consulta', () => v.getByRole('button', { name: 'Enviar consulta' }).click())
  const enviada = page.getByRole("dialog", { name: "Consulta enviada" })
  await expect(enviada.getByText(/^SOP-\d{4}$/)).toBeVisible({ timeout: 20_000 })
  await enviada.getByRole("button", { name: "Ver mis consultas" }).click()
  await expect(page.getByText(asunto).first()).toBeVisible({ timeout: 20_000 })
  await limpiarSoporteDePruebas() // la consulta de prueba no queda en la bandeja del soporte
})

test('Citas y pacientes: corregir los datos de un paciente y cancelar su cita (pacientes y citas: update)', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula()
  await iniciarSesion(page, 'ADMIN', 'E2E')

  // Pacientes: editar el teléfono desde "Más acciones" de su fila
  await irA(page, 'Pacientes')
  await page.getByRole('textbox', { name: /buscar paciente/i }).fill(nombre)
  const fila = page.locator('tr').filter({ hasText: nombre })
  await expect(fila).toHaveCount(1, { timeout: 20_000 })
  await fila.getByRole('button', { name: 'Más acciones' }).click()
  await page.getByRole('button', { name: 'Editar datos' }).dispatchEvent('click') // el menú se cierra al desplazarse: sin scroll automático
  await page.locator('#p-telefono').fill('0999999999')
  await conEscritura(page, 'pacientes', 'editar paciente', () => page.getByRole('button', { name: 'Guardar cambios' }).click(), ['PATCH'])

  // Citas: cancelar la cita de hoy desde su detalle (la tarjeta ya no lleva el menú "Más acciones")
  await irA(page, 'Citas médicas')
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  await page.getByTitle('Ver el detalle de la cita').first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancelar cita' }).click()
  // Cancelar pide el motivo (lista fija) y escribe con la función cancelar_cita, que deja quién y por qué.
  await page.getByRole('dialog').last().getByRole('radio', { name: 'La óptica no puede atender' }).click()
  await conEscritura(page, 'rpc/cancelar_cita', 'cancelar cita', () => page.getByRole('dialog').last().getByRole('button', { name: 'Sí, cancelar' }).click())
})

test('Usuarios: crear una cuenta nueva y desactivarla (perfiles: insert; cuenta de acceso y desactivación)', async ({ page }) => {
  const azar = sufijo()
  const letras = azar.replace(/[0-9]/g, 'x')
  const nombre = `E Dos E Usuario ${letras[0].toUpperCase()}${letras.slice(1)}`
  const correo = `e2e.${azar}@pruebas-e2e.test`
  await iniciarSesion(page, 'ADMIN', 'E2E')
  await irA(page, 'Usuarios y permisos')
  await page.getByRole('button', { name: 'Crear usuario' }).first().click()
  const modal = page.getByRole('dialog').last()
  await modal.getByPlaceholder('Ej. Ana Torres').fill(nombre)
  await modal.getByPlaceholder('10 dígitos').fill(cedulaValida())
  await modal.getByPlaceholder('ana.torres@correo.com').fill(correo)
  await modal.getByRole('checkbox', { name: /^Ventas/ }).check()
  await conEscritura(page, 'perfiles', 'crear usuario', () => modal.getByRole('button', { name: 'Crear usuario' }).click(), ['POST'])
  await expect(page.getByText(/creado correctamente/)).toBeVisible({ timeout: 20_000 })
  // La contraseña la genera el sistema y se ve una sola vez, en su ventana.
  const ventanaClave = page.getByRole('dialog', { name: 'Contraseña temporal' })
  await expect(ventanaClave.locator('code')).toHaveText(/^Opt-[A-Z]{4}\d{2}$/)
  await ventanaClave.getByRole('button', { name: 'Cerrar' }).last().click()
  await expect(page.getByRole('list', { name: 'Usuarios' }).getByText(nombre)).toBeVisible({ timeout: 20_000 })

  // Una cuenta de prueba no debe quedar activa: se desactiva (rpc desactivar_usuario).
  await page.getByRole('button', { name: `Desactivar a ${nombre}` }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Desactivar', exact: true }).click()
  await expect(page.getByText(`${nombre} fue desactivado`)).toBeVisible({ timeout: 20_000 })
})
