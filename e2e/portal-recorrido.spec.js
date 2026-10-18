// Recorrido del paciente del portal (portal v2) en la óptica de pruebas, con el paciente fijo «E Dos E Portal Auditoria», en laptop y en celular:
// entra, ve su compra y su saldo, agenda una cita, la reagenda y cambia su teléfono; después comprueba en el sistema del personal (Administrador) que
// cada cosa aparece. Todo lo que crea lo deshace al terminar, aunque falle (la cita, el teléfono y la política de reagendar).
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

const NOMBRE = 'E Dos E Portal Auditoria'
const TELEFONO_FIJO = '0991234567' // el del paciente fijo; la prueba lo cambia y lo devuelve
const TAMANOS = [['laptop', 1366, 768], ['celular', 390, 844]]

const bd = async (fn) => { const c = new pg.Client(); await c.connect(); try { return await fn(c) } finally { await c.end() } }
const q = (t, p) => bd(async (c) => (await c.query(t, p)).rows)

async function entrarAlPortal(page) {
  await page.goto(`/?optica=${SLUG_PRUEBAS}`)
  await page.getByRole('button', { name: 'Iniciar sesión' }).first().click()
  await escribirSecreto(page, page.getByPlaceholder('Cédula o nombre de usuario'), process.env.E2E_PORTAL_CEDULA)
  await escribirSecreto(page, page.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByLabel('Cargando tu resumen')).toHaveCount(0, { timeout: 30_000 })
}
const menu = (page, nombre) => page.getByRole('navigation', { name: 'Menú del portal' }).filter({ visible: true }).getByRole('button', { name: nombre, exact: true })
const elegirHorario = async (ventana, indiceDia = 0) => {
  const dias = ventana.locator('button[title="Disponible"]')
  if (!(await dias.count())) await ventana.getByRole('button', { name: 'Mes siguiente' }).click()
  await dias.nth(indiceDia).click()
  await ventana.locator('button:enabled').filter({ hasText: /^\d{2}:\d{2} (AM|PM)$/ }).first().click()
}

for (const [nombre, ancho, alto] of TAMANOS) {
  test.describe(`Portal del paciente en ${nombre} (${ancho}×${alto})`, () => {
    test.use({ viewport: { width: ancho, height: alto } })

    test('compra y saldo, agendar, reagendar y cambiar el teléfono, y todo se ve en el sistema del personal', async ({ page, browser }) => {
      test.setTimeout(240_000)
      const optica = (await q("select id from opticas where slug = $1", [SLUG_PRUEBAS]))[0]
      const paciente = (await q("select id from pacientes_base where optica_id = $1 and nombre = $2", [optica.id, NOMBRE]))[0]
      const inicio = (await q('select now() as t'))[0].t
      // Si una corrida anterior se cortó antes de limpiar, se limpia primero (el paciente fijo no tiene citas propias).
      await q('delete from citas_base where paciente_id = $1', [paciente.id])
      const telefonoNuevo = '09' + String(Math.floor(Math.random() * 1e8)).padStart(8, '0')
      try {
        await bd((c) => c.query("update opticas set settings = coalesce(settings, '{}'::jsonb) || '{\"permitirReagendarPaciente\": true, \"horasAntesReagendar\": 2}'::jsonb where id = $1", [optica.id]))
        await entrarAlPortal(page)

        // 1. Su compra y su saldo: el mismo monto que Cobros y saldos (CV-0006: $60, abonó $20, debe $40).
        const saldo = page.getByRole('region', { name: 'Pendiente para ti' })
        await expect(saldo).toContainText('Tienes $40.00 por pagar')
        await menu(page, 'Mis compras').click()
        await expect(page.getByRole('list', { name: 'Compras con saldo o lentes en camino' })).toContainText('Debes $40.00')
        await expect(page.getByRole('list', { name: 'Compras con saldo o lentes en camino' })).toContainText('E Dos E Servicio portal')

        // 2. Agenda una cita: sin el campo «Paciente» y con el selector del sistema para el motivo.
        await menu(page, 'Mis citas').click()
        await page.getByRole('button', { name: 'Agendar cita' }).click()
        const ventana = page.getByRole('dialog', { name: 'Agendar cita' })
        await expect(ventana.getByText('Paciente', { exact: true })).toHaveCount(0)
        await expect(ventana.locator('select')).toHaveCount(0)
        await ventana.getByRole('combobox', { name: /Motivo de la cita/ }).click()
        await ventana.getByRole('option').first().click()
        await elegirHorario(ventana, (await ventana.locator('button[title="Disponible"]').count()) > 2 ? 1 : 0)
        await ventana.getByRole('button', { name: 'Continuar' }).click()
        await page.getByRole('dialog').last().getByRole('button', { name: /Confirmar/ }).click()
        await expect(page.getByRole('status').filter({ hasText: 'quedó agendada' })).toBeVisible({ timeout: 20_000 })
        const proximas = page.getByRole('region', { name: 'Tu próxima cita' })
        await expect(proximas.getByRole('button', { name: 'Reagendar' })).toBeVisible()
        const cita = (await q("select id, codigo, fecha::text, hora, origen from citas where paciente_id = $1 and created_at >= $2 order by created_at desc limit 1", [paciente.id, inicio]))[0]
        expect(cita, 'la cita quedó guardada').toBeTruthy()
        expect(cita.origen).toBe('paciente') // en pantalla del personal se llama «Web»

        // 3. La reagenda a otro horario.
        await proximas.getByRole('button', { name: 'Reagendar' }).first().click()
        const reagendar = page.getByRole('dialog', { name: 'Reagendar cita' })
        const dias = reagendar.locator('button[title="Disponible"]')
        await elegirHorario(reagendar, (await dias.count()) > 2 ? 2 : 0)
        await reagendar.getByRole('button', { name: 'Confirmar nuevo horario' }).click()
        await expect(page.getByRole('status').filter({ hasText: 'tu cita quedó para' })).toBeVisible({ timeout: 20_000 })
        const nueva = (await q("select fecha::text, hora from citas where id = $1", [cita.id]))[0]
        expect(`${nueva.fecha} ${nueva.hora}`).not.toBe(`${cita.fecha} ${cita.hora}`)

        // 4. Cambia su teléfono.
        await menu(page, 'Mis datos').click()
        await page.getByRole('button', { name: 'Cambiar teléfono' }).click()
        await page.getByLabel('Teléfono').fill(telefonoNuevo)
        await page.getByRole('button', { name: 'Guardar cambios' }).click()
        await expect(page.getByText('Listo: actualizamos tu teléfono.')).toBeVisible({ timeout: 15_000 })

        // 5. En el sistema del personal (Administrador, otra sesión) cada cosa aparece.
        const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } })
        const staff = await ctx.newPage()
        try {
          await iniciarSesion(staff, 'ADMIN', 'E2E')
          await staff.getByRole('button', { name: 'Citas médicas', exact: true }).first().click()
          await staff.getByRole('textbox', { name: /Buscar cita/ }).fill(cita.codigo || 'Portal Auditoria')
          await staff.getByTitle('Ver el detalle de la cita').first().click()
          const detalle = staff.getByRole('dialog')
          await expect(detalle).toContainText('Web') // origen de la cita
          await expect(detalle).toContainText(telefonoNuevo) // el teléfono nuevo, en la cita
          await expect(detalle).toContainText(nueva.hora) // la hora nueva (reagendada)
          await staff.keyboard.press('Escape') // cierra el detalle de la cita
          // El saldo es el mismo monto que en Cobros y saldos (Ventas).
          await staff.getByRole('button', { name: /^Ventas/ }).first().click()
          await staff.getByRole('tab', { name: /Cobros y saldos/ }).click()
          await expect(staff.getByText(NOMBRE).first()).toBeVisible({ timeout: 15_000 })
          await expect(staff.locator('main').getByText('$40.00').first()).toBeVisible()
        } finally { await ctx.close() }
        const perfil = (await q("select telefono from pacientes_base where id = $1", [paciente.id]))[0]
        expect(perfil.telefono).toBe(telefonoNuevo) // y en su perfil
      } finally {
        await q("delete from citas_base where paciente_id = $1", [paciente.id])
        await q("update pacientes_base set telefono = $2 where id = $1", [paciente.id, TELEFONO_FIJO])
        // La política de reagendar solo la enciende la prueba; antes no estaba puesta en la óptica de pruebas.
        await q("update opticas set settings = settings - 'permitirReagendarPaciente' - 'horasAntesReagendar' where id = $1", [optica.id])
      }
    })
  })
}
