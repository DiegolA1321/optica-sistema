// Avisos «Marta Zambrano actualizó su teléfono» (migración 0130): cuando el paciente cambia su teléfono o su correo desde su portal, la óptica recibe un aviso en la campana y en
// «Requiere tu atención» del Inicio. Se queda hasta que alguien lo marca como visto.
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

const DATO = { telefono: "su teléfono", correo: "su correo", telefono_y_correo: "su teléfono y su correo" }
export const textoAvisoContacto = (nombre, campos) => `${nombre || "Un paciente"} actualizó ${DATO[campos] || "sus datos de contacto"}`
export const mapAvisoContacto = (a) => ({ id: a.id, pacienteId: a.paciente_id, campos: a.campos, creadoEn: a.creado_en })

// Los avisos pendientes de la óptica (cada minuto se vuelven a pedir, como el resto de lo que llega del portal). `habilitado`: quien tiene permiso de ver Pacientes.
export function useAvisosContacto(opticaId, habilitado) {
  const [avisos, setAvisos] = useState([])
  useEffect(() => {
    if (!supabase || !habilitado || !opticaId) return undefined
    let vivo = true
    const cargar = async () => {
      if (document.hidden) return
      const { data } = await supabase.from("avisos_contacto_paciente").select("*").eq("optica_id", opticaId).is("atendido_en", null).order("creado_en", { ascending: false })
      if (vivo && data) setAvisos(data.map(mapAvisoContacto))
    }
    cargar()
    const t = setInterval(cargar, 60000)
    return () => { vivo = false; clearInterval(t) }
  }, [opticaId, habilitado])
  const atender = useCallback(async (id) => {
    setAvisos((prev) => prev.filter((a) => a.id !== id))
    if (supabase) await supabase.rpc("atender_aviso_contacto", { p_aviso_id: id })
  }, [])
  return { avisos, atender }
}
