import { useEffect, useMemo, useState, useCallback } from "react"
import { supabase } from "../lib/supabaseClient"
import { construirVistas, elegirVista, clavePreferenciaVista } from "./vistas"

// Las vistas de quien tiene la sesión y la que está activa (se recuerda en el navegador).
export function useVistas(usuario) {
  const [rolesDetalle, setRolesDetalle] = useState([])
  const idsRoles = (usuario?.roles || []).map((r) => r.id).sort().join(",")
  useEffect(() => {
    if (!supabase || !idsRoles) { setRolesDetalle([]); return }
    let vivo = true
    supabase.from("roles").select("id, nombre, inicio, atiende_pacientes, permisos, alcance").in("id", idsRoles.split(",")).then(({ data }) => { if (vivo) setRolesDetalle(data || []) })
    return () => { vivo = false }
  }, [idsRoles])

  const vistas = useMemo(() => construirVistas(usuario, rolesDetalle), [usuario?.rol, idsRoles, rolesDetalle]) // eslint-disable-line react-hooks/exhaustive-deps
  const [guardada, setGuardada] = useState(() => { try { return localStorage.getItem(clavePreferenciaVista(usuario?.id)) } catch { return null } })
  const vista = useMemo(() => elegirVista(vistas, guardada), [vistas, guardada])
  const cambiarVista = useCallback((id) => {
    setGuardada(id)
    try { localStorage.setItem(clavePreferenciaVista(usuario?.id), id) } catch { /* sin almacenamiento: la elección vale solo en esta sesión */ }
  }, [usuario?.id])
  return { vistas, vista, cambiarVista }
}
