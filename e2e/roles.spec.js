// Recorridos por rol en la Óptica Demo: qué ve (Inicio y menú), qué puede crear o editar y qué no.
// Los permisos esperados son los de los roles predefinidos (migración 0090). Usa expect.soft para
// reunir todos los hallazgos de una pasada; no corrige nada.
import { test, expect } from '@playwright/test'
import { iniciarSesion } from './ayudas.js'

const TODOS = ['Inicio', 'Citas médicas', 'Pacientes', 'Ventas', 'Inventario', 'CRM y fidelización', 'Mi horario', 'Reportes']
const SOLO_ADMIN = ['Usuarios y permisos', 'Configuración', 'Mensajes']

const modulo = (page, nombre) => page.getByRole('button', { name: nombre, exact: true })
const abrir = async (page, nombre) => { await modulo(page, nombre).first().click(); await page.waitForTimeout(1800) }
const visible = (page, nombre, ambito = 'main') => page.locator(ambito).getByRole('button', { name: nombre })
async function totalAgendadas(page) {
  await abrir(page, 'Citas médicas')
  const t = await page.getByRole('button', { name: /Total agendadas/ }).first().innerText()
  return Number(t.replace(/\D/g, ''))
}
// Otros caminos a la ficha (perfil del paciente): sin permiso tampoco se ofrecen. Si alguien llegara igual por
// otro camino, Citas, Pacientes y Dashboard muestran "No tienes permiso para atender pacientes." (red de seguridad
// que hoy no tiene botón desde el cual probarse en pantalla).
async function sinAtajosAFicha(page) {
  await abrir(page, 'Pacientes')
  await page.locator('main').getByRole('button', { name: 'Ver perfil 360°' }).first().click()
  await expect.soft(page.getByRole('button', { name: 'Ficha clínica' }), 'sin botón "Ficha clínica" en el perfil').toHaveCount(0)
  await expect.soft(page.getByRole('button', { name: /^Ingresar$/ }), 'sin "Ingresar" en el perfil').toHaveCount(0)
  await expect.soft(page.getByRole('button', { name: /Atenderlo ahora/ })).toHaveCount(0)
}
async function menuVisible(page) {
  const out = []
  for (const n of [...TODOS, ...SOLO_ADMIN]) if (await modulo(page, n).count()) out.push(n)
  return out
}

let totalRecepcion

test.describe('Recepción', () => {
  test('menú, Inicio y permisos', async ({ page }) => {
    await iniciarSesion(page, 'RECEPCION')
    await expect(page.getByText('El movimiento del día')).toBeVisible({ timeout: 15_000 })
    expect.soft(await menuVisible(page)).toEqual(TODOS.filter((n) => n !== 'Reportes'))
    await expect.soft(page.getByText('MIS CITAS DE HOY')).toHaveCount(0)

    totalRecepcion = await totalAgendadas(page)
    expect.soft(totalRecepcion, 'Recepción ve todas las citas').toBeGreaterThan(60)
    await expect.soft(visible(page, 'Gestionar cita'), 'Recepción puede agendar').toBeVisible()
    await abrir(page, 'Pacientes')
    await expect.soft(visible(page, 'Crear paciente')).toBeVisible()
    await expect.soft(visible(page, 'Nueva venta').first(), 'Recepción puede vender').toBeVisible()
    await abrir(page, 'Ventas')
    await expect.soft(visible(page, 'Nueva venta')).toBeVisible()
    await expect.soft(visible(page, 'Tomar datos del diagnóstico').first()).toBeVisible()
    await abrir(page, 'Inventario')
    await expect.soft(visible(page, 'Agregar producto'), 'Recepción solo ve el inventario').toHaveCount(0)
    await expect.soft(visible(page, 'Editar o añadir stock')).toHaveCount(0)
    await abrir(page, 'CRM y fidelización')
    await expect.soft(visible(page, 'Publicar aviso')).toBeVisible()
  })

  test('sin permiso para fichas clínicas: no ve "Atender" ni "Ingresar"', async ({ page }) => {
    await iniciarSesion(page, 'RECEPCION')
    await abrir(page, 'Citas médicas')
    await expect.soft(page.locator('main').getByRole('button', { name: 'Atender', exact: true }), 'Recepción no debe ver "Atender"').toHaveCount(0)
    // El detalle de la cita tampoco ofrece "Ingresar".
    await page.locator('main').getByText('Paola Zambrano Loor').first().click()
    await expect.soft(page.getByRole('dialog').getByRole('button', { name: /Ingresar/ }), 'Recepción no debe ver "Ingresar" en el detalle').toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect.soft(page.getByText('Atender ahora (hora actual)'), 'tampoco "Atender ahora" al agendar').toHaveCount(0)
    await sinAtajosAFicha(page)
  })
})

test.describe('Ventas', () => {
  test('menú, Inicio y permisos', async ({ page }) => {
    await iniciarSesion(page, 'VENTAS')
    await expect(page.getByText('Lo que espera a quien vende')).toBeVisible({ timeout: 15_000 })
    expect.soft(await menuVisible(page)).toEqual(TODOS.filter((n) => n !== 'Reportes'))
    await expect.soft(page.getByText('SALDOS POR COBRAR')).toBeVisible()

    await abrir(page, 'Citas médicas')
    await expect.soft(visible(page, 'Gestionar cita'), 'Ventas no agenda citas (citas: solo ver)').toHaveCount(0)
    await abrir(page, 'Pacientes')
    await expect.soft(visible(page, 'Crear paciente'), 'Ventas no crea pacientes').toHaveCount(0)
    await expect.soft(visible(page, 'Nueva venta').first()).toBeVisible()
    await abrir(page, 'Ventas')
    await expect.soft(visible(page, 'Nueva venta')).toBeVisible()
    await abrir(page, 'Inventario')
    await expect.soft(visible(page, 'Agregar producto'), 'Ventas gestiona inventario').toBeVisible()
    await expect.soft(visible(page, 'Editar o añadir stock').first()).toBeVisible()
  })

  test('sin permiso para fichas clínicas: no ve "Atender" ni "Ingresar"', async ({ page }) => {
    await iniciarSesion(page, 'VENTAS')
    await abrir(page, 'Citas médicas')
    await expect.soft(page.locator('main').getByRole('button', { name: 'Atender', exact: true }), 'Ventas no debe ver "Atender"').toHaveCount(0)
    // El detalle de la cita tampoco ofrece "Ingresar".
    await page.locator('main').getByText('Paola Zambrano Loor').first().click()
    await expect.soft(page.getByRole('dialog').getByRole('button', { name: /Ingresar/ }), 'Ventas no debe ver "Ingresar" en el detalle').toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect.soft(page.getByText('Atender ahora (hora actual)'), 'tampoco "Atender ahora" al agendar').toHaveCount(0)
    await sinAtajosAFicha(page)
  })
})

test.describe('Optómetra', () => {
  test('menú, Inicio y alcance propio', async ({ page }) => {
    await iniciarSesion(page, 'OPTOMETRA')
    await expect(page.getByText('Tu agenda del día')).toBeVisible({ timeout: 15_000 })
    expect.soft(await menuVisible(page)).toEqual(TODOS)
    await expect.soft(page.getByText('MIS CITAS DE HOY')).toBeVisible()

    const propias = await totalAgendadas(page)
    expect.soft(propias, 'alcance propio: menos citas que Recepción').toBeLessThan(totalRecepcion ?? 1e9)
    expect.soft(propias).toBeGreaterThan(0)
    await expect.soft(page.getByText('Paola Zambrano Loor').first(), 'su cita asignada').toBeVisible()
    await expect.soft(page.getByText('Rosa Bravo Delgado'), 'cita asignada al administrador: no debe verse').toHaveCount(0)
    await expect.soft(visible(page, 'Gestionar cita')).toBeVisible()
    // Que Paula vea 'Atender' depende de que tenga una cita HOY (los datos sembrados no lo garantizan): lo cubre e2e/flujo-completo.spec.js
    // en la óptica de pruebas, que crea su propia cita. Aquí (Demo, solo lectura) no se escribe nada.
  })

  test('permisos: crea pacientes, no vende ni toca inventario', async ({ page }) => {
    await iniciarSesion(page, 'OPTOMETRA')
    await abrir(page, 'Pacientes')
    await expect.soft(visible(page, 'Crear paciente')).toBeVisible()
    await expect.soft(visible(page, 'Nueva venta')).toHaveCount(0)
    await page.locator('main').getByRole('button', { name: 'Ver perfil 360°' }).first().click()
    await expect.soft(page.getByRole('button', { name: 'Ficha clínica' }), 'el optómetra sí puede abrir la ficha').toBeVisible()
    await page.keyboard.press('Escape')
    await abrir(page, 'Ventas')
    await expect.soft(visible(page, 'Nueva venta'), 'Optómetra solo ve ventas').toHaveCount(0)
    await expect.soft(visible(page, 'Tomar datos del diagnóstico')).toHaveCount(0)
    await abrir(page, 'Inventario')
    await expect.soft(visible(page, 'Agregar producto')).toHaveCount(0)
    await expect.soft(visible(page, 'Editar o añadir stock')).toHaveCount(0)
    await abrir(page, 'Reportes')
    await expect.soft(page.getByRole('button', { name: 'Este mes' })).toBeVisible()
  })
})
