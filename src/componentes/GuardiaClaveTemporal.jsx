"use client"

import { useEffect, useState } from "react"
import AvisoFlotante, { DURACION_AVISO_MS } from "./AvisoFlotante"
import { KeyRound, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { INK } from "@/lib/tema"
import { validarClaveNueva, MENSAJE_CLAVE_SEGURA } from "../utilidades/validaciones"

// Las cuentas del personal se crean con una contraseña temporal que genera el sistema (la ve el administrador una sola vez). La cuenta lleva la marca
// `clave_temporal` en los datos de su sesión; mientras esté puesta, la persona no entra a la aplicación: primero elige la suya. Al guardarla,
// la contraseña y la marca cambian en la misma llamada. (El enlace por correo reemplazará esta pantalla cuando exista el dominio.)
export default function GuardiaClaveTemporal({ alSalir, children }) {
  const [estado, setEstado] = useState("comprobando") // comprobando | cambiar | lista
  const [clave, setClave] = useState("")
  const [repetir, setRepetir] = useState("")
  const [ver, setVer] = useState(false)
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [aviso, setAviso] = useState(false)

  useEffect(() => {
    let vivo = true
    if (!supabase) { setEstado("lista"); return }
    supabase.auth.getSession().then(({ data }) => {
      if (!vivo) return
      setEstado(data?.session?.user?.user_metadata?.clave_temporal === true ? "cambiar" : "lista")
    })
    return () => { vivo = false }
  }, [])

  const guardar = async (e) => {
    e.preventDefault()
    const problema = validarClaveNueva(clave)
    if (problema) { setError(problema); return }
    if (clave !== repetir) { setError("Las dos contraseñas no coinciden."); return }
    setError("")
    setGuardando(true)
    const { error: errorAuth } = await supabase.auth.updateUser({ password: clave, data: { clave_temporal: false } })
    setGuardando(false)
    if (errorAuth) {
      setError(/different from the old|same password/i.test(errorAuth.message) ? "Elige una contraseña distinta de la temporal." : "No pudimos guardar tu contraseña. Revisa tu conexión e inténtalo de nuevo.")
      return
    }
    setClave("")
    setRepetir("")
    setAviso(true)
    setTimeout(() => setAviso(false), DURACION_AVISO_MS)
    setEstado("lista")
  }

  if (estado === "comprobando") {
    return <div className="grid min-h-screen place-items-center bg-slate-50" aria-busy="true"><Loader2 size={28} className="animate-spin text-blue-500" aria-label="Cargando" /></div>
  }
  if (estado === "lista") {
    return (
      <>
        {children}
        {aviso && <AvisoFlotante texto="Contraseña guardada. Ya puedes usar el sistema." tipo="exito" />}
      </>
    )
  }
  const campo = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
  return (
    <div className="grid min-h-screen place-items-center bg-slate-50 p-4">
      <form onSubmit={guardar} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm" aria-labelledby="clave-temporal-titulo">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}><KeyRound size={20} aria-hidden="true" /></span>
          <div>
            <h1 id="clave-temporal-titulo" className="text-lg font-bold" style={{ color: INK }}>Crea tu contraseña</h1>
            <p className="text-sm text-slate-500">Entraste con una contraseña temporal. Elige una propia para seguir.</p>
          </div>
        </div>
        {error && <p role="alert" className="flex items-start gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" /> {error}</p>}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña nueva</span>
          <div className="relative">
            <input type={ver ? "text" : "password"} value={clave} onChange={(e) => setClave(e.target.value)} autoComplete="new-password" className={campo + " pr-10"} />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
              {ver ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">{MENSAJE_CLAVE_SEGURA}</p>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-slate-700">Repite la contraseña</span>
          <input type={ver ? "text" : "password"} value={repetir} onChange={(e) => setRepetir(e.target.value)} autoComplete="new-password" className={campo} />
        </label>
        <button type="submit" disabled={guardando} className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
          {guardando ? <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Guardando…</> : "Guardar y entrar"}
        </button>
        {alSalir && (
          <button type="button" onClick={alSalir} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">
            <LogOut size={14} aria-hidden="true" /> Salir
          </button>
        )}
      </form>
    </div>
  )
}
