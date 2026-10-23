"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { mensajeDeError } from "../utilidades/permisos"
import FotoProfesional from "./FotoProfesional"

// «Mi cuenta» de quien atiende pacientes: su foto (se usa dentro del sistema, p. ej. «Te atiende…» en el agendamiento) y si quiere aparecer en la página pública de la óptica
// (foto, nombre y registro en «Quiénes somos»). Por defecto NO aparece: solo esta persona lo activa (la base no deja que otra lo haga por ella).
// Las columnas las crea la migración 0148: si aún no existen, el bloque no se muestra en vez de romper Mi cuenta.
export default function MiPresenciaPublica({ usuario, onAviso }) {
  const [estado, setEstado] = useState(null) // null = cargando o no disponible
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let vivo = true
    if (!supabase || !usuario?.id) return undefined
    ;(async () => {
      try {
        const { data, error: e } = await supabase.from("perfiles").select("foto_url, mostrar_en_publica").eq("id", usuario.id).maybeSingle()
        if (vivo && !e && data) setEstado({ foto: data.foto_url || "", mostrar: !!data.mostrar_en_publica })
      } catch { /* sin la columna: no se muestra */ }
    })()
    return () => { vivo = false }
  }, [usuario?.id])

  if (!estado) return null

  const cambiarMostrar = async (valor) => {
    setError("")
    setGuardando(true)
    const { error: e } = await supabase.rpc("guardar_mi_visibilidad_publica", { p_mostrar: valor })
    setGuardando(false)
    if (e) { setError(mensajeDeError(e, "No se pudo guardar. Revisa tu conexión e intenta de nuevo.")); return }
    setEstado((s) => ({ ...s, mostrar: valor }))
    onAviso?.(valor ? "Ahora apareces en la página pública." : "Ya no apareces en la página pública.")
  }

  return (
    <div className="mb-5 space-y-4 rounded-xl border border-slate-200/60 p-4" data-mi-presencia-publica>
      <FotoProfesional propia opticaId={usuario.opticaId} perfilId={usuario.id} nombre={usuario.nombre} url={estado.foto} onCambio={(u) => setEstado((s) => ({ ...s, foto: u }))} onAviso={onAviso} />
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" className="mt-1 h-5 w-5 shrink-0 rounded border-slate-300 text-blue-600" checked={estado.mostrar} disabled={guardando} onChange={(e) => cambiarMostrar(e.target.checked)} />
        <span>
          <span className="block text-sm font-bold text-slate-800">Mostrarme en la página pública</span>
          <span className="block text-xs text-slate-500">Tu foto, tu nombre y tu registro profesional saldrán en «Quiénes somos» de la página de la óptica. Está desactivado hasta que lo actives tú.</span>
        </span>
      </label>
      {error && <p role="alert" className="text-sm font-medium text-red-600">{error}</p>}
    </div>
  )
}
