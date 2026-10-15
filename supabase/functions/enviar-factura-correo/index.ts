// Envía por correo la factura electrónica al paciente, con el RIDE (PDF) y el XML adjuntos (Resend).
// APAGADA hasta que la óptica tenga su dominio propio verificado en Resend: sin RESEND_API_KEY y FACTURAS_CORREO_DESDE responde 503 y la pantalla
// ya muestra el botón desactivado. Solo con Ventas "editar" (se comprueba con la sesión de quien llama). Despliegue normal (pide sesión):
//   supabase functions deploy enviar-factura-correo
//   supabase secrets set RESEND_API_KEY=... FACTURAS_CORREO_DESDE="Tu Óptica <facturas@tudominio.com>"
import { createClient } from "npm:@supabase/supabase-js@2"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } })
const aBase64 = (bytes: Uint8Array) => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s) }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405)

  const llave = Deno.env.get("RESEND_API_KEY")
  const desde = Deno.env.get("FACTURAS_CORREO_DESDE")
  if (!llave || !desde) return json({ error: "El correo todavía no está configurado: falta el dominio propio de la óptica en Resend." }, 503)

  const autorizacion = req.headers.get("Authorization")
  if (!autorizacion) return json({ error: "Falta la sesión." }, 401)
  const url = Deno.env.get("SUPABASE_URL")!
  const sesion = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: autorizacion } }, auth: { persistSession: false } })
  const { data: puede } = await sesion.rpc("tiene_permiso", { p_modulo: "ventas", p_nivel: "editar" })
  if (!puede) return json({ error: "No tienes permiso para enviar facturas." }, 403)

  let cuerpo: { factura_id?: string } = {}
  try { cuerpo = await req.json() } catch { return json({ error: "Solicitud no válida." }, 400) }
  // Lo que ve quien llama (por sus políticas) decide de qué óptica y de qué venta se trata.
  const { data: venta } = await sesion.from("facturas_venta").select("id, paciente_id, factura_electronica").eq("id", cuerpo.factura_id).maybeSingle()
  if (!venta) return json({ error: "La venta no existe." }, 404)

  const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } })
  const { data: paciente } = await servicio.from("pacientes_base").select("nombre, correo").eq("id", venta.paciente_id).maybeSingle()
  const correo = String(paciente?.correo || "").trim()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return json({ error: "El paciente no tiene un correo válido registrado." }, 422)

  const { data: archivos } = await servicio.from("facturas_electronicas_archivos").select("tipo, ruta, subido_en").eq("factura_id", venta.id).order("subido_en", { ascending: false })
  const vigentes = ["pdf", "xml"].map((t) => (archivos || []).find((a: { tipo: string }) => a.tipo === t)).filter(Boolean) as { tipo: string; ruta: string }[]
  if (vigentes.length === 0) return json({ error: "La factura no tiene archivos adjuntos." }, 422)
  const adjuntos = []
  for (const a of vigentes) {
    const { data: blob } = await servicio.storage.from("facturas-electronicas").download(a.ruta)
    if (!blob) return json({ error: "No se pudo leer un archivo de la factura." }, 502)
    adjuntos.push({ filename: `factura-${venta.factura_electronica || "electronica"}.${a.tipo}`, content: aBase64(new Uint8Array(await blob.arrayBuffer())) })
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${llave}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: desde, to: [correo], subject: `Tu factura electrónica ${venta.factura_electronica || ""}`.trim(),
      text: `Hola${paciente?.nombre ? `, ${paciente.nombre}` : ""}. Adjuntamos tu factura electrónica (el PDF y el XML). Guárdala: la ley pide conservarla.`,
      attachments: adjuntos,
    }),
  })
  if (!respuesta.ok) return json({ error: "El servicio de correo no aceptó el envío." }, 502)
  return json({ ok: true }, 200)
})
