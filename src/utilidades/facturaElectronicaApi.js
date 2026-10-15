// Todo lo que la pantalla le pide a la base y al almacenamiento sobre la factura electrónica (migración 0110), en un solo lugar para que las pantallas
// no repitan llamadas ni mensajes de error. Cada función devuelve { error } con un texto que se puede mostrar tal cual.
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "./permisos"
import { DIAS_ENLACE_FACTURA } from "./facturaElectronica"

// La factura electrónica de una venta cambió (detail: el id de la venta): quien la muestra vuelve a leerla.
export const EVENTO_FE_CAMBIADA = "factura-electronica:cambiada"
export const BUCKET_FACTURAS = "facturas-electronicas"
// El correo se enciende cuando la óptica tenga su dominio propio verificado en Resend (ver supabase/functions/enviar-factura-correo).
export const CORREO_FACTURAS_ACTIVO = false

const mensaje = (error, respaldo) => (esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : error?.message || respaldo)

// Lo guardado de la factura electrónica de una venta: sus datos, el archivo vigente de cada tipo y lo último que se hizo con ella.
export async function leerFacturaElectronica(facturaId) {
  if (!supabase) return { datos: null, archivos: { pdf: null, xml: null }, eventos: [] }
  const [d, a, e] = await Promise.all([
    supabase.from("facturas_electronicas").select("clave_acceso, autorizada_el, registrada_por, registrada_en").eq("factura_id", facturaId).maybeSingle(),
    supabase.from("facturas_electronicas_archivos").select("id, tipo, ruta, bytes, subido_por, subido_en").eq("factura_id", facturaId).order("subido_en", { ascending: false }),
    supabase.from("facturas_electronicas_eventos").select("accion, actor_perfil, actor_paciente, detalle, creado_en").eq("factura_id", facturaId).order("creado_en", { ascending: false }).limit(30),
  ])
  // Sin la migración todavía (o sin permiso) simplemente no hay nada guardado que mostrar.
  const vigente = (tipo) => (a.data || []).find((x) => x.tipo === tipo) || null
  return {
    datos: d.data ? { claveAcceso: d.data.clave_acceso || "", autorizadaEl: d.data.autorizada_el || "", registradaPor: d.data.registrada_por } : null,
    archivos: { pdf: vigente("pdf"), xml: vigente("xml") },
    eventos: e.data || [],
  }
}

const sube = async (opticaId, facturaId, archivo, tipo) => {
  const ruta = `${opticaId}/${facturaId}/${tipo === "pdf" ? "ride" : "factura"}-${Date.now()}.${tipo}`
  const { error } = await supabase.storage.from(BUCKET_FACTURAS).upload(ruta, archivo, { contentType: tipo === "pdf" ? "application/pdf" : "application/xml", upsert: false })
  return { ruta, error }
}

// Registra (o corrige) la factura electrónica: sube los archivos nuevos al almacenamiento privado y luego guarda los datos; el servidor vuelve a validar todo.
export async function guardarFacturaElectronica({ opticaId, factura, numero, clave = "", autorizada = "", pdf = null, xml = null }) {
  if (!supabase) return { error: null }
  const subidos = {}
  for (const [tipo, archivo] of [["pdf", pdf], ["xml", xml]]) {
    if (!archivo) continue
    const { ruta, error } = await sube(opticaId, factura.id, archivo, tipo)
    if (error) return { error: esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : `No se pudo subir el ${tipo === "pdf" ? "PDF" : "XML"}. Revisa tu conexión e intenta de nuevo.` }
    subidos[tipo] = { ruta, bytes: archivo.size }
  }
  const { error } = await supabase.rpc("guardar_factura_electronica", {
    p_factura_id: factura.id, p_numero: numero, p_clave: clave || null, p_autorizada: autorizada || null,
    p_pdf_ruta: subidos.pdf?.ruta || null, p_pdf_bytes: subidos.pdf?.bytes || null, p_xml_ruta: subidos.xml?.ruta || null, p_xml_bytes: subidos.xml?.bytes || null,
  })
  return { error: error ? mensaje(error, "No se pudo guardar la factura electrónica. Revisa tu conexión e intenta de nuevo.") : null }
}

// Una URL firmada de un minuto para descargar un archivo (el personal con Ventas "ver" la pide con su sesión).
export async function urlDeDescarga(ruta, nombre, { descargar = true } = {}) {
  if (!supabase) return { url: null, error: "Sin conexión." }
  const { data, error } = await supabase.storage.from(BUCKET_FACTURAS).createSignedUrl(ruta, 60, descargar ? { download: nombre } : undefined)
  return { url: data?.signedUrl || null, error: error ? "No se pudo preparar la descarga. Revisa tu conexión e intenta de nuevo." : null }
}

export async function registrarEvento(facturaId, accion, detalle = null) {
  if (!supabase) return
  await supabase.rpc("registrar_evento_factura_electronica", { p_factura_id: facturaId, p_accion: accion, p_detalle: detalle })
}

// Los enlaces de descarga (uno por tipo de archivo), con su código; vencen a los 7 días.
export async function crearEnlaces(facturaId, dias = DIAS_ENLACE_FACTURA) {
  if (!supabase) return { enlaces: [], error: "Sin conexión." }
  const { data, error } = await supabase.rpc("crear_enlaces_factura", { p_factura_id: facturaId, p_dias: dias })
  return { enlaces: (data || []).map((e) => ({ tipo: e.tipo, url: urlDeEnlace(e.token), expiraEn: e.expira_en })), error: error ? mensaje(error, "No se pudo crear el enlace. Revisa tu conexión e intenta de nuevo.") : null }
}
export const urlDeEnlace = (token) => `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/entregar-factura?t=${token}`

export async function revocarEnlaces(facturaId) {
  if (!supabase) return { error: null }
  const { error } = await supabase.rpc("revocar_enlaces_factura", { p_factura_id: facturaId })
  return { error: error ? mensaje(error, "No se pudieron cancelar los enlaces.") : null }
}

export async function enviarPorCorreo(facturaId) {
  if (!supabase) return { error: "Sin conexión." }
  const { data, error } = await supabase.functions.invoke("enviar-factura-correo", { body: { factura_id: facturaId } })
  if (!error) return { error: data?.error || null }
  let texto = ""
  try { texto = (await error.context.json())?.error } catch { /* sin cuerpo */ }
  return { error: texto || "No se pudo enviar el correo." }
}

// El portal del paciente: sus compras y la descarga de sus facturas (la Edge Function valida su sesión).
export async function misCompras(pacienteId, token) {
  if (!supabase) return { compras: [], error: null }
  const { data, error } = await supabase.rpc("mis_compras_paciente", { p_paciente_id: pacienteId, p_token: token })
  return { compras: Array.isArray(data) ? data : [], error: error ? "No se pudieron cargar tus compras. Revisa tu conexión e intenta de nuevo." : null }
}
export async function urlDeDescargaPaciente({ pacienteId, token, facturaId, tipo }) {
  if (!supabase) return { url: null, error: "Sin conexión." }
  const { data, error } = await supabase.functions.invoke("entregar-factura", { body: { paciente_id: pacienteId, token, factura_id: facturaId, tipo } })
  let texto = data?.error || ""
  if (error) { try { texto = (await error.context.json())?.error } catch { /* sin cuerpo */ } }
  return { url: data?.url || null, error: data?.url ? null : texto || "No se pudo preparar la descarga. Inténtalo de nuevo." }
}
