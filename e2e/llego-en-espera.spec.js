// Flujo "Llegó → En espera → Atender" (reunión del 7 oct., C15/C16) en la óptica de pruebas (E2E): ESCRIBE datos
// (crea un paciente y una cita de hoy para Paula y la lleva a "En atención"). Recepción marca que el paciente llegó; la
// cita pasa a "En espera", cuenta en "En sala de espera" y el optómetra la ve en su Inicio; "Atender" entra directo a la
// ficha, sin modal de resumen.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

const valorTarjeta = async (page, titulo) => {
  const tarjeta = page.locator('main').first().getByRole('button', { name: new RegExp(titulo, 'i') }).first()
  await expect(tarjeta).toBeVisible({ timeout: 20_000 })
  const texto = await tarjeta.innerText()
  return Number((texto.match(/\n\s*(\d+)\s*\n/) || texto.match(/(\d+)/))?.[1] ?? 'NaN')
}

async function abrirDetalle(page, nombre) {
  await page.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
  await page.getByLabel('Buscar cita: paciente o código').fill(nombre)
  await page.getByTitle('Ver el detalle de la cita').first().click()
  return page.getByRole('dialog')
}

test('Llegó pasa la cita a "En espera", se ve en Inicio y Atender entra directo a la ficha', async ({ browser }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E')

  // ── Recepción: marca que el paciente llegó ──
  const recepcion = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await iniciarSesion(recepcion, 'RECEPCION', 'E2E')
  await expect(recepcion.getByText('El movimiento del día')).toBeVisible({ timeout: 20_000 })
  const esperandoAntes = await valorTarjeta(recepcion, 'En sala de espera')

  let detalle = await abrirDetalle(recepcion, nombre)
  // La tarjeta ya no lleva el menú ⋮ ni el ojo; todo está en el detalle.
  await expect(recepcion.getByRole('button', { name: 'Más acciones' })).toHaveCount(0)
  await expect(recepcion.getByTitle(/Ver perfil del paciente/)).toHaveCount(0)
  await expect(detalle.getByRole('status', { name: /Estado: / }).filter({ hasText: 'Pendiente' })).toBeVisible()
  await detalle.getByRole('button', { name: 'Llegó' }).click()
  await expect(detalle.getByRole('status', { name: /Estado: / }).filter({ hasText: 'En espera' })).toBeVisible({ timeout: 15_000 })
  await expect(recepcion.getByText(/llegó: la cita pasa a "En espera"/)).toBeVisible()
  // Recepción no atiende: sin "Atender" en el detalle, y "Aún no llegó" deshace la marca.
  await expect(detalle.getByRole('button', { name: /^(Atender|Retomar)$/ })).toHaveCount(0)
  await expect(detalle.getByRole('button', { name: 'Aún no llegó' })).toBeVisible()
  await detalle.getByRole('button', { name: 'Cerrar' }).click()

  await recepcion.getByRole('button', { name: 'Inicio', exact: true }).first().click()
  await expect.poll(() => valorTarjeta(recepcion, 'En sala de espera'), { timeout: 15_000 }).toBe(esperandoAntes + 1)
  await recepcion.close()

  // ── Optómetra: la ve esperando y la atiende ──
  const optometra = await browser.newPage({ viewport: { width: 1366, height: 768 } })
  await iniciarSesion(optometra, 'OPTOMETRA', 'E2E')
  await expect(optometra.getByRole('region', { name: 'Mis citas de hoy' })).toBeVisible({ timeout: 20_000 })
  // Su cita aparece en la agenda de hoy (y, al ser quien ya llegó, puede ser también el "Siguiente paciente" destacado).
  await expect(optometra.getByRole('region', { name: 'Mis citas de hoy' }).getByRole('button', { name: new RegExp(nombre) }).first()).toBeVisible()

  detalle = await abrirDetalle(optometra, nombre)
  await expect(detalle.getByRole('status', { name: /Estado: / }).filter({ hasText: 'En espera' })).toBeVisible()
  await detalle.getByRole('button', { name: 'Atender', exact: true }).click()
  await expect(optometra.getByRole('heading', { name: 'Ficha clínica' })).toBeVisible({ timeout: 20_000 })
  await expect(optometra.getByText('Resumen de la cita')).toHaveCount(0)
  await optometra.close()
})
