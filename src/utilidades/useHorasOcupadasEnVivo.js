import { useCallback, useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabaseClient"

export const INTERVALO_HORAS_MS = 20000

// Las horas ocupadas de la óptica (horas_ocupadas_publicas: fecha, hora, duración, estado y profesional; nunca datos de personas), siempre al día.
// Mientras la pantalla de horarios está abierta se vuelve a pedir sola cada ~20 s y al volver el foco a la pestaña, sin mover lo que la persona ya eligió.
//   horas      las filas actuales
//   refrescar  pide las horas ahora y devuelve las filas nuevas (por ejemplo, justo después de perder una hora)
//   cargando   true solo mientras llega la primera respuesta (para mostrar el esqueleto)
// `activo` = false (otra pantalla) pausa el refresco. `cliente` permite probarlo con un supabase falso.
export default function useHorasOcupadasEnVivo(opticaId, { activo = true, intervalo = INTERVALO_HORAS_MS, cliente = supabase } = {}) {
  const [horas, setHoras] = useState([])
  const [cargando, setCargando] = useState(Boolean(cliente && opticaId))
  const ultimo = useRef("[]")
  const vivo = useRef(true)

  const refrescar = useCallback(async () => {
    if (!cliente || !opticaId) { setCargando(false); return null }
    try {
      const { data, error } = await cliente.rpc("horas_ocupadas_publicas", { p_optica_id: opticaId })
      if (!vivo.current) return null
      setCargando(false)
      if (error || !Array.isArray(data)) return null
      const texto = JSON.stringify(data)
      if (texto !== ultimo.current) { ultimo.current = texto; setHoras(data) }
      return data
    } catch {
      if (vivo.current) setCargando(false)
      return null
    }
  }, [cliente, opticaId])

  useEffect(() => {
    vivo.current = true
    return () => { vivo.current = false }
  }, [])

  useEffect(() => {
    if (!activo) return undefined
    refrescar()
    const id = setInterval(() => { if (!document.hidden) refrescar() }, intervalo)
    const alVolver = () => { if (!document.hidden) refrescar() }
    document.addEventListener("visibilitychange", alVolver)
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", alVolver) }
  }, [activo, intervalo, refrescar])

  return { horas, refrescar, cargando }
}
