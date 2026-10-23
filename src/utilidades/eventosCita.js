// El seguimiento de la cita: lo que la base guarda en citas_eventos (migración 0134), listo para la línea de tiempo.
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

import { horaSinCero } from "./formatoFecha"
export const mapEventoCita = (r) => ({ id: r.id, citaId: r.cita_id, tipo: r.tipo, en: r.ocurrido_en, quien: r.actor_nombre || "", quienTipo: r.actor_tipo, datos: r.datos || {} })

// Eventos de una o varias citas, del más antiguo al más reciente. Sin conexión (o sin permiso) devuelve vacío: la pantalla arma lo que sabe de la propia cita.
export async function leerEventosDeCitas(ids = []) {
  if (!supabase || ids.length === 0) return []
  const { data, error } = await supabase.from("citas_eventos").select("*").in("cita_id", ids).order("ocurrido_en", { ascending: true })
  return error ? [] : (data || []).map(mapEventoCita)
}

// El seguimiento de una cita abierta en el detalle: se vuelve a leer cuando cambia su estado, su fecha o su hora (cada cambio deja un evento).
export function useEventosDeCita(cita, habilitado = true) {
  const [eventos, setEventos] = useState([])
  const clave = cita ? `${cita.id}|${cita.estado}|${cita.fecha}|${horaSinCero(cita.hora)}` : ""
  useEffect(() => {
    // Las pruebas de pantalla no llaman a la base: pasan los eventos que necesitan por la propiedad.
    if (!habilitado || !cita?.id || !supabase || import.meta.env.MODE === "test") return undefined
    let vivo = true
    leerEventosDeCitas([cita.id]).then((e) => { if (vivo) setEventos(e) })
    return () => { vivo = false }
  }, [clave, habilitado]) // eslint-disable-line react-hooks/exhaustive-deps
  return eventos
}
