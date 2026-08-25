import { createClient } from '@supabase/supabase-js'

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

export const supabase = CONFIGURADO ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

// Cliente desechable, sin persistir sesión: se usa solo para dar de alta la
// cuenta de un nuevo admin (auth.signUp) sin pisar la sesión del superadmin
// que está logueado en el cliente principal de arriba.
export function crearClienteTemporal() {
  if (!CONFIGURADO) return null
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
