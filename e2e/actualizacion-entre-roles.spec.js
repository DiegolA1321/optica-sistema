// Dos sesiones a la vez en la Óptica Demo: el administrador cambia un producto y Paula (optómetra) lo ve
// actualizado sin cerrar sesión ni recargar (el inventario se refresca cada 20 s y al volver a la pestaña,
// igual que las citas). Al final el producto vuelve siempre a su valor original.
import { test, expect } from '@playwright/test'
import { credencial, iniciarSesion } from './ayudas.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY
test.skip(!URL || !ANON, 'Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY')

async function sesionApi(prefijo) {
  const { correo, clave } = credencial(prefijo)
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: clave }) })
  if (!r.ok) throw new Error(`No se pudo iniciar sesión por API (${prefijo}): ${r.status}`)
  const { access_token } = await r.json()
  const h = { apikey: ANON, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  return {
    // Los productos de la Demo comparten fecha de creación: se ordena por nombre para que "el primero" sea siempre el mismo.
    primerProducto: async () => (await (await fetch(`${URL}/rest/v1/inventario?select=id,nombre,precio,stock&activo=eq.true&order=nombre.asc&limit=1`, { headers: h })).json())[0],
    producto: async (id) => (await (await fetch(`${URL}/rest/v1/inventario?select=id,nombre,precio,stock&id=eq.${id}`, { headers: h })).json())[0],
    cambiar: async (id, cambios) => {
      const r2 = await fetch(`${URL}/rest/v1/inventario?id=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify(cambios) })
      const filas = await r2.json()
      if (!Array.isArray(filas) || filas.length !== 1) throw new Error('El administrador no pudo cambiar el producto')
    },
  }
}

test('el cambio de precio y cantidad del administrador le llega a Paula sin cerrar sesión', async ({ browser }) => {
  test.setTimeout(120_000)
  const admin = await sesionApi('ADMIN')
  const original = await admin.primerProducto()
  const precioNuevo = Number(original.precio) + 7.77
  const stockNuevo = Number(original.stock) + 11

  const contexto = await browser.newContext()
  const paula = await contexto.newPage()
  try {
    await iniciarSesion(paula, 'OPTOMETRA')
    await paula.getByRole('button', { name: 'Inventario', exact: true }).first().click()
    const fila = paula.getByRole('row').filter({ hasText: original.nombre }).first()
    await expect(fila).toContainText(Number(original.precio).toFixed(2), { timeout: 20_000 })

    await admin.cambiar(original.id, { precio: precioNuevo, stock: stockNuevo })

    // Sin recargar ni tocar nada: el refresco automático (20 s) debe traer el cambio.
    await expect(fila).toContainText(precioNuevo.toFixed(2), { timeout: 40_000 })
    await expect(fila).toContainText(String(stockNuevo))
  } finally {
    await admin.cambiar(original.id, { precio: Number(original.precio), stock: Number(original.stock) })
    await contexto.close()
  }
  const restaurado = await admin.producto(original.id)
  expect(Number(restaurado.precio)).toBe(Number(original.precio))
  expect(Number(restaurado.stock)).toBe(Number(original.stock))
})
