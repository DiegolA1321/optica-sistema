// Los contactos que ya se le hicieron a un paciente desde el CRM (y desde los avisos: todos quedan en crm_contactos), del más reciente al más antiguo. Quien no ve el CRM recibe una lista vacía
// (la base no le devuelve filas). Sin conexión, vacía.
import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"

export function useContactosDelPaciente(pacienteId, limite = 10) {
  const [lista, setLista] = useState([])
  useEffect(() => {
    if (!supabase || !pacienteId) return undefined
    let vivo = true
    supabase.from("crm_contactos").select("id, canal, motivo, creado_en, creado_por_nombre").eq("paciente_id", pacienteId).order("creado_en", { ascending: false }).limit(limite)
      .then(({ data, error }) => { if (vivo && !error && data) setLista(data) })
    return () => { vivo = false }
  }, [pacienteId, limite])
  return lista
}
