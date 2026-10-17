// Lo que el Resumen lee del servidor para «Estado del sistema» y «Uso del sistema» (funciones de la migración 0121). Si la migración todavía no
// está aplicada, se dice «sin dato» y el resto del Resumen sigue funcionando. Con ?_muestra=estado (solo en desarrollo) se usan datos de ejemplo
// para poder revisar la pantalla antes de aplicarla.
import { useCallback, useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import { estadoDeMuestra } from "../../utilidades/estadoSistema"
import { leerParam } from "../../utilidades/urlEstado"

// ?_muestra=estado (todo en orden), =lento (un componente lento y una consulta urgente) o =error (no se puede verificar). Solo en desarrollo.
export const modoMuestra = () => (import.meta.env?.DEV ? ["estado", "lento", "error"].find((v) => leerParam("_muestra") === v) || null : null)
const esMuestra = () => modoMuestra() !== null
const CADA_CUANTO_MS = 5 * 60 * 1000

export default function useEstadoSistema(activo = true) {
  const [estado, setEstado] = useState({ cargando: true, datos: null, sinServidor: false, verificando: false, error: "" })

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("estado_sistema")
    if (modoMuestra() === "error") { setEstado((e) => ({ ...e, cargando: false, datos: null, sinServidor: true })); return }
    if (error && esMuestra()) { setEstado((e) => ({ ...e, cargando: false, datos: estadoDeMuestra(Date.now(), modoMuestra()), sinServidor: false })); return }
    setEstado((e) => ({ ...e, cargando: false, datos: error ? null : data, sinServidor: !!error }))
  }, [])

  useEffect(() => {
    if (!activo) return undefined
    cargar()
    const reloj = setInterval(cargar, CADA_CUANTO_MS)
    return () => clearInterval(reloj)
  }, [cargar, activo])

  const verificarAhora = useCallback(async () => {
    setEstado((e) => ({ ...e, verificando: true, error: "" }))
    const { error } = await supabase.rpc("verificar_sistema")
    if (error && !esMuestra()) { setEstado((e) => ({ ...e, verificando: false, error: "No se pudo verificar ahora. Vuelve a intentarlo." })); return false }
    await cargar()
    setEstado((e) => ({ ...e, verificando: false }))
    return true
  }, [cargar])

  return { ...estado, recargar: cargar, verificarAhora }
}

// El personal de una óptica con su rol y su último ingreso.
export async function personalDeLaOptica(opticaId) {
  const { data, error } = await supabase.rpc("personal_de_la_optica", { p_optica: opticaId })
  if (error && esMuestra()) {
    const hace = (d) => new Date(Date.now() - d * 86400000).toISOString()
    return { datos: [
      { nombre: "Karla Vera", rol: "Administrador", activo: true, ultimo_ingreso: hace(0), activa_30d: true },
      { nombre: "Andrés Mora", rol: "Optómetra", activo: true, ultimo_ingreso: hace(2), activa_30d: true },
      { nombre: "Lucía Paz", rol: "Recepción y ventas", activo: true, ultimo_ingreso: hace(40), activa_30d: false },
    ], error: null }
  }
  return { datos: error ? [] : data || [], error: error ? error.message : null }
}

// Cuándo se usó un módulo en 30 días y qué roles lo usaron, juntando las ópticas que cuentan (normalmente una).
export async function usoDeModulo(opticaIds, modulo) {
  if (esMuestra()) {
    const dia = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
    if (modulo === "crm" || modulo === "reportes") return { dias: [], roles: [], ultimo: null, error: null }
    return { dias: [{ dia: dia(0), roles: ["Administrador", "Optómetra"] }, { dia: dia(1), roles: ["Optómetra"] }, { dia: dia(3), roles: ["Recepción y ventas"] }, { dia: dia(8), roles: ["Administrador"] }], roles: ["Administrador", "Optómetra", "Recepción y ventas"], ultimo: new Date().toISOString(), error: null }
  }
  const respuestas = await Promise.all(opticaIds.map((id) => supabase.rpc("uso_de_modulo", { p_optica: id, p_modulo: modulo })))
  const error = respuestas.find((r) => r.error)?.error
  if (error) return { dias: [], roles: [], ultimo: null, error: error.message }
  const porDia = new Map()
  for (const { data } of respuestas) for (const d of data?.dias || []) porDia.set(d.dia, [...new Set([...(porDia.get(d.dia) || []), ...d.roles])])
  const dias = [...porDia.entries()].map(([dia, roles]) => ({ dia, roles })).sort((a, b) => (a.dia < b.dia ? 1 : -1))
  const roles = [...new Set(dias.flatMap((d) => d.roles))]
  const ultimos = respuestas.map((r) => r.data?.ultimo).filter(Boolean).sort()
  return { dias, roles, ultimo: ultimos[ultimos.length - 1] || null, error: null }
}
