// Cierre por inactividad (Ronda 2, A): 30 minutos contados con la actividad de CUALQUIER pestaña, y un minuto antes la ventana
// «¿Sigues ahí?» con cuenta regresiva y «Seguir conectado». Corre en la óptica de pruebas con el reloj simulado de Playwright.
import { test, expect } from '@playwright/test'
import { iniciarSesion, slugDe } from './ayudas.js'

const ENTORNO = 'E2E'
const dentro = (page) => expect(page.getByRole('button', { name: 'Iniciar sesión' })).toHaveCount(0, { timeout: 25_000 })
const enElIngreso = (page) => expect(page.getByRole('button', { name: 'Iniciar sesión' }).first()).toBeVisible({ timeout: 25_000 })
const ventana = (page) => page.getByRole('dialog', { name: '¿Sigues ahí?' })
// El reloj simulado es de todo el contexto (las pestañas comparten el tiempo): se adelanta una sola vez, no una por pestaña.
const avanzar = (paginas, tiempo) => paginas[0].context().clock.fastForward(tiempo)

async function otraPestana(context) {
  const page = await context.newPage()
  await page.goto(`/?optica=${slugDe(ENTORNO)}`)
  await dentro(page)
  await expect(page.getByRole('heading', { name: 'Totales' })).toBeVisible({ timeout: 25_000 }) // ya con el tablero dibujado
  return page
}

test.describe('inactividad de la sesión', () => {
  test('a los 29 minutos sale la ventana; «Seguir conectado» en una pestaña la quita en todas y reinicia el tiempo', async ({ page, context }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    const b = await otraPestana(context)
    await page.context().clock.install()
    // 28 minutos: todavía nada.
    await avanzar([page, b], '28:00')
    await expect(ventana(page)).toHaveCount(0)
    // 29:10 -> faltan unos 50 s; la ventana sale en las dos pestañas con la cuenta regresiva.
    await avanzar([page, b], '01:10')
    await expect(ventana(page)).toBeVisible()
    await expect(ventana(b)).toBeVisible()
    await expect(ventana(page).getByText(/^0[01]:\d\d$/)).toBeVisible()
    await expect(page.getByText('Tu sesión se cerrará por seguridad')).toBeVisible()
    // Mover el mouse no reinicia nada mientras la ventana está: solo «Seguir conectado» (o cerrar la ventana).
    await page.mouse.move(5, 5); await page.mouse.move(400, 300)
    await avanzar([page, b], '00:05')
    await expect(ventana(page)).toBeVisible()
    // Se pulsa en la pestaña B: se reinicia en las dos.
    await ventana(b).getByRole('button', { name: 'Seguir conectado' }).click()
    await avanzar([page, b], '00:02')
    await expect(ventana(b)).toHaveCount(0)
    await expect(ventana(page)).toHaveCount(0)
    // Con el tiempo reiniciado, 25 minutos después sigue sin aviso ni cierre.
    await avanzar([page, b], '25:00')
    await expect(ventana(page)).toHaveCount(0)
    await dentro(page)
  })

  test('si nadie pulsa, a los 30 minutos se cierra la sesión en todas las pestañas con el mensaje de inactividad', async ({ page, context }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    const b = await otraPestana(context)
    await page.context().clock.install()
    await avanzar([page, b], '29:10')
    await expect(ventana(page)).toBeVisible()
    await avanzar([page, b], '01:00')
    await enElIngreso(page)
    await enElIngreso(b)
    await expect(page.getByText(/cerró por inactividad/)).toBeVisible()
    await expect(b.getByText(/cerró por inactividad/)).toBeVisible()
  })

  test('con una ficha clínica abierta, el borrador se guarda antes de cerrar y se conserva', async ({ page }) => {
    await iniciarSesion(page, 'ADMIN', ENTORNO)
    // Lo que escribe la ficha: se simula con el borrador del mismo formato (la ficha lo escucha en ConsultaMedica; aquí se comprueba
    // que cerrar por inactividad NO borra los borradores, como sí hace "Cerrar sesión").
    await page.evaluate(() => localStorage.setItem('ficha-borrador:prueba:paciente:directa', JSON.stringify({ v: 1, guardadoEn: Date.now(), datos: { motivoConsulta: 'x' } })))
    await page.context().clock.install()
    await page.clock.fastForward('30:30')
    await enElIngreso(page)
    expect(await page.evaluate(() => localStorage.getItem('ficha-borrador:prueba:paciente:directa'))).not.toBeNull()
    await page.evaluate(() => localStorage.removeItem('ficha-borrador:prueba:paciente:directa'))
  })
})
