// «Descartar» un aviso de «Requiere tu atención» (reunión del 20 oct., punto 16; tabla aprobada en docs/ronda2-avisos-vigencia.md): saca el aviso de la lista, con un motivo de
// una lista fija (para poder agrupar) y un detalle opcional; queda quién lo descartó, cuándo y por qué (tabla avisos_descartados, migración 0134) y se puede volver a mostrar.
// Solo se descarta lo que es una decisión de la persona: lo que es un hecho pendiente (dinero, una solicitud de datos, un paciente esperando) se resuelve, no se esconde.
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { hoyISO } from "./disponibilidad"
import { mensajeDeError } from "./permisos"

export const TIPOS_DESCARTABLES = {
  "citas:contactar_paciente": { motivos: ["El paciente no quiere reagendar", "Ya se atendió en otro lugar", "No se pudo contactar", "Otro"], dias: null },
  "citas:control_sin_agendar": { motivos: ["El paciente no quiere control", "Se controla en otro lugar", "Otro"], dias: 60 },
  "pacientes:control_vencido": { motivos: ["No volverá", "Se controla en otro lugar", "Otro"], dias: 90 },
  "pacientes:sin_consulta": { motivos: ["Registrado solo para el portal", "Duplicado", "No vendrá", "Otro"], dias: null },
  "ventas:por_vender": { motivos: ["No concretó", "Compró en otro lugar", "Otro"], dias: null },
  "inventario:stock_bajo": { motivos: ["No se repondrá", "Se repone en otra fecha", "Otro"], dias: 30 },
}

export const claveDescarte = (tipo, clave) => `${tipo}|${clave}`

// Un descarte con vigencia vuelve a mostrar el aviso pasada su fecha (si la causa sigue); sin fecha, es para siempre.
export const descarteVigente = (d, hoy = hoyISO()) => !d.vigenteHasta || String(d.vigenteHasta).slice(0, 10) >= hoy

export const mapDescarte = (r) => ({ id: r.id, tipo: r.tipo, clave: r.clave, motivo: r.motivo, detalle: r.detalle, vigenteHasta: r.vigente_hasta, por: r.descartado_nombre, en: r.descartado_en })

// Parte una lista en lo que se ve y lo descartado (con su descarte): { visibles, descartados: [{ item, descarte }] }.
export function particionarDescartados(lista, tipo, claveDe, descartes = new Map()) {
  const visibles = []
  const descartados = []
  for (const item of lista) {
    const d = descartes.get(claveDescarte(tipo, claveDe(item)))
    if (d) descartados.push({ item, descarte: d })
    else visibles.push(item)
  }
  return { visibles, descartados }
}

// Los descartes vigentes de la óptica (cada minuto se vuelven a pedir, como el resto de los avisos). `habilitado`: quien ve algún aviso.
export function useAvisosDescartados(opticaId, habilitado) {
  const [descartes, setDescartes] = useState(() => new Map())
  const cargar = useCallback(async () => {
    if (!supabase || !habilitado || !opticaId || import.meta.env.MODE === "test") return
    const { data, error } = await supabase.from("avisos_descartados").select("*").eq("optica_id", opticaId)
    if (error || !data) return
    const hoy = hoyISO()
    setDescartes(new Map(data.map(mapDescarte).filter((d) => descarteVigente(d, hoy)).map((d) => [claveDescarte(d.tipo, d.clave), d])))
  }, [opticaId, habilitado])
  useEffect(() => {
    cargar()
    if (!habilitado) return undefined
    const t = setInterval(() => { if (!document.hidden) cargar() }, 60000)
    return () => clearInterval(t)
  }, [cargar, habilitado])

  // Descarta con la función de la base (que valida el permiso y deja el registro). Devuelve { error } con un texto para mostrar, o {}.
  const descartar = useCallback(async (tipo, clave, motivo, detalle = "") => {
    if (!supabase) return { error: "No hay conexión con el servidor." }
    const dias = TIPOS_DESCARTABLES[tipo]?.dias ?? null
    const { data, error } = await supabase.rpc("descartar_aviso", { p_tipo: tipo, p_clave: String(clave), p_motivo: motivo, p_detalle: detalle?.trim() || null, p_dias: dias })
    if (error || data !== true) return { error: mensajeDeError(error, "No se pudo descartar el aviso. Intenta de nuevo.") }
    await cargar()
    return {}
  }, [cargar])
  const restaurar = useCallback(async (tipo, clave) => {
    if (!supabase) return { error: "No hay conexión con el servidor." }
    const { data, error } = await supabase.rpc("restaurar_aviso", { p_tipo: tipo, p_clave: String(clave) })
    if (error || data !== true) return { error: mensajeDeError(error, "No se pudo volver a mostrar el aviso. Intenta de nuevo.") }
    await cargar()
    return {}
  }, [cargar])
  return { descartes, descartar, restaurar }
}
