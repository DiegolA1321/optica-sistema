// Todo lo que Soporte le pide a la base y al almacenamiento (migración 0115), en un solo lugar para que las pantallas no repitan llamadas ni mensajes de error.
// Cada función devuelve { error } con un texto que se puede mostrar tal cual, o { datos }.
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "./permisos"
import { avisosConLeido, mapConsulta, mapMensajeSoporte, nombreSeguro } from "./soporte"

export const BUCKET_SOPORTE = "soporte-adjuntos"
// Algo cambió en Soporte (consulta creada, respuesta leída, avisos leídos): la campanita y las listas se vuelven a leer.
export const EVENTO_SOPORTE_CAMBIADO = "soporte:cambiado"
export const avisarCambioSoporte = () => { try { window.dispatchEvent(new Event(EVENTO_SOPORTE_CAMBIADO)) } catch { /* sin ventana (pruebas) */ } }

const nuevoId = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-0000-0000-000000000000`.slice(0, 36))
const texto = (error, respaldo) => (esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : error?.message || respaldo)
const SIN_BASE = { error: "No hay conexión con el servidor." }

// ── Óptica ──
// Las consultas que esta persona puede ver (las suyas; todas las de su óptica si es administrador). La base ya lo filtra.
export async function leerMisConsultas(opticaId = null) {
  if (!supabase) return { ...SIN_BASE, datos: [] }
  // La base ya entrega solo lo de cada persona; el filtro por óptica es para quien entra como una óptica siendo superadmin (que podría leer todas).
  let q = supabase.from("soporte_consultas").select("*").order("actualizada_en", { ascending: false }).limit(300)
  if (opticaId) q = q.eq("optica_id", opticaId)
  const { data, error } = await q
  if (error) return { error: texto(error, "No se pudieron cargar tus consultas."), datos: [] }
  return { datos: (data || []).map(mapConsulta) }
}

// Los mensajes de una consulta (la base no entrega las notas internas a la óptica).
export async function leerConversacion(consultaId) {
  if (!supabase) return { ...SIN_BASE, datos: [] }
  const { data, error } = await supabase.from("soporte_mensajes").select("*").eq("consulta_id", consultaId).order("creado_en", { ascending: true })
  if (error) return { error: texto(error, "No se pudo cargar la conversación."), datos: [] }
  return { datos: (data || []).map(mapMensajeSoporte) }
}

// Sube las capturas a la carpeta {óptica}/{consulta}/ y devuelve lo que la función de la base espera.
export async function subirCapturas({ opticaId, consultaId, archivos, interno = false }) {
  const subidos = []
  for (const archivo of archivos) {
    const ruta = `${opticaId}/${consultaId}/${interno ? "interno/" : ""}${nuevoId().slice(0, 8)}-${nombreSeguro(archivo.name)}`
    const { error } = await supabase.storage.from(BUCKET_SOPORTE).upload(ruta, archivo, { contentType: archivo.type, upsert: false })
    if (error) return { error: esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : `No se pudo subir «${archivo.name}». Revisa tu conexión e intenta de nuevo.` }
    subidos.push({ ruta, nombre: archivo.name })
  }
  return { datos: subidos }
}

export async function crearConsulta({ opticaId, modulo, tipo, urgencia, asunto, descripcion, contexto, archivos = [] }) {
  if (!supabase) return SIN_BASE
  const id = nuevoId()
  const adj = await subirCapturas({ opticaId, consultaId: id, archivos })
  if (adj.error) return adj
  const { data, error } = await supabase.rpc("crear_consulta_soporte", {
    p_id: id, p_modulo: modulo, p_tipo: tipo, p_urgencia: urgencia, p_asunto: asunto, p_descripcion: descripcion, p_contexto: contexto, p_adjuntos: adj.datos,
  })
  if (error) return { error: texto(error, "No se pudo enviar la consulta.") }
  const fila = Array.isArray(data) ? data[0] : data
  avisarCambioSoporte()
  return { datos: { id: fila?.id || id, numero: fila?.numero } }
}

export async function responderConsulta({ opticaId, consultaId, cuerpo, archivos = [] }) {
  if (!supabase) return SIN_BASE
  const adj = await subirCapturas({ opticaId, consultaId, archivos })
  if (adj.error) return adj
  const { error } = await supabase.rpc("responder_consulta_soporte", { p_consulta: consultaId, p_cuerpo: cuerpo, p_adjuntos: adj.datos })
  if (error) return { error: texto(error, "No se pudo enviar tu mensaje.") }
  avisarCambioSoporte()
  return { datos: true }
}

const llamar = async (rpc, args, respaldo) => {
  if (!supabase) return SIN_BASE
  const { error } = await supabase.rpc(rpc, args)
  if (error) return { error: texto(error, respaldo) }
  avisarCambioSoporte()
  return { datos: true }
}
export const cerrarConsulta = (consultaId) => llamar("cerrar_consulta_soporte", { p_consulta: consultaId }, "No se pudo marcar como resuelta.")
export const reabrirConsulta = (consultaId, motivo) => llamar("reabrir_consulta_soporte", { p_consulta: consultaId, p_motivo: motivo }, "No se pudo reabrir la consulta.")
export const calificarConsulta = (consultaId, nota, comentario) => llamar("calificar_consulta_soporte", { p_consulta: consultaId, p_nota: nota, p_comentario: comentario || null }, "No se pudo guardar tu calificación.")
export const marcarConsultaLeida = (consultaId) => llamar("marcar_consulta_soporte_leida", { p_consulta: consultaId }, "")

// Avisos del sistema + cuáles ya leyó esta persona.
export async function leerAvisos(perfilId) {
  if (!supabase) return { ...SIN_BASE, datos: [] }
  const [m, l] = await Promise.all([
    supabase.from("mensajes").select("id, tipo, asunto, cuerpo, created_at, optica_id").eq("tipo", "anuncio").order("created_at", { ascending: false }).limit(100),
    supabase.from("avisos_leidos").select("mensaje_id").eq("perfil_id", perfilId),
  ])
  if (m.error) return { error: texto(m.error, "No se pudieron cargar los avisos."), datos: [] }
  return { datos: avisosConLeido(m.data || [], (l.data || []).map((x) => x.mensaje_id)) }
}
export const marcarAvisosLeidos = (ids = null) => llamar("marcar_avisos_leidos", { p_mensajes: ids }, "No se pudieron marcar los avisos.")

// Una dirección temporal (5 min) para ver una captura: el almacenamiento es privado.
export async function urlDeCaptura(ruta) {
  if (!supabase) return ""
  const { data } = await supabase.storage.from(BUCKET_SOPORTE).createSignedUrl(ruta, 300)
  return data?.signedUrl || ""
}

// Lo de la campanita: respuestas sin leer (de sus consultas) y avisos nuevos.
export async function leerResumenSoporte(perfilId) {
  if (!supabase || !perfilId) return { respuestas: [], avisosSinLeer: 0 }
  const [r, a] = await Promise.all([
    supabase.from("soporte_consultas").select("id, numero, asunto, estado").eq("autor_id", perfilId).eq("respuesta_sin_leer", true).order("actualizada_en", { ascending: false }).limit(20),
    leerAvisos(perfilId),
  ])
  return { respuestas: r.data || [], avisosSinLeer: (a.datos || []).filter((x) => !x.leido).length }
}

// ── Superadmin ──
export async function leerTodasLasConsultas() {
  if (!supabase) return { ...SIN_BASE, datos: [] }
  const { data, error } = await supabase.from("soporte_consultas").select("*").order("creada_en", { ascending: false }).limit(1000)
  if (error) return { error: texto(error, "No se pudieron cargar las consultas."), datos: [] }
  return { datos: (data || []).map(mapConsulta) }
}

// Conversación completa, con las notas internas (solo el superadmin las recibe).
export async function leerConversacionSoporte(consultaId) {
  return leerConversacion(consultaId)
}

export async function responderSoporte({ opticaId, consultaId, cuerpo, interna = false, estado = null, archivos = [] }) {
  if (!supabase) return SIN_BASE
  const adj = await subirCapturas({ opticaId, consultaId, archivos, interno: interna })
  if (adj.error) return adj
  const { error } = await supabase.rpc("soporte_responder", { p_consulta: consultaId, p_cuerpo: cuerpo, p_interna: interna, p_estado: estado, p_adjuntos: adj.datos })
  if (error) return { error: texto(error, "No se pudo enviar la respuesta.") }
  avisarCambioSoporte()
  return { datos: true }
}
export const cambiarEstadoSoporte = (consultaId, estado) => llamar("soporte_cambiar_estado", { p_consulta: consultaId, p_estado: estado }, "No se pudo cambiar el estado.")

export async function leerRespuestasGuardadas() {
  if (!supabase) return { ...SIN_BASE, datos: [] }
  const { data, error } = await supabase.from("soporte_respuestas_guardadas").select("id, titulo, texto").order("titulo")
  if (error) return { error: texto(error, "No se pudieron cargar las respuestas guardadas."), datos: [] }
  return { datos: data || [] }
}
export async function guardarRespuestaGuardada({ id, titulo, texto: cuerpo }) {
  if (!supabase) return SIN_BASE
  const q = id ? supabase.from("soporte_respuestas_guardadas").update({ titulo, texto: cuerpo }).eq("id", id) : supabase.from("soporte_respuestas_guardadas").insert({ titulo, texto: cuerpo })
  const { error } = await q
  return error ? { error: texto(error, "No se pudo guardar la respuesta.") } : { datos: true }
}
export async function borrarRespuestaGuardada(id) {
  if (!supabase) return SIN_BASE
  const { error } = await supabase.from("soporte_respuestas_guardadas").delete().eq("id", id)
  return error ? { error: texto(error, "No se pudo borrar la respuesta.") } : { datos: true }
}

// Los tiempos de respuesta que se le dicen al usuario (los configura el superadmin).
export async function leerAjustesSoporte() {
  if (!supabase) return { datos: {} }
  const { data } = await supabase.from("soporte_ajustes").select("clave, valor")
  return { datos: Object.fromEntries((data || []).map((r) => [r.clave, r.valor])) }
}
export async function guardarAjustesSoporte(ajustes) {
  if (!supabase) return SIN_BASE
  for (const [clave, valor] of Object.entries(ajustes)) {
    const { error } = await supabase.from("soporte_ajustes").update({ valor: valor.trim(), actualizado_en: new Date().toISOString() }).eq("clave", clave)
    if (error) return { error: texto(error, "No se pudieron guardar los tiempos.") }
  }
  return { datos: true }
}
