// Ayudas compartidas. Dos ópticas, nunca otra:
//   * 'DEMO' (Óptica Demo, slug qu7u2j): la que se usa para presentar. Las pruebas que la usan son de SOLO LECTURA.
//   * 'E2E'  (QA Test Claude, slug v8twzq): la óptica de pruebas. Las pruebas que crean o cambian datos corren aquí.
// Las credenciales de cada una están en .env.test como DEMO_<ROL>_EMAIL/PASSWORD y E2E_<ROL>_EMAIL/PASSWORD.
import { expect } from '@playwright/test'
import fs from 'node:fs'

export const SLUG_DEMO = 'qu7u2j'
export const SLUG_PRUEBAS = 'v8twzq'
export const slugDe = (entorno) => (entorno === 'E2E' ? SLUG_PRUEBAS : SLUG_DEMO)

export function credencial(prefijo, entorno = 'DEMO') {
  const correo = process.env[`${entorno}_${prefijo}_EMAIL`]
  const clave = process.env[`${entorno}_${prefijo}_PASSWORD`]
  if (!correo || !clave) throw new Error(`Faltan ${entorno}_${prefijo}_EMAIL / ${entorno}_${prefijo}_PASSWORD en .env.test`)
  return { correo, clave }
}

// Escribe un valor sensible sin pasar por fill(): el registro de llamadas de Playwright no lo repite en errores.
export async function escribirSecreto(page, locator, valor) {
  await locator.click()
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Delete')
  await page.keyboard.insertText(valor)
}

export async function iniciarSesion(page, prefijo, entorno = 'DEMO') {
  const { correo, clave } = credencial(prefijo, entorno)
  await page.goto(`/?optica=${slugDe(entorno)}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), correo)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), clave)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  // No se aserta sobre el campo de contraseña: el registro de Playwright volcaría su HTML con el valor.
  // Sesión iniciada = desaparece la página pública (y su botón "Iniciar sesión"); si falla, se muestra el alert.
  await expect(page.getByRole("button", { name: "Iniciar sesión" })).toHaveCount(0, { timeout: 25_000 })
}

// Agrega o reemplaza claves en .env.test sin imprimirlas.
export function guardarEnEnv(pares) {
  let texto = fs.existsSync('.env.test') ? fs.readFileSync('.env.test', 'utf8') : ''
  if (texto && !texto.endsWith('\n')) texto += '\n'
  for (const [k, v] of Object.entries(pares)) {
    const re = new RegExp(`^${k}=.*$`, 'm')
    texto = re.test(texto) ? texto.replace(re, () => `${k}=${v}`) : texto + `${k}=${v}\n`
    process.env[k] = v
  }
  fs.writeFileSync('.env.test', texto)
}

// ── Datos propios de cada prueba del recorrido completo ──
// Todo lo que crea una prueba lleva este prefijo, para reconocerlo (y limpiarlo) en la óptica de pruebas.
export const PREFIJO = 'E2E '
export const PREFIJO_NOMBRE = 'E Dos E '

// Cédula ecuatoriana válida y única por corrida (provincia 01-24, tercer dígito < 6, dígito verificador módulo 10).
export function cedulaValida() {
  const d = [Math.floor(Math.random() * 2), 1 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 6)]
  while (d.length < 9) d.push(Math.floor(Math.random() * 10))
  const suma = d.reduce((s, x, i) => { const v = x * (i % 2 === 0 ? 2 : 1); return s + (v > 9 ? v - 9 : v) }, 0)
  d.push((10 - (suma % 10)) % 10)
  return d.join('')
}
export function telefonoPrueba() {
  return '09' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
}
// Nombre reconocible y único: "E Dos E Prueba Abcdef". Los formularios de paciente filtran los dígitos del nombre,
// así que "E2E" se escribe con letras; buscar "E Dos E" en Pacientes lista todo lo que crearon las pruebas.
export function nombrePrueba() {
  const letras = 'abcdefghijklmnopqrstuvwxyz'
  let sufijo = ''
  for (let i = 0; i < 6; i++) sufijo += letras[Math.floor(Math.random() * letras.length)]
  return `${PREFIJO_NOMBRE}Prueba ${sufijo[0].toUpperCase()}${sufijo.slice(1)}`
}

// Playwright no admite expresiones regulares en selectOption({ label }): se busca la opción por su texto.
export async function seleccionarPorTexto(select, patron) {
  const valor = await select.evaluate((el, [fuente, banderas]) => {
    const re = new RegExp(fuente, banderas)
    return [...el.options].find((o) => re.test(o.textContent))?.value
  }, [patron.source, patron.flags])
  expect(valor, `opción ${patron}`).toBeTruthy()
  await select.selectOption(valor)
}

// Recepción registra un paciente nuevo y le agenda una cita asignada a Paula, en el primer día con cupo y su primer
// horario libre (no depende de la hora del día ni de qué turnos haya sembrados). Paula puede atenderla el mismo día
// ("Atender hoy": la fecha agendada no cambia). Deja la sesión de Recepción abierta en la página dada.
export async function agendarCitaParaPaula(page, { nombre, cedula, telefono }, entorno = 'E2E') {
  await iniciarSesion(page, 'RECEPCION', entorno)
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByRole('button', { name: 'Gestionar cita' }).click()
  const form = page.getByRole('dialog')
  await form.getByRole('button', { name: 'Añadir nuevo paciente' }).click()
  await form.getByPlaceholder('Nombre completo').fill(nombre)
  await form.getByPlaceholder('Cédula').fill(cedula)
  await form.getByPlaceholder('Teléfono').fill(telefono)
  await form.getByRole('button', { name: 'Registrar y seleccionar' }).click()
  await expect(form.getByPlaceholder(/Escriba para buscar/)).toHaveValue(nombre, { timeout: 15_000 })
  await form.locator('select').first().selectOption({ index: 1 }) // Motivo del examen
  await seleccionarPorTexto(form.locator('#citas-asignado'), /Paula/)
  const dias = form.locator('button[title="Disponible"]')
  if (!(await dias.count())) await form.getByRole('button', { name: 'Mes siguiente' }).click()
  await dias.first().click()
  await form.locator('button:enabled').filter({ hasText: /^\d{2}:\d{2} (AM|PM)$/ }).first().click()
  await form.getByRole('button', { name: 'Confirmar cita' }).click()
  await page.getByRole('dialog').last().getByRole('button', { name: 'Confirmar', exact: true }).click()
  await expect(page.getByText('Cita registrada y guardada correctamente.')).toBeVisible({ timeout: 15_000 })
}

// ── Datos de apoyo por API (para pruebas que necesitan "una cita de hoy de Paula", sin depender de la hora ni de que
// el calendario aún ofrezca turnos hoy). Usan la sesión de Recepción, con los mismos permisos que la pantalla. ──
const hora12 = (d) => `${String(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`
const hoyLocalISO = (diasDespues = 0) => { const d = new Date(); d.setDate(d.getDate() + diasDespues); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

// Crea un paciente "E Dos E ..." y una cita de HOY asignada a Paula (pendiente, media hora más tarde, o a las 11:50 PM
// si ya es tarde: nunca pasada, para que el proceso de "No asistió" no la toque). Devuelve el nombre del paciente.
// Con `diasDespues` > 0 la cita es de otro día (a las 09:MM AM de ese día), para probar "¿Atenderla hoy?".
export async function crearCitaDeHoyParaPaula(entorno = 'E2E', { diasDespues = 0, estado = 'Pendiente' } = {}) {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', entorno)
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (errorSesion) throw new Error('No se pudo iniciar la sesión de Recepción para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const { data: equipo } = await cliente.rpc('equipo_optica')
  const paula = (equipo || []).find((m) => /Paula/.test(m.nombre))
  if (!paula) throw new Error('No se encontró a Paula en el equipo de la óptica de pruebas.')

  const nombre = nombrePrueba()
  const { data: paciente, error: errorPaciente } = await cliente.from('pacientes').insert({
    optica_id: perfil.optica_id, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
    evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyLocalISO(), estado_clinico: 'Activo',
  }).select().single()
  if (errorPaciente) throw new Error(`No se pudo crear el paciente de prueba: ${errorPaciente.message}`)

  // Un horario por (óptica, fecha, hora): si otra cita de prueba ya lo ocupa (23505), se prueba el minuto siguiente.
  const ahora = new Date()
  let errorCita
  for (let extra = 30; extra < 90; extra++) {
    const tarde = new Date(ahora.getTime() + extra * 60_000)
    const hora = diasDespues > 0 ? `09:${String(extra % 60).padStart(2, '0')} AM` : tarde.getDate() === ahora.getDate() ? hora12(tarde) : `11:${String(59 - (extra % 60)).padStart(2, '0')} PM`
    ;({ error: errorCita } = await cliente.from('citas').insert({
      optica_id: perfil.optica_id, paciente_id: paciente.id, paciente: nombre, cedula: paciente.cedula, telefono: paciente.telefono,
      fecha: hoyLocalISO(diasDespues), hora, duracion_minutos: null, motivo: 'Consulta General', estado, asignado_a: paula.id,
    }))
    if (!errorCita || errorCita.code !== '23505') break
  }
  if (errorCita) throw new Error(`No se pudo crear la cita de prueba: ${errorCita.message}`)
  return nombre
}

// Cancela las citas de prueba de esos pacientes (con la sesión de Recepción). Una prueba que deja a alguien "En Espera" la usa al
// terminar, para no alterar quién es el "Siguiente paciente" de las pruebas que corren después en la misma óptica.
export async function cancelarCitasDePrueba(nombres, entorno = 'E2E') {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', entorno)
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (errorSesion) throw new Error('No se pudo iniciar la sesión de Recepción para limpiar las citas de prueba.')
  const { error } = await cliente.from('citas').update({ estado: 'Cancelada' }).in('paciente', nombres)
  if (error) throw new Error(`No se pudieron cancelar las citas de prueba: ${error.message}`)
}

// ── Datos propios del Inicio (avisos de "Requiere tu atención") en la óptica de pruebas ──
// Deja, de forma idempotente (no repite lo que ya existe), lo que las pruebas del Inicio necesitan ver y no deben pedirle
// prestado a la Demo: un producto con stock bajo, un paciente con el control vencido y una orden de laboratorio atrasada.
// Todo lleva el prefijo "E Dos E " para reconocerlo y limpiarlo. Usa la sesión del administrador de esa óptica.
export async function prepararAvisosInicio(entorno = 'E2E') {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('ADMIN', entorno)
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (errorSesion) throw new Error('No se pudo iniciar la sesión del administrador para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const optica = perfil.optica_id
  const falla = (que, error) => { if (error) throw new Error(`No se pudo preparar "${que}": ${error.message}`) }

  const NOMBRE_PRODUCTO = 'E Dos E Montura agotada'
  const { data: producto } = await cliente.from('inventario').select('id').eq('optica_id', optica).eq('nombre', NOMBRE_PRODUCTO).maybeSingle()
  if (!producto) falla('producto con stock bajo', (await cliente.from('inventario').insert({ optica_id: optica, nombre: NOMBRE_PRODUCTO, categoria: 'Monturas', stock: 0, precio: 10, observacion: '' })).error)

  const pacienteDe = async (nombre, extra = {}) => {
    const { data: existente } = await cliente.from('pacientes').select('id').eq('optica_id', optica).eq('nombre', nombre).maybeSingle()
    if (existente) return existente.id
    const { data, error } = await cliente.from('pacientes').insert({
      optica_id: optica, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
      evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyLocalISO(), estado_clinico: 'Activo', ...extra,
    }).select('id').single()
    falla(nombre, error)
    return data.id
  }
  // Registrado hace años y sin ninguna consulta: su control está vencido.
  await pacienteDe('E Dos E Control Vencido', { fecha_registro: '2020-01-15' })

  const LAB = 'Lab E Dos E'
  const { data: orden } = await cliente.from('ordenes_laboratorio').select('id').eq('optica_id', optica).eq('laboratorio', LAB).limit(1)
  if (!orden?.length) {
    const pacienteId = await pacienteDe('E Dos E Orden Atrasada')
    const { data: factura, error: errorFactura } = await cliente.rpc('crear_factura_venta', {
      p_optica_id: optica, p_paciente_id: pacienteId, p_metodo_pago: 'directo',
      p_lineas: [{ tipo: 'servicio', descripcion: 'Lentes de prueba', cantidad: 1, precio_unitario: 10 }], p_registrado_por: sesion.user.id,
    })
    falla('venta de la orden atrasada', errorFactura)
    const facturaId = Array.isArray(factura) ? factura[0].id : factura.id
    falla('orden atrasada', (await cliente.rpc('crear_orden_laboratorio', { p_factura_id: facturaId, p_datos: { tipo_lente: 'monofocal', fecha_prometida: '2020-01-20', laboratorio: LAB } })).error)
  }
}

// Crea un paciente "E Dos E ..." con `n` citas ya atendidas en meses pasados (para probar el historial largo del perfil).
// Devuelve su nombre. Usa la sesión de Recepción de la óptica de pruebas.
export async function crearPacienteConHistorial(n = 6, entorno = 'E2E') {
  const { createClient } = await import('@supabase/supabase-js')
  const { correo, clave } = credencial('RECEPCION', entorno)
  const cliente = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sesion, error: errorSesion } = await cliente.auth.signInWithPassword({ email: correo, password: clave })
  if (errorSesion) throw new Error('No se pudo iniciar la sesión de Recepción para preparar los datos.')
  const { data: perfil } = await cliente.from('perfiles').select('optica_id').eq('id', sesion.user.id).single()
  const nombre = nombrePrueba()
  const { data: paciente, error } = await cliente.from('pacientes').insert({
    optica_id: perfil.optica_id, nombre, cedula: cedulaValida(), telefono: telefonoPrueba(), correo: 'Sin Correo', fecha_nacimiento: '1990-05-15',
    evolucion: 'Sin evaluación', ultima_consulta: 'Pendiente', fecha_registro: hoyLocalISO(), estado_clinico: 'Activo',
  }).select().single()
  if (error) throw new Error(`No se pudo crear el paciente de prueba: ${error.message}`)
  for (let i = 1; i <= n; i++) {
    const { error: errorCita } = await cliente.from('citas').insert({
      optica_id: perfil.optica_id, paciente_id: paciente.id, paciente: nombre, cedula: paciente.cedula, telefono: paciente.telefono,
      fecha: hoyLocalISO(-30 * i), hora: '09:00 AM', duracion_minutos: null, motivo: 'Consulta General', estado: 'Atendida',
    })
    if (errorCita) throw new Error(`No se pudo crear la cita ${i} del historial: ${errorCita.message}`)
  }
  return nombre
}
