import { createClient } from '@supabase/supabase-js'
import { esLlamadaAnonima, EVENTO_SESION_PERDIDA } from '../utilidades/sesionPestanas'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Mientras no exista .env.local (ver .env.local.example), estas variables
// vienen undefined. createClient() explota si le falta alguna, y como este
// módulo lo importan Login.jsx y App.jsx sin condicional, eso tumbaría toda
// la app (incluido el login de asistente/paciente, que no depende de esto).
// Por eso el cliente queda en null hasta que la configuración exista, en vez
// de dejar que createClient lance el error al cargar el módulo.
const CONFIGURADO = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

if (!CONFIGURADO && import.meta.env.DEV) {
  console.warn('[supabaseClient] Faltan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY en .env.local — login de superadmin/admin deshabilitado hasta configurarlo.')
}

// ¿Había una sesión guardada en este navegador al abrir la página? Se lee antes de crear el cliente, que puede borrarla si ya no sirve.
export const habiaSesionGuardada = (() => {
  try { return Object.keys(window.localStorage).some((k) => /^sb-.+-auth-token$/.test(k)) } catch { return false }
})()

// Mientras la pantalla muestra a alguien con sesión (personal o superadmin), una llamada a la base sin su sesión significa que
// la sesión se perdió (por ejemplo, se cerró desde otra pestaña): se avisa a la aplicación para que lo diga y lleve al ingreso,
// en lugar de dejar la pantalla "dentro" y mostrar errores de permisos en inglés.
let sesionEsperada = false
export function marcarSesionEsperada(valor) { sesionEsperada = !!valor }

async function fetchQueAvisaSiSeCaeLaSesion(input, init) {
  const respuesta = await fetch(input, init)
  if (sesionEsperada) {
    try {
      const url = typeof input === 'string' ? input : input?.url || String(input)
      if (url.includes('/rest/v1/')) {
        const autorizacion = new Headers(init?.headers || input?.headers).get('authorization')
        if (respuesta.status === 401 || esLlamadaAnonima(autorizacion, SUPABASE_ANON_KEY)) window.dispatchEvent(new Event(EVENTO_SESION_PERDIDA))
      }
    } catch { /* el aviso es un extra: nunca debe romper la llamada */ }
  }
  return respuesta
}

export const supabase = CONFIGURADO ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { fetch: fetchQueAvisaSiSeCaeLaSesion } }) : null

// Cliente para lecturas públicas (sin sesión): jamás adjunta el token guardado en el navegador. Si ese token está
// vencido o revocado, PostgREST responde 401 (PGRST301) incluso en una vista pública (opticas_publicas); sin sesión
// la lectura responde 200 siempre. Se crea una sola vez, la primera vez que se pide.
let clientePublico
export function obtenerClientePublico() {
  if (!CONFIGURADO) return null
  if (!clientePublico) clientePublico = crearClienteTemporal()
  return clientePublico
}

// Cliente desechable, sin persistir sesión: se usa solo para dar de alta la
// cuenta de un nuevo admin (auth.signUp) sin pisar la sesión del superadmin
// que está logueado en el cliente principal de arriba.
export function crearClienteTemporal() {
  if (!CONFIGURADO) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'sb-sin-sesion' },
  })
}
