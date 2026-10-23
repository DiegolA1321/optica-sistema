import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import { mensajeDeError } from "../../utilidades/permisos"

// Los datos de Horario (Ronda 5): el horario de cada persona (migración 0146: lo asigna la administración) y sus ausencias. El administrador lee los de toda la óptica; cada persona, los suyos.
// Todas las escrituras van por funciones de la base, que validan quién puede y dejan el rastro.
export const mapAusencia = (r) => ({
  id: r.id, usuarioId: r.usuario_id, usuarioNombre: r.usuario_nombre, tipo: r.tipo, fechaDesde: r.fecha_desde, fechaHasta: r.fecha_hasta, franja: r.franja || "todo", motivo: r.motivo || "",
  documentoRuta: r.documento_ruta || null, documentoNombre: r.documento_nombre || "", estado: r.estado, motivoRechazo: r.motivo_rechazo || "",
  resueltoPorNombre: r.resuelto_por_nombre || "", resueltoEn: r.resuelto_en || null, creadaEn: r.creada_en,
})
export const mapHorarioFila = (r) => ({ usuarioId: r.usuario_id, usaOptica: r.usa_horario_optica !== false, horario: r.horario_semanal || null })

const nombreSeguro = (nombre) => String(nombre || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").slice(-80) || "documento"
const idUnico = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`)

export function useDatosPersonal({ usuario, esAdmin, onCambioAgenda }) {
  const opticaId = usuario?.opticaId
  const conBase = Boolean(supabase && opticaId && usuario?.id)
  const [horarios, setHorarios] = useState({}) // id de la persona → { usaOptica, horario }
  const [ausencias, setAusencias] = useState([])
  const [rolesDe, setRolesDe] = useState({}) // id de la persona → nombres de sus roles
  const [cargando, setCargando] = useState(conBase)
  const [error, setError] = useState("")
  const vivo = useRef(true)
  useEffect(() => { vivo.current = true; return () => { vivo.current = false } }, [])

  const cargar = useCallback(async () => {
    if (!conBase) { setCargando(false); return }
    const pedidos = [
      supabase.from("horarios_usuario").select("usuario_id, usa_horario_optica, horario_semanal").eq("optica_id", opticaId),
      supabase.from("ausencias_personal").select("*").eq("optica_id", opticaId).order("fecha_desde", { ascending: false }),
    ]
    if (esAdmin) pedidos.push(supabase.from("perfil_roles").select("perfil_id, rol_id"), supabase.from("roles").select("id, nombre").eq("optica_id", opticaId))
    const [h, a, pr, ro] = await Promise.all(pedidos)
    if (!vivo.current) return
    // Sin la migración 0146 las tablas nuevas no existen: Horario sigue funcionando sin ellas (cada quien con el horario de la óptica y sin ausencias).
    if (h.error && !/usa_horario_optica/i.test(h.error.message || "")) setError("No se pudieron cargar los horarios. Revisa tu conexión e intenta de nuevo.")
    else setError("")
    setHorarios(Object.fromEntries((h.data || []).map(mapHorarioFila).map((f) => [f.usuarioId, f])))
    setAusencias((a.data || []).map(mapAusencia))
    if (esAdmin && pr?.data && ro?.data) {
      const nombre = new Map(ro.data.map((r) => [r.id, r.nombre]))
      const porPersona = {}
      for (const x of pr.data) (porPersona[x.perfil_id] ||= []).push(nombre.get(x.rol_id))
      setRolesDe(Object.fromEntries(Object.entries(porPersona).map(([k, v]) => [k, v.filter(Boolean)])))
    }
    setCargando(false)
  }, [conBase, opticaId, esAdmin])
  useEffect(() => { cargar() }, [cargar])

  // Lo que cambia aquí cambia la agenda y la web: se vuelve a pedir lo de la agenda.
  const despues = async () => { await cargar(); await onCambioAgenda?.() }
  const falla = (e, porDefecto) => ({ error: mensajeDeError(e, porDefecto) })

  const guardarHorario = async (personaId, usaOptica, horario) => {
    if (!conBase) return { error: null }
    const { error: e } = await supabase.rpc("guardar_horario_persona", { p_usuario: personaId, p_usa_optica: usaOptica, p_horario: usaOptica ? null : horario })
    if (e) return falla(e, "No se pudo guardar el horario. Revisa tu conexión e intenta de nuevo.")
    await despues()
    return { error: null }
  }

  // El documento se sube a la carpeta privada de la persona y la solicitud lo nombra; si la solicitud falla, el archivo se quita.
  const solicitarAusencia = async ({ tipo, desde, hasta, franja, motivo, archivo }) => {
    if (!conBase) return { error: null }
    let ruta = null
    if (archivo) {
      ruta = `${opticaId}/${usuario.id}/${idUnico()}-${nombreSeguro(archivo.name)}`
      const { error: eSubida } = await supabase.storage.from("ausencias-documentos").upload(ruta, archivo, { contentType: archivo.type, upsert: false })
      if (eSubida) return falla(eSubida, "No se pudo subir el documento. Revisa tu conexión e intenta de nuevo.")
    }
    const { error: e } = await supabase.rpc("solicitar_ausencia", { p_tipo: tipo, p_desde: desde, p_hasta: hasta, p_franja: franja, p_motivo: motivo || null, p_doc_ruta: ruta, p_doc_nombre: archivo?.name || null })
    if (e) {
      if (ruta) await supabase.storage.from("ausencias-documentos").remove([ruta])
      return falla(e, "No se pudo enviar la solicitud. Revisa tu conexión e intenta de nuevo.")
    }
    await despues()
    return { error: null }
  }

  const resolverAusencia = async (id, aprobar, motivo = "") => {
    if (!conBase) return { error: null }
    const { error: e } = await supabase.rpc("resolver_ausencia", { p_id: id, p_aprobar: aprobar, p_motivo: motivo || null })
    if (e) return falla(e, "No se pudo guardar la respuesta. Revisa tu conexión e intenta de nuevo.")
    await despues()
    return { error: null }
  }

  const retirarAusencia = async (id) => {
    if (!conBase) return { error: null }
    const { error: e } = await supabase.rpc("retirar_ausencia", { p_id: id })
    if (e) return falla(e, "No se pudo retirar la ausencia. Revisa tu conexión e intenta de nuevo.")
    await despues()
    return { error: null }
  }

  // El documento es privado: se pide una dirección que vale unos minutos.
  const urlDocumento = async (ruta) => {
    if (!conBase || !ruta) return null
    const { data, error: e } = await supabase.storage.from("ausencias-documentos").createSignedUrl(ruta, 300)
    return e ? null : data?.signedUrl || null
  }

  return { horarios, ausencias, rolesDe, cargando, error, recargar: cargar, guardarHorario, solicitarAusencia, resolverAusencia, retirarAusencia, urlDocumento }
}
