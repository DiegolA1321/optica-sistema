import React, { useEffect, useState } from "react"
import { ShieldCheck, ShieldAlert, AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabaseClient"

const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Sección de "verificación en dos pasos" (MFA/TOTP) — se cuelga dentro de
// cualquier modal de "Mi cuenta" existente (SuperadminPanel, Dashboard). Usa
// el MFA nativo de Supabase Auth (TOTP con app autenticadora tipo Google
// Authenticator/Authy) — nada de criptografía propia, Supabase genera y
// valida el secreto.
//
// Alcance real: esto es una verificación aplicada del lado de la app — al
// iniciar sesión, Login.jsx exige el código si hay un factor verificado
// antes de dar acceso al panel. No se tocó ninguna policy de RLS para exigir
// aal2 a nivel de base de datos (eso sería lo más riguroso, pero implica
// revisar cada policy existente — fuera de alcance de esta ronda para no
// arriesgar romper el acceso ya construido). Diego lo sabe.
export default function SeccionMfa() {
  const [factores, setFactores] = useState(null) // null = cargando
  const [error, setError] = useState("")
  const [inscribiendo, setInscribiendo] = useState(false)
  const [qrCode, setQrCode] = useState(null)
  const [secreto, setSecreto] = useState("")
  const [factorPendienteId, setFactorPendienteId] = useState(null)
  const [codigo, setCodigo] = useState("")
  const [procesando, setProcesando] = useState(false)
  const [exito, setExito] = useState("")

  const cargarFactores = async () => {
    if (!supabase) return
    const { data, error: errorList } = await supabase.auth.mfa.listFactors()
    if (errorList) { setError("No se pudo cargar el estado de verificación en dos pasos."); return }
    setFactores((data?.totp || []).filter((f) => f.status === "verified"))
  }

  useEffect(() => { cargarFactores() }, [])

  const activo = factores && factores.length > 0

  const iniciarInscripcion = async () => {
    setError("")
    setExito("")
    setProcesando(true)
    const { data, error: errorEnroll } = await supabase.auth.mfa.enroll({ factorType: "totp" })
    setProcesando(false)
    if (errorEnroll) {
      setError("No se pudo iniciar la activación. Intenta de nuevo.")
      return
    }
    setFactorPendienteId(data.id)
    setQrCode(data.totp.qr_code)
    setSecreto(data.totp.secret)
    setInscribiendo(true)
  }

  const cancelarInscripcion = async () => {
    // Un factor "unverified" a medio camino no sirve de nada — se limpia
    // para no dejar basura ni confundir un futuro intento.
    if (factorPendienteId) await supabase.auth.mfa.unenroll({ factorId: factorPendienteId })
    setInscribiendo(false)
    setQrCode(null)
    setSecreto("")
    setFactorPendienteId(null)
    setCodigo("")
    setError("")
  }

  const confirmarInscripcion = async (e) => {
    e.preventDefault()
    if (!codigo.trim() || procesando) return
    setError("")
    setProcesando(true)
    const { data: challenge, error: errorChallenge } = await supabase.auth.mfa.challenge({ factorId: factorPendienteId })
    if (errorChallenge) {
      setProcesando(false)
      setError("No se pudo verificar el código. Intenta de nuevo.")
      return
    }
    const { error: errorVerify } = await supabase.auth.mfa.verify({ factorId: factorPendienteId, challengeId: challenge.id, code: codigo.trim() })
    setProcesando(false)
    if (errorVerify) {
      setError("Código incorrecto — revisa la hora de tu teléfono y vuelve a intentar.")
      return
    }
    setInscribiendo(false)
    setQrCode(null)
    setSecreto("")
    setFactorPendienteId(null)
    setCodigo("")
    setExito("Verificación en dos pasos activada. La próxima vez que inicies sesión, te pediremos el código.")
    cargarFactores()
  }

  const desactivar = async (factorId) => {
    setError("")
    setProcesando(true)
    const { error: errorUnenroll } = await supabase.auth.mfa.unenroll({ factorId })
    setProcesando(false)
    if (errorUnenroll) { setError("No se pudo desactivar. Intenta de nuevo."); return }
    setExito("Verificación en dos pasos desactivada.")
    cargarFactores()
  }

  if (factores === null) {
    return <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 size={14} className="animate-spin" /> Cargando…</p>
  }

  return (
    <div>
      <p className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
        {activo ? <ShieldCheck size={16} className="text-emerald-600" /> : <ShieldAlert size={16} className="text-amber-500" />}
        Verificación en dos pasos
      </p>

      {error && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}
      {exito && !inscribiendo && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 size={14} className="shrink-0" /> {exito}
        </div>
      )}

      {inscribiendo ? (
        <form onSubmit={confirmarInscripcion} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-xs text-slate-600">
            Escanea este código con una app autenticadora (Google Authenticator, Authy, etc.) y escribe el código de 6 dígitos que te muestre.
          </p>
          {qrCode && (
            <div className="flex justify-center">
              <img src={qrCode} alt="Código QR para activar verificación en dos pasos" className="h-40 w-40 rounded-lg border border-slate-200 bg-white p-2" />
            </div>
          )}
          {secreto && (
            <p className="break-all text-center font-mono text-[11px] text-slate-500">O ingresa este código manualmente: {secreto}</p>
          )}
          <input
            type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456"
            value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-center font-mono text-lg tracking-[0.3em] text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={cancelarInscripcion} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={codigo.length !== 6 || procesando} className="rounded-xl px-3.5 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
              {procesando ? "Verificando…" : "Activar"}
            </button>
          </div>
        </form>
      ) : activo ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5">
          <p className="text-xs font-medium text-emerald-700">Activada — te pedimos un código al iniciar sesión.</p>
          <button type="button" onClick={() => desactivar(factores[0].id)} disabled={procesando} className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-60">
            Desactivar
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-3.5">
          <p className="text-xs text-slate-500">Todavía no está activada. Añade una capa extra de seguridad a tu cuenta.</p>
          <button type="button" onClick={iniciarInscripcion} disabled={procesando} className="shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
            Activar
          </button>
        </div>
      )}
    </div>
  )
}
