// Ronda 2c — el aviso «con control vencido» se resuelve agendando el control: «Agendar control» (abre «Gestionar cita» con el paciente y el motivo de control ya elegidos),
// «WhatsApp» (mensaje ya redactado) y «Descartar». Ya no manda al CRM; su enlace lleva a Pacientes con el filtro «Control vencido».
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { iniciarSesion, prepararAvisosInicio } from './ayudas.js'

test.use({ viewport: { width: 1093, height: 768 } })

test('Control vencido: Agendar control, WhatsApp y Descartar; el enlace lleva a Pacientes filtrado', async ({ page }) => {
  test.setTimeout(180_000)
  await prepararAvisosInicio('E2E')
  await iniciarSesion(page, 'ADMIN', 'E2E')
  const area = page.getByRole('region', { name: 'Requiere tu atención: Pacientes' })
  await expect(area).toBeVisible({ timeout: 20_000 })
  const abrir = async () => {
    await area.getByRole('button', { name: /con el control vencido$/ }).click()
    return page.getByRole('dialog')
  }
  let ventana = await abrir()
  const caso = ventana.getByRole('listitem').filter({ hasText: 'E Dos E Control Vencido' })
  await expect(caso.getByRole('button', { name: 'Agendar control' })).toBeVisible()
  await expect(caso.getByRole('button', { name: 'WhatsApp' })).toBeVisible()
  await expect(caso.getByRole('button', { name: /^Descartar el aviso de / })).toBeVisible()
  await expect(ventana.getByRole('button', { name: /Ver en CRM/ })).toHaveCount(0)
  fs.mkdirSync('docs/ronda2-capturas', { recursive: true })
  await page.screenshot({ path: 'docs/ronda2-capturas/control-vencido.png' })

  // «Agendar control»: «Gestionar cita» con el paciente y el motivo de control ya elegidos.
  await caso.getByRole('button', { name: 'Agendar control' }).click()
  const gestionar = page.getByRole('dialog', { name: /Gestionar cita/ })
  await expect(gestionar).toBeVisible({ timeout: 20_000 })
  await expect(gestionar.getByRole('textbox', { name: /buscar por nombre o cédula/ })).toHaveValue('E Dos E Control Vencido')
  await expect(gestionar.getByRole('combobox', { name: 'Motivo del examen' }).locator('option:checked')).toHaveText('Examen de Control')
  await page.screenshot({ path: 'docs/ronda2-capturas/control-vencido-agendar.png' })
  await page.keyboard.press('Escape')

  // «Ver todo» del aviso: Pacientes con el filtro de control vencido.
  await page.getByRole('button', { name: 'Inicio', exact: true }).first().click()
  ventana = await abrir()
  await ventana.getByRole('button', { name: /^Abrir en Pacientes · Control vencido/ }).click()
  await expect(page.getByRole('button', { name: /^Control vencido \(\d+\)/ })).toBeVisible({ timeout: 20_000 })
})
