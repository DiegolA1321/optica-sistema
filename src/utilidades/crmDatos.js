// Los datos del CRM v2: contactos, campañas y plantillas de la óptica, y las acciones que los escriben (todas por funciones del servidor,
// que ponen ellas mismas quién y cuándo y rechazan lo que el paciente no permitió). Las pantallas solo llaman a estas acciones.
import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { GRUPOS_CAMPANA, MOTIVO_PROMOCION } from "./crmContactos"

// Cuántos contactos se traen (los más recientes). El descanso más largo de un motivo es de 180 días: con esto sobra para decidir quién aparece.
export const MAX_CONTACTOS = 1000

export const mapContacto = (r) => ({
  id: r.id, pacienteId: r.paciente_id, motivo: r.motivo, canal: r.canal, mensaje: r.mensaje || "", campanaId: r.campana_id || null,
  resultado: r.resultado || null, volverEl: r.volver_el || null, resultadoEn: r.resultado_en || null, resultadoPorNombre: r.resultado_por_nombre || "",
  creadoPor: r.creado_por || null, creadoPorNombre: r.creado_por_nombre || "", creadoEn: r.creado_en,
})
export const mapCampana = (r) => ({ id: r.id, nombre: r.nombre, grupo: r.grupo, mensaje: r.mensaje, creadaPorNombre: r.creada_por_nombre || "", creadaEn: r.creada_en })
export const plantillasDeFilas = (filas) => Object.fromEntries((Array.isArray(filas) ? filas : []).map((f) => [f.motivo, f.texto]))

// El motivo de un contacto de campaña sale del grupo (igual que en el servidor).
export const motivoDeCampana = (grupo) => GRUPOS_CAMPANA[grupo]?.motivo || MOTIVO_PROMOCION

const TEXTO_RED = "No se pudo completar la acción. Revisa tu conexión e intenta de nuevo."
// El servidor explica en español lo que rechaza; si el error es otro (red, permisos de tabla), un mensaje general.
const textoDeError = (error) => (error?.message && !/fetch|network|JWT|permission denied|violates|relation/i.test(error.message) ? error.message : TEXTO_RED)

let contadorLocal = 0
const idLocal = () => `local-${Date.now()}-${++contadorLocal}`

// habilitado: quien no puede ver el CRM no trae nada (la base tampoco le devolvería filas).
export function useCrmDatos({ usuario, alCambiarPermisos, habilitado = true }) {
  const opticaId = usuario?.opticaId
  const conBase = Boolean(supabase && opticaId && habilitado)
  const [datos, setDatos] = useState({ contactos: [], campanas: [], plantillas: {} })
  const [cargando, setCargando] = useState(conBase)
  const [error, setError] = useState("")
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])

  const cargar = useCallback(async () => {
    if (!conBase) { setCargando(false); return }
    setCargando(true)
    setError("")
    const [c, k] = await Promise.all([
      supabase.from("crm_contactos").select("*").eq("optica_id", opticaId).order("creado_en", { ascending: false }).limit(MAX_CONTACTOS),
      supabase.from("crm_campanas").select("*").eq("optica_id", opticaId).order("creada_en", { ascending: false }),
    ])
    if (!vivo.current) return
    if (c.error || k.error) setError("No se pudo cargar el CRM. Revisa tu conexión e intenta de nuevo.")
    else setDatos((d) => ({ ...d, contactos: (c.data || []).map(mapContacto), campanas: (k.data || []).map(mapCampana) }))
    setCargando(false)
  }, [conBase, opticaId])
  useEffect(() => { cargar() }, [cargar])

  // Los textos de las plantillas los lee todo el personal (los avisos de Inicio, Citas, Pacientes y Ventas escriben con ellas aunque la persona no vea el CRM): por la función del
  // servidor, que entrega solo los textos. Si falla, los avisos usan el mensaje base (no se rompe nada). Se vuelve a pedir al guardar una plantilla.
  const cargarPlantillas = useCallback(async () => {
    if (!supabase || !opticaId) return
    let { data, error: e } = await supabase.rpc("plantillas_de_avisos")
    // Sin la función (o si falla), quien ve el CRM las lee de su tabla; quien no, usa el mensaje base.
    if (e) ({ data, error: e } = await supabase.from("crm_plantillas").select("motivo, texto").eq("optica_id", opticaId))
    if (vivo.current && !e) setDatos((d) => ({ ...d, plantillas: plantillasDeFilas(data) }))
  }, [opticaId])
  useEffect(() => { cargarPlantillas() }, [cargarPlantillas])

  // Cada acción devuelve { ok, error?, id? } para que la pantalla avise con palabras del usuario.
  const contactar = useCallback(async ({ paciente, motivo, canal = "whatsapp", mensaje = "", campanaId = null, resultado = null, volverEl = null }) => {
    let id = idLocal()
    if (conBase) {
      const { data, error: e } = await supabase.rpc("registrar_contacto_crm", {
        p_paciente_id: paciente.id, p_motivo: motivo, p_canal: canal, p_mensaje: mensaje || null, p_campana_id: campanaId, p_resultado: resultado, p_volver_el: volverEl,
      })
      if (e || !data) return { ok: false, error: textoDeError(e) }
      id = data
    }
    const campana = campanaId ? datos.campanas.find((x) => x.id === campanaId) : null
    const nuevo = {
      id, pacienteId: paciente.id, motivo: campana ? motivoDeCampana(campana.grupo) : motivo, canal, mensaje, campanaId, resultado, volverEl,
      resultadoEn: resultado ? new Date().toISOString() : null, resultadoPorNombre: resultado ? usuario?.nombre || "" : "", creadoPor: usuario?.id || null, creadoPorNombre: usuario?.nombre || "", creadoEn: new Date().toISOString(),
    }
    setDatos((d) => ({ ...d, contactos: [nuevo, ...d.contactos] }))
    if (resultado === "no_desea_mensajes") alCambiarPermisos?.(paciente.id, { aceptaRecordatorios: false, aceptaPromociones: false })
    return { ok: true, id }
  }, [conBase, datos.campanas, usuario?.id, usuario?.nombre, alCambiarPermisos])

  // El contacto de un aviso (WhatsApp desde el Inicio, Citas, Pacientes o Ventas): queda en el Seguimiento igual que uno hecho desde el CRM. El permiso que se pide es el del módulo del
  // aviso, no «CRM: crear» (migración 0135).
  const contactarDeAviso = useCallback(async ({ paciente, motivo, mensaje = "" }) => {
    let id = idLocal()
    if (supabase && opticaId) {
      const { data, error: e } = await supabase.rpc("registrar_contacto_de_aviso", { p_paciente_id: paciente.id, p_motivo: motivo, p_mensaje: mensaje || null })
      if (e || !data) return { ok: false, error: textoDeError(e) }
      id = data
    }
    const nuevo = {
      id, pacienteId: paciente.id, motivo, canal: "whatsapp", mensaje, campanaId: null, resultado: null, volverEl: null, resultadoEn: null, resultadoPorNombre: "",
      creadoPor: usuario?.id || null, creadoPorNombre: usuario?.nombre || "", creadoEn: new Date().toISOString(),
    }
    setDatos((d) => ({ ...d, contactos: [nuevo, ...d.contactos] }))
    return { ok: true, id }
  }, [opticaId, usuario?.id, usuario?.nombre])

  // «Enviar mensaje» del perfil del paciente (texto libre, por WhatsApp o correo): queda en el Seguimiento como los demás contactos (migración 0139).
  const contactarManual = useCallback(async ({ paciente, canal = "whatsapp", mensaje = "" }) => {
    let id = idLocal()
    if (supabase && opticaId) {
      const { data, error: e } = await supabase.rpc("registrar_contacto_manual", { p_paciente_id: paciente.id, p_canal: canal, p_mensaje: mensaje || null })
      if (e || !data) return { ok: false, error: textoDeError(e) }
      id = data
    }
    const nuevo = { id, pacienteId: paciente.id, motivo: "mensaje_manual", canal, mensaje, campanaId: null, resultado: null, volverEl: null, resultadoEn: null, resultadoPorNombre: "", creadoPor: usuario?.id || null, creadoPorNombre: usuario?.nombre || "", creadoEn: new Date().toISOString() }
    setDatos((d) => ({ ...d, contactos: [nuevo, ...d.contactos] }))
    return { ok: true, id }
  }, [opticaId, usuario?.id, usuario?.nombre])

  const anotarResultado = useCallback(async (contacto, resultado, volverEl = null) => {
    if (conBase) {
      const { error: e } = await supabase.rpc("registrar_resultado_contacto_crm", { p_contacto_id: contacto.id, p_resultado: resultado, p_volver_el: volverEl })
      if (e) return { ok: false, error: textoDeError(e) }
    }
    setDatos((d) => ({
      ...d,
      contactos: d.contactos.map((x) => (x.id === contacto.id ? { ...x, resultado, volverEl: resultado === "volver_a_contactar" ? volverEl : null, resultadoEn: new Date().toISOString(), resultadoPorNombre: usuario?.nombre || "" } : x)),
    }))
    if (resultado === "no_desea_mensajes") alCambiarPermisos?.(contacto.pacienteId, { aceptaRecordatorios: false, aceptaPromociones: false })
    return { ok: true }
  }, [conBase, usuario?.nombre, alCambiarPermisos])

  const crearCampana = useCallback(async ({ nombre, grupo, mensaje }) => {
    let id = idLocal()
    if (conBase) {
      const { data, error: e } = await supabase.rpc("crear_campana_crm", { p_nombre: nombre, p_grupo: grupo, p_mensaje: mensaje })
      if (e || !data) return { ok: false, error: textoDeError(e) }
      id = data
    }
    const nueva = { id, nombre: nombre.trim(), grupo, mensaje: mensaje.trim(), creadaPorNombre: usuario?.nombre || "", creadaEn: new Date().toISOString() }
    setDatos((d) => ({ ...d, campanas: [nueva, ...d.campanas] }))
    return { ok: true, id, campana: nueva }
  }, [conBase, usuario?.nombre])

  const guardarPlantilla = useCallback(async (motivo, texto) => {
    if (conBase) {
      const { error: e } = await supabase.rpc("guardar_plantilla_crm", { p_motivo: motivo, p_texto: texto })
      if (e) return { ok: false, error: textoDeError(e) }
    }
    setDatos((d) => {
      const plantillas = { ...d.plantillas }
      if (texto.trim()) plantillas[motivo] = texto.trim()
      else delete plantillas[motivo]
      return { ...d, plantillas }
    })
    return { ok: true }
  }, [conBase])

  return { ...datos, cargando, error, recargar: cargar, contactar, contactarDeAviso, contactarManual, anotarResultado, crearCampana, guardarPlantilla }
}
