// Punto 02 del Diagnóstico Maestro: eliminar un usuario desde
// SuperadminPanel.jsx (quitar administrador / quitar superadmin) borraba
// solo la fila de `perfiles` — la cuenta de Supabase Auth (auth.users)
// quedaba huérfana para siempre, porque eso requiere la service role key,
// que el cliente (navegador) nunca debe tener. Esta función corre en el
// servidor de Supabase (Edge Function), con esa key inyectada solo ahí.
//
// Extensión 2026-09-10: Usuarios.jsx (un admin de óptica eliminando a su
// propio asistente) tenía el mismo cabo suelto — seguía generando cuentas
// huérfanas porque nunca pasaba por esta función. Decisión de Diego: un
// admin de óptica SÍ puede usar esta función, pero solo para borrar
// asistentes de SU MISMA óptica — nunca a otro admin, nunca a un asistente
// de otra óptica, nunca a sí mismo. El superadmin conserva su acceso sin
// esa restricción, tal como ya estaba.
//
// Verifica la identidad de quien llama con su propio JWT (cliente con la
// anon key) ANTES de usar la service role — la service role nunca decide
// permisos, sólo ejecuta después de que el chequeo de rol ya aprobó. Para
// el caso admin-de-óptica, el perfil OBJETIVO también se lee con service
// role (no con lo que mande el request) para comparar contra datos reales
// de la base, no contra algo que el cliente podría falsificar.
import { createClient } from "npm:@supabase/supabase-js@2"

// Bug real encontrado 2026-09-10 al conectar Usuarios.jsx a esta función:
// nunca respondía al preflight CORS (OPTIONS) — el navegador lo bloqueaba
// ANTES de mandar el POST real, así que ninguna llamada desde un navegador
// llegaba jamás a ejecutar el resto de esta función. `corsHeaders` va en
// TODAS las respuestas (no solo la de OPTIONS) porque el navegador también
// necesita permiso para LEER la respuesta del POST real, no solo para
// enviarlo.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const jsonResponse = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders })
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405)
  }

  const authHeader = req.headers.get("Authorization")
  if (!authHeader) {
    return jsonResponse({ error: "Falta la sesión." }, 401)
  }

  const { perfilId } = await req.json().catch(() => ({}))
  if (!perfilId || typeof perfilId !== "string") {
    return jsonResponse({ error: "Falta perfilId." }, 400)
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

  // Cliente "como quien llama" — solo para confirmar que de verdad es quien
  // dice ser, con las mismas reglas de RLS que ya protegen `perfiles`.
  const clienteLlamador = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: errorUsuario } = await clienteLlamador.auth.getUser()
  if (errorUsuario || !user) {
    return jsonResponse({ error: "Sesión inválida." }, 401)
  }
  const { data: perfilLlamador, error: errorPerfilLlamador } = await clienteLlamador
    .from("perfiles")
    .select("rol, optica_id")
    .eq("id", user.id)
    .single()
  if (errorPerfilLlamador || !perfilLlamador) {
    return jsonResponse({ error: "Sesión inválida." }, 401)
  }

  const esSuperadmin = perfilLlamador.rol === "superadmin"
  const esAdminOptica = perfilLlamador.rol === "admin"
  if (!esSuperadmin && !esAdminOptica) {
    return jsonResponse({ error: "No tienes permiso para eliminar cuentas." }, 403)
  }

  // A partir de acá sí con service role: borra el perfil y, recién si eso
  // funciona, la cuenta de Auth — en ese orden para no dejar un perfil
  // huérfano si el borrado de Auth fallara primero.
  const clienteServicio = createClient(supabaseUrl, serviceRoleKey)

  if (esAdminOptica) {
    if (perfilId === user.id) {
      return jsonResponse({ error: "No puedes eliminar tu propia cuenta desde aquí." }, 403)
    }
    const { data: perfilObjetivo, error: errorObjetivo } = await clienteServicio
      .from("perfiles")
      .select("rol, optica_id")
      .eq("id", perfilId)
      .single()
    if (errorObjetivo || !perfilObjetivo) {
      return jsonResponse({ error: "La cuenta que intentas eliminar no existe." }, 404)
    }
    if (perfilObjetivo.rol !== "asistente" || perfilObjetivo.optica_id !== perfilLlamador.optica_id) {
      return jsonResponse({ error: "Solo puedes eliminar asistentes de tu propia óptica." }, 403)
    }
  }

  const { error: errorPerfil } = await clienteServicio.from("perfiles").delete().eq("id", perfilId)
  if (errorPerfil) {
    return jsonResponse({ error: errorPerfil.message }, 500)
  }

  const { error: errorAuth } = await clienteServicio.auth.admin.deleteUser(perfilId)
  if (errorAuth) {
    // El perfil ya se borró — la cuenta de Auth queda huérfana igual que
    // antes de este arreglo, pero se avisa explícitamente en vez de fallar
    // en silencio, para que quien lo disparó sepa que puede repetirlo o
    // pedir soporte si el correo no vuelve a poder usarse.
    return jsonResponse({ error: "El perfil se eliminó, pero la cuenta de acceso no pudo borrarse: " + errorAuth.message }, 500)
  }

  return jsonResponse({ ok: true }, 200)
})
