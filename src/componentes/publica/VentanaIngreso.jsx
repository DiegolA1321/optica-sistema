import { useEffect, useRef, useState } from "react"
import { Eye, EyeOff, Lock, User, X } from "lucide-react"
import LogoOptica from "../LogoOptica"
import FormularioCodigoMfa from "./FormularioCodigoMfa"
import OlvidoClave from "./OlvidoClave"
import { paginaPublica, degradadoMarca } from "../../utilidades/marcaOptica"

const NAVY = "#0B1633"
const FOCOSABLES = "input, button, [href], select, textarea, [tabindex]:not([tabindex='-1'])"

// Ventana de ingreso sobre la página pública: un solo acceso para pacientes y equipo. La lógica del ingreso (contraseña, MFA,
// perfiles) vive en Login.jsx y llega por props; aquí solo está lo que se ve, el foco atrapado y Escape.
export default function VentanaIngreso({
  opticaPublica, disponibilidad, onCerrar, onAgendar,
  usuario, setUsuario, password, setPassword, errorLogin, enviando, resolviendoOptica,
  mfaPendiente, codigoMfa, setCodigoMfa, manejarEnvio, verificarCodigoMfa, cancelarMfa,
}) {
  const [vista, setVista] = useState("ingreso")
  const [verPassword, setVerPassword] = useState(false)
  const modalRef = useRef(null)
  const pp = paginaPublica(opticaPublica?.marca, opticaPublica?.nombre || "Tu óptica")

  useEffect(() => {
    modalRef.current?.querySelector(FOCOSABLES)?.focus()
  }, [vista])

  useEffect(() => {
    const nodo = modalRef.current
    const alTeclear = (e) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCerrar()
        return
      }
      if (e.key !== "Tab" || !nodo) return
      const focosables = nodo.querySelectorAll(FOCOSABLES)
      if (focosables.length === 0) return
      const primero = focosables[0]
      const ultimo = focosables[focosables.length - 1]
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }
    document.addEventListener("keydown", alTeclear)
    return () => document.removeEventListener("keydown", alTeclear)
  }, [onCerrar])

  const botonCerrar = (
    <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
      <X size={20} />
    </button>
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:items-center sm:py-8" role="dialog" aria-modal="true" aria-labelledby="titulo-login">
      <div onClick={onCerrar} aria-hidden="true" className="lg-velo fixed inset-0 cursor-pointer backdrop-blur-sm" style={{ backgroundColor: "rgba(120,134,158,0.55)" }} />
      <div ref={modalRef} className="lg-modal relative z-10 my-auto w-full max-w-[29.5rem] rounded-3xl bg-white p-5 text-left sm:p-6" style={{ boxShadow: "0 40px 90px -30px rgba(15,23,42,0.55)" }}>
        {vista === "olvido" && !mfaPendiente ? (
          <OlvidoClave
            opticaPublica={opticaPublica}
            disponibilidad={disponibilidad}
            usuario={usuario}
            onVolver={() => setVista("ingreso")}
            botonCerrar={botonCerrar}
          />
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <LogoOptica url={opticaPublica?.logo_url || ""} nombre={pp.nombre} color={pp.color} tamano={44} />
                <div className="min-w-0">
                  <h2 id="titulo-login" className="font-serif text-xl font-bold leading-tight sm:text-2xl" style={{ color: NAVY }}>Ingresa a {pp.nombre}</h2>
                  <p className="text-sm text-slate-600">Pacientes y equipo de la óptica</p>
                </div>
              </div>
              {botonCerrar}
            </div>

            <div className="mt-4">
              {mfaPendiente ? (
                <FormularioCodigoMfa codigo={codigoMfa} setCodigo={setCodigoMfa} errorLogin={errorLogin} enviando={enviando} onSubmit={verificarCodigoMfa} onCancelar={cancelarMfa} />
              ) : (
                <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
                  {errorLogin && (
                    <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                      <X size={16} className="mt-0.5 shrink-0" />
                      {errorLogin}
                    </div>
                  )}
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="usuario" className="text-sm font-semibold" style={{ color: NAVY }}>Cédula o usuario</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                      <input id="usuario" type="text" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Ej. 0912345678 o tu usuario"
                        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="password" className="text-sm font-semibold" style={{ color: NAVY }}>Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} aria-hidden="true" />
                      <input id="password" type={verPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña"
                        className="min-h-12 w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-12 text-base text-slate-900 outline-none transition-colors placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                      <button type="button" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                        className="absolute right-1 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">
                        {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4">
                    <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-slate-700">
                      <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                      Recordarme
                    </label>
                    <button type="button" onClick={() => setVista("olvido")} className="min-h-11 text-sm font-semibold text-blue-700 hover:underline cursor-pointer">¿Olvidaste tu contraseña?</button>
                  </div>
                  <button type="submit" disabled={enviando || resolviendoOptica}
                    className="min-h-12 w-full rounded-xl py-3 text-base font-semibold text-white transition duration-200 hover:brightness-105 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: degradadoMarca(pp.color), boxShadow: "0 14px 28px -12px rgba(37,99,235,0.55)" }}>
                    {enviando ? "Ingresando…" : resolviendoOptica ? "Cargando…" : "Ingresar"}
                  </button>
                  <p className="text-center text-sm text-slate-600">
                    ¿Aún no eres paciente?{" "}
                    <button type="button" onClick={onAgendar} className="min-h-11 font-semibold text-blue-700 hover:underline cursor-pointer">Agenda tu primera cita</button>
                  </p>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
