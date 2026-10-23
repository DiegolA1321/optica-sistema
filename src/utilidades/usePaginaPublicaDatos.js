import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

// Datos automáticos de «Quiénes somos» (optómetras activos y pacientes atendidos) desde la función pública
// `pagina_publica_datos`. Si la función no existe todavía, falla o no devuelve nada, la página sigue sin esos datos
// (sin tarjeta de optómetra ni los dos números que dependen de ella): devuelve null y nunca lanza.
export default function usePaginaPublicaDatos(opticaId) {
  const [datos, setDatos] = useState(null)
  useEffect(() => {
    if (!supabase || !opticaId) {
      setDatos(null)
      return undefined
    }
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.rpc("pagina_publica_datos", { p_optica_id: opticaId })
        if (vivo && !error && data && typeof data === "object") setDatos(data)
      } catch {
        // la página funciona igual sin estos datos
      }
    })()
    return () => {
      vivo = false
    }
  }, [opticaId])
  return datos
}
