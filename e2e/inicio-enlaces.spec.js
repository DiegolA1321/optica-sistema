// Regla 42: todo lo que se puede presionar en el Inicio lleva exactamente a lo que promete. Cada prueba es una pareja "lo que dice / lo que abre":
// el número que se lee en la tarjeta o en el enlace es el que se ve al llegar al módulo (mismo período, mismo filtro, misma lista).
//  - Administrador y optómetra sobre la Demo: SOLO LECTURA, comparando en cada lado lo que hay (no dependen de datos fijos).
//  - Próxima jornada del optómetra: en la óptica de pruebas, con una cita de Paula en un día futuro.
import { test, expect } from '@playwright/test'
import { iniciarSesion, crearCitaDeHoyParaPaula, cancelarCitasDePrueba } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 900 } })
const main = (page) => page.locator('main').first()
const alInicio = async (page) => {
  await page.getByRole('button', { name: 'Inicio', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: /Requiere tu atención/i }).first()).toBeVisible({ timeout: 20_000 })
}
const numeroDeTarjeta = async (page, nombre) => Number(((await page.getByRole('button', { name: new RegExp(`^${nombre}:`) }).first().getAttribute('aria-label')).match(/: (\d+)\./) || [])[1])
const estado = (page) => page.getByRole('status').first()

test('administrador: las tarjetas de Totales abren la lista que tiene su número', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await alInicio(page)
  const pacientes = await numeroDeTarjeta(page, 'Pacientes')
  const citas = await numeroDeTarjeta(page, 'Citas')
  const productos = await numeroDeTarjeta(page, 'Productos')
  expect(citas).toBeGreaterThan(0)

  await page.getByRole('button', { name: /^Pacientes:/ }).click()
  await expect(main(page).getByText(`${pacientes} pacientes`).first()).toBeVisible({ timeout: 15_000 })

  await alInicio(page)
  await page.getByRole('button', { name: /^Citas:/ }).click()
  // Citas "Todas" cuenta sin las canceladas, igual que la tarjeta
  await expect(estado(page)).toHaveText(new RegExp(`^${citas} citas?$`), { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Todas', exact: true }).first()).toHaveAttribute('aria-pressed', 'true')

  await alInicio(page)
  await page.getByRole('button', { name: /^Ventas:/ }).click()
  await expect(page.getByRole('tab', { name: /Comprobantes de venta/ })).toHaveAttribute('aria-selected', 'true', { timeout: 15_000 }) // los comprobantes, no la cola por vender

  await alInicio(page)
  await page.getByRole('button', { name: /^Productos:/ }).click()
  await expect(main(page)).toContainText(new RegExp(`${productos}\\s*Productos`), { timeout: 15_000 })
})

test('administrador: cada "Abrir en …" de la ventana de avisos muestra al llegar el número que prometía', async ({ page }) => {
  await iniciarSesion(page, 'ADMIN')
  await alInicio(page)
  let enlacesProbados = 0
  for (const area of ['Citas', 'Pacientes', 'Ventas', 'Inventario']) {
    const abrir = async () => { await alInicio(page); await page.getByRole('button', { name: `Ver todo en ${area}` }).click() }
    const tarjeta = page.getByRole('region', { name: `Requiere tu atención: ${area}` })
    if (!(await tarjeta.getByRole('button', { name: `Ver todo en ${area}` }).count())) continue // área en orden: no tiene ventana
    await page.getByRole('button', { name: `Ver todo en ${area}` }).click()
    const etiquetas = (await page.getByRole('dialog').getByRole('button', { name: /^Abrir en / }).allInnerTexts()).map((t) => t.trim())
    await page.keyboard.press('Escape')
    for (const etiqueta of etiquetas) {
      await abrir()
      await page.getByRole('dialog').getByRole('button', { name: new RegExp('^' + etiqueta.replace(/[()·]/g, '\\$&')) }).click()
      const n = Number((etiqueta.match(/\((\d+)/) || [])[1])
      if (/En atención/.test(etiqueta)) {
        await expect(estado(page)).toHaveText(new RegExp(`^${n} citas?$`), { timeout: 15_000 })
        await expect(page.getByRole('button', { name: /Quitar el filtro Estado: En atención/ })).toBeVisible()
      } else if (/Para reagendar/.test(etiqueta)) {
        await expect(estado(page)).toHaveText(new RegExp(`^${n} citas?$`), { timeout: 15_000 })
        await expect(page.getByRole('button', { name: /Quitar el filtro Tarea: Para reagendar/ })).toBeVisible()
      } else if (/Control sin agendar|Sin consulta/.test(etiqueta)) {
        await expect(estado(page)).toHaveText(new RegExp(`^Mostrando ${n} de \\d+ pacientes$`), { timeout: 15_000 })
      } else if (/Órdenes listas/.test(etiqueta)) {
        await expect(page.getByRole('button', { name: `Listas para entrega (${n})` })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
      } else if (/Órdenes atrasadas/.test(etiqueta)) {
        await expect(page.getByRole('button', { name: `Atrasadas (${n})` })).toHaveAttribute('aria-pressed', 'true', { timeout: 15_000 })
      } else if (/Saldos por cobrar/.test(etiqueta)) {
        await expect(main(page)).toContainText(new RegExp(`${n} pacientes? con saldo`), { timeout: 15_000 })
      } else if (/Stock bajo/.test(etiqueta)) {
        await expect(main(page)).toContainText(`Stock bajo (${n})`, { timeout: 15_000 })
        await expect(main(page)).toContainText(new RegExp(`Mostrando ${n} de ${n}`))
      } else {
        throw new Error('Un enlace "Abrir en …" nuevo sin su pareja verificada: ' + etiqueta)
      }
      enlacesProbados++
    }
  }
  expect(enlacesProbados).toBeGreaterThan(0)
})

test('optómetra: "Ver en Citas" de su agenda abre exactamente esa jornada, con ese número de citas', async ({ page }) => {
  await iniciarSesion(page, 'OPTOMETRA')
  await alInicio(page)
  const titulo = (await page.getByRole('heading', { level: 2, name: /^Mi (agenda de hoy|próxima jornada con citas)/ }).first().innerText()).trim()
  const n = Number((titulo.match(/· (\d+) citas?/i) || [])[1] || 0)
  const enlace = page.getByRole('button', { name: /^Ver en Citas · / })
  if (!n) { await expect(enlace).toHaveCount(0); return } // sin citas por venir no hay enlace que prometa nada
  await enlace.click()
  await expect(estado(page)).toHaveText(new RegExp(`^${n} citas? (hoy|ese día)$`, 'i'), { timeout: 15_000 })
  await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveCount(0) // el optómetra no recibe un período que su Citas no ofrece
})

test('optómetra con la próxima jornada: el enlace nombra el día y Citas se abre en ese día (no en "Todas")', async ({ page }) => {
  const nombre = await crearCitaDeHoyParaPaula('E2E', { diasDespues: 2 })
  try {
    await iniciarSesion(page, 'OPTOMETRA', 'E2E')
    await alInicio(page)
    await expect(page.getByRole('heading', { level: 2, name: /^Mi próxima jornada con citas · .* · 1 cita$/i })).toBeVisible({ timeout: 20_000 })
    const enlace = page.getByRole('button', { name: /^Ver en Citas · (lun|mar|mié|jue|vie|sáb|dom) \d{1,2} \w+ \d{4}$/ })
    const dia = (await enlace.innerText()).replace('Ver en Citas · ', '').trim()
    await enlace.click()
    await expect(estado(page)).toHaveText(/^1 cita ese día$/i, { timeout: 15_000 })
    await expect(main(page)).toContainText(dia.split(' ').slice(0, 3).join(' ')) // el selector de día muestra esa fecha
    await expect(main(page)).toContainText(nombre)
    await expect(page.getByRole('button', { name: 'Todas', exact: true })).toHaveCount(0)
  } finally {
    await cancelarCitasDePrueba([nombre])
  }
})
