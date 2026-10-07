// Comprueba que la BASE (no solo la pantalla) rechaza lo que el rol no puede hacer.
// Usa actualizaciones "sin cambio" (se escribe el mismo valor) para no alterar datos si el permiso existiera.
// Se actualiza la tabla citas_base y no la vista citas: el disparador INSTEAD OF de la vista devuelve la fila aunque la base no la haya escrito (falso positivo).
// Con RLS, una actualización no permitida devuelve 0 filas; una permitida devuelve la fila.
import { test, expect } from '@playwright/test'
import { credencial } from './ayudas.js'

const URL = process.env.VITE_SUPABASE_URL
const ANON = process.env.VITE_SUPABASE_ANON_KEY

async function sesion(prefijo) {
  const { correo, clave } = credencial(prefijo)
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: correo, password: clave }) })
  if (!r.ok) throw new Error(`No se pudo iniciar sesión (${prefijo}): ${r.status}`)
  const { access_token } = await r.json()
  const h = { apikey: ANON, Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' }
  return {
    leer: async (tabla, query) => (await fetch(`${URL}/rest/v1/${tabla}?${query}`, { headers: h })).json(),
    sinCambio: async (tabla, id, campo, valor) => {
      const r = await fetch(`${URL}/rest/v1/${tabla}?id=eq.${id}`, { method: 'PATCH', headers: h, body: JSON.stringify({ [campo]: valor }) })
      const cuerpo = await r.json().catch(() => [])
      return Array.isArray(cuerpo) ? cuerpo.length : -1
    },
  }
}

test.skip(!URL || !ANON, 'Falta VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (usa --env-file=.env.local o variables de entorno)')

test('Ventas: no edita citas; sí edita inventario', async () => {
  const s = await sesion('VENTAS')
  const [cita] = await s.leer('citas', 'select=id,estado&limit=1')
  const [prod] = await s.leer('inventario', 'select=id,nombre&limit=1')
  expect.soft(await s.sinCambio('citas_base', cita.id, 'estado', cita.estado), 'Ventas NO debe poder editar citas').toBe(0)
  expect.soft(await s.sinCambio('inventario', prod.id, 'nombre', prod.nombre), 'Ventas SÍ edita inventario').toBe(1)
})

test('Recepción: edita citas; no edita inventario', async () => {
  const s = await sesion('RECEPCION')
  const [cita] = await s.leer('citas', 'select=id,estado&limit=1')
  const [prod] = await s.leer('inventario', 'select=id,nombre&limit=1')
  expect.soft(await s.sinCambio('citas_base', cita.id, 'estado', cita.estado), 'Recepción SÍ edita citas').toBe(1)
  expect.soft(await s.sinCambio('inventario', prod.id, 'nombre', prod.nombre), 'Recepción NO debe poder editar inventario').toBe(0)
})

test('Optómetra: no edita inventario; ve solo sus citas', async () => {
  const s = await sesion('OPTOMETRA')
  const [prod] = await s.leer('inventario', 'select=id,nombre&limit=1')
  expect.soft(await s.sinCambio('inventario', prod.id, 'nombre', prod.nombre), 'Optómetra NO debe poder editar inventario').toBe(0)
  const citas = await s.leer('citas', 'select=id,asignado_a,atendido_por')
  expect.soft(citas.length, 'alcance propio: menos de las 90 citas de la Demo').toBeLessThan(90)
  expect.soft(citas.length).toBeGreaterThan(0)
})
