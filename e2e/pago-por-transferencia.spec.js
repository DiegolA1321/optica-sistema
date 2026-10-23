// Pagar por transferencia de punta a punta, en la óptica de pruebas (migración 0131): el administrador escribe la cuenta de la óptica en Configuración; el paciente la ve en su portal, transfiere
// y sube su comprobante; Ventas («Cobros y saldos») y el Inicio lo cuentan; el personal lo confirma (queda un abono por transferencia) o lo rechaza con un motivo; y el paciente ve cada estado.
import { test, expect } from '@playwright/test'
import pg from 'pg'
import { iniciarSesion, escribirSecreto, SLUG_PRUEBAS } from './ayudas.js'

test.use({ viewport: { width: 1366, height: 768 } })

async function conPg(fn) {
  const c = new pg.Client()
  await c.connect()
  try { return await fn(c) } finally { await c.end() }
}

// La venta de prueba se quita SIEMPRE: en `afterEach` (corre aunque la prueba se corte por tiempo, cosa que un `finally` dentro de la prueba no garantiza) y, como red de seguridad, la limpieza de la
// óptica de pruebas quita antes de cada corrida lo que el paciente fijo tenga de más. Así no queda un saldo de $30 que haga fallar `portal-recorrido`.
let factura = null
test.afterEach(async () => {
  if (!factura) return
  await conPg(async (c) => {
    await c.query('delete from pagos_transferencia where factura_id = $1', [factura.id])
    await c.query('delete from abonos_factura where factura_id = $1', [factura.id])
    await c.query('delete from facturas_venta where id = $1', [factura.id])
    await c.query('update opticas set datos_bancarios = null where slug = $1', [SLUG_PRUEBAS])
  })
  factura = null
})

// El personal revisa un pago: Ventas › dato «Pago por verificar» › la venta › «Revisar» la transferencia de ese monto (abre «Pago de …»).
async function revisarPago(personal, monto) {
  await personal.getByRole('button', { name: /^Ventas/ }).first().click()
  await personal.getByRole('tab', { name: /^Ventas/ }).click()
  await personal.getByRole('list', { name: 'Resumen de las ventas' }).getByRole('button', { name: /^Pago por verificar/ }).click()
  await personal.getByRole('list', { name: 'Ventas' }).getByRole('button', { name: /^Ver la venta/ }).first().click()
  const venta = personal.getByRole('dialog', { name: /^Venta CV-/ })
  await venta.getByRole('list', { name: 'Transferencias por verificar' }).getByRole('listitem').filter({ hasText: monto }).getByRole('button', { name: 'Revisar' }).click()
  return personal.getByRole('dialog', { name: 'Pago por verificar' })
}

test('el paciente paga por transferencia y la óptica lo confirma o lo rechaza', async ({ browser }) => {
  test.setTimeout(300_000)
  // Una venta nueva con saldo para el paciente fijo del portal: la prueba no gasta el saldo de las demás.
  factura = await conPg(async (c) => {
    const op = (await c.query("select id from opticas where slug = $1", [SLUG_PRUEBAS])).rows[0].id
    const p = (await c.query("select id from pacientes_base where optica_id = $1 and nombre = 'E Dos E Portal Auditoria'", [op])).rows[0].id
    const admin = (await c.query("select id from perfiles where optica_id = $1 and rol = 'admin' limit 1", [op])).rows[0].id
    const numero = (await c.query("insert into contador_comprobantes_venta (optica_id, ultimo_numero) values ($1, 1) on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1 returning ultimo_numero n", [op])).rows[0].n
    return (await c.query("insert into facturas_venta (optica_id, paciente_id, metodo_pago, monto_total, estado, registrado_por, numero) values ($1, $2, 'abonos', 30, 'pendiente_pago', $3, $4) returning id, numero", [op, p, admin, numero])).rows[0]
  })
  try {
    // 1. El administrador escribe la cuenta de la óptica
    const personal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
    await iniciarSesion(personal, 'ADMIN', 'E2E')
    await personal.getByRole('button', { name: 'Configuración', exact: true }).first().click()
    await personal.getByRole('tab', { name: 'Catálogos' }).click()
    await personal.getByLabel('Banco', { exact: true }).fill('Banco de Pruebas')
    await personal.getByLabel('Número de cuenta').fill('1234567890')
    await personal.getByLabel('A nombre de').fill('Óptica de pruebas')
    await personal.getByRole('button', { name: 'Guardar cuenta' }).click()
    await expect(personal.getByText(/Cuenta para transferencias guardada/)).toBeVisible({ timeout: 20_000 })

    // 2. El paciente la ve y reporta su transferencia
    const portal = await (await browser.newContext({ viewport: { width: 1366, height: 768 }, locale: 'es-EC' })).newPage()
    await portal.goto(`/?optica=${SLUG_PRUEBAS}`)
    await portal.getByRole('button', { name: 'Iniciar sesión' }).first().click()
    await escribirSecreto(portal, portal.getByPlaceholder('Ej. 0912345678 o tu usuario'), process.env.E2E_PORTAL_CEDULA)
    await escribirSecreto(portal, portal.getByPlaceholder('Tu contraseña'), process.env.E2E_PORTAL_CLAVE)
    await portal.getByRole('button', { name: 'Ingresar', exact: true }).click()
    await expect(portal.getByRole('heading', { name: 'Inicio' })).toBeVisible({ timeout: 30_000 })
    await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
    await portal.getByRole('button', { name: /Ver tus compras con saldo/ }).click()
    await portal.getByRole('dialog', { name: 'Tu saldo por pagar' }).getByRole('button', { name: 'Pagar por transferencia' }).click()
    const ventana = portal.getByRole('dialog', { name: 'Pagar por transferencia' })
    await expect(ventana).toContainText('Banco de Pruebas')
    await expect(ventana).toContainText('1234567890')
    const enviar = async (monto) => {
      await ventana.getByLabel(/¿Cuánto transferiste\?/).fill(monto)
      await ventana.getByLabel(/Elegir la foto o el PDF|Cambiar el archivo/).setInputFiles({ name: 'comprobante.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'.repeat(8)) })
      await ventana.getByRole('button', { name: 'Enviar comprobante' }).click()
    }
    await enviar('10')
    await expect(ventana.getByRole('status')).toContainText('Recibimos tu comprobante', { timeout: 30_000 })
    await ventana.getByRole('button', { name: 'Listo' }).click()

    // 3. Ventas y el Inicio lo cuentan
    await personal.getByRole('button', { name: 'Inicio', exact: true }).first().click()
    await personal.reload()
    await expect(personal.getByText(/pagos? por verificar/).first()).toBeVisible({ timeout: 60_000 })
    const revision = await revisarPago(personal, '$10.00')
    await expect(revision.getByRole('region', { name: 'Comprobante' }).locator('iframe')).toBeVisible({ timeout: 20_000 })
    await revision.getByRole('button', { name: 'Confirmar pago' }).click()
    await expect(personal.getByText(/Pago confirmado/).first()).toBeVisible({ timeout: 30_000 })

    // 4. Queda como un abono por transferencia; el paciente ve «Pago confirmado»
    await conPg(async (c) => {
      const abono = (await c.query("select monto, pagos from abonos_factura where factura_id = $1", [factura.id])).rows[0]
      expect(Number(abono.monto)).toBe(10)
      expect(abono.pagos[0].metodo).toBe('transferencia')
    })
    await portal.reload()
    await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
    await portal.getByRole('button', { name: /Ver tus compras con saldo/ }).click()
    await expect(portal.getByRole('list', { name: 'Pagos que reportaste por transferencia' })).toContainText('Pago confirmado', { timeout: 30_000 })

    // 5. Otro pago: la óptica lo rechaza con su motivo y el paciente lo lee
    await portal.getByRole('dialog', { name: 'Tu saldo por pagar' }).getByRole('button', { name: 'Pagar por transferencia' }).click()
    await enviar('5')
    await expect(ventana.getByRole('status')).toBeVisible({ timeout: 30_000 })
    await ventana.getByRole('button', { name: 'Listo' }).click()
    await personal.reload()
    const rev2 = await revisarPago(personal, '$5.00')
    await rev2.getByRole('button', { name: 'Rechazar' }).click()
    await rev2.getByLabel(/Motivo del rechazo/).fill('No aparece en la cuenta')
    await rev2.getByRole('button', { name: 'Rechazar pago' }).click()
    await expect(personal.getByText(/Pago rechazado/).first()).toBeVisible({ timeout: 30_000 })
    await portal.reload()
    await portal.getByRole('navigation', { name: 'Menú del portal' }).getByRole('button', { name: 'Mis compras', exact: true }).click()
    await portal.getByRole('button', { name: /Ver tus compras con saldo/ }).click()
    const estados = portal.getByRole('list', { name: 'Pagos que reportaste por transferencia' })
    await expect(estados).toContainText('Pago rechazado', { timeout: 30_000 })
    await expect(estados).toContainText('Motivo: No aparece en la cuenta')
  } finally {
    await conPg(async (c) => {
      await c.query("delete from pagos_transferencia where factura_id = $1", [factura.id])
      await c.query("delete from abonos_factura where factura_id = $1", [factura.id])
      await c.query("delete from facturas_venta where id = $1", [factura.id])
      await c.query("update opticas set datos_bancarios = null where slug = $1", [SLUG_PRUEBAS])
    })
  }
})
