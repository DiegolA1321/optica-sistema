// Entrega de la factura electrónica (RIDE en PDF y XML) guardada en el almacenamiento PRIVADO `facturas-electronicas`.
// Nadie baja un archivo de ese bucket directamente salvo el personal con Ventas "ver" (por sus políticas): el paciente y quien recibe un enlace
// pasan por esta función, que valida primero y solo entonces pide a Storage una URL firmada de pocos minutos.
//
//   GET  ?t=<código>   El enlace seguro que se manda por WhatsApp. Si el código existe, no venció y no se revocó, redirige al archivo.
//   POST { paciente_id, token, factura_id, tipo }   El portal del paciente ("Mis compras"): responde { url }.
//
// Las funciones de la base que validan (resolver_enlace_descarga y autorizar_descarga_paciente) solo las puede llamar la clave de servicio:
// aquí se usa, pero la decisión de si se entrega o no la toman ellas, no esta función. Cada uso queda registrado en la base.
// Despliegue (el enlace es público, sin sesión): supabase functions deploy entregar-factura --no-verify-jwt
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
}
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const pagina = (titulo: string, texto: string, status: number) =>
  new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo}</title>
<body style="font-family:system-ui,sans-serif;max-width:32rem;margin:15vh auto;padding:0 1.5rem;color:#0E2B33"><h1 style="font-size:1.25rem">${titulo}</h1><p style="color:#475569">${texto}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } })

const nombreArchivo = (numero: string | null, tipo: string) => `factura-${numero || "electronica"}.${tipo}`

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  const servicio = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })

  if (req.method === "GET") {
    const codigo = new URL(req.url).searchParams.get("t") || ""
    const { data } = await servicio.rpc("resolver_enlace_descarga", { p_token: codigo })
    const fila = Array.isArray(data) ? data[0] : null
    if (!fila) return pagina("Este enlace ya no está disponible", "Venció o fue cancelado. Pídele a tu óptica que te envíe uno nuevo.", 410)
    const { data: firmada, error } = await servicio.storage.from("facturas-electronicas").createSignedUrl(fila.ruta, 300, { download: nombreArchivo(fila.numero, fila.tipo) })
    if (error || !firmada?.signedUrl) return pagina("No se pudo abrir el archivo", "Inténtalo de nuevo en un momento.", 502)
    return new Response(null, { status: 302, headers: { Location: firmada.signedUrl, "Cache-Control": "no-store" } })
  }

  if (req.method === "POST") {
    let cuerpo: { paciente_id?: string; token?: string; factura_id?: string; tipo?: string } = {}
    try { cuerpo = await req.json() } catch { return json({ error: "Solicitud no válida." }, 400) }
    const { data } = await servicio.rpc("autorizar_descarga_paciente", { p_paciente_id: cuerpo.paciente_id, p_token: cuerpo.token, p_factura_id: cuerpo.factura_id, p_tipo: cuerpo.tipo })
    const fila = Array.isArray(data) ? data[0] : null
    if (!fila) return json({ error: "No se encontró ese archivo en tus compras." }, 404)
    const { data: firmada, error } = await servicio.storage.from("facturas-electronicas").createSignedUrl(fila.ruta, 120, { download: nombreArchivo(fila.numero, String(cuerpo.tipo)) })
    if (error || !firmada?.signedUrl) return json({ error: "No se pudo preparar la descarga." }, 502)
    return json({ url: firmada.signedUrl }, 200)
  }

  return json({ error: "Método no permitido." }, 405)
})
