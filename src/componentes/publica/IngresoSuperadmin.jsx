import { useState } from "react"
import { ShieldCheck, X } from "lucide-react"
import EstilosPublica from "./EstilosPublica"
import OjoOptico from "./OjoOptico"
import FormularioCodigoMfa from "./FormularioCodigoMfa"

const CAMPO = "min-h-12 w-full rounded-xl border border-white/20 bg-white/[0.07] px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-300/70 focus:ring-2 focus:ring-cyan-300/20"

// Ingreso del superadmin (?sitio=admin): la única pantalla oscura del sistema. Tarjeta de vidrio centrada, un ojo grande
// parcialmente visible arriba a la derecha con una luz que se mueve lento (se apaga con prefers-reduced-motion).
// La lógica del ingreso llega por props desde Login.jsx.
export default function IngresoSuperadmin({
  usuario, setUsuario, password, setPassword, errorLogin, enviando, resolviendoOptica,
  mfaPendiente, codigoMfa, setCodigoMfa, manejarEnvio, verificarCodigoMfa, cancelarMfa,
}) {
  const [verPassword, setVerPassword] = useState(false)
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden p-4 font-sans text-white antialiased" style={{ background: "linear-gradient(160deg,#0E2552 0%,#0A1633 45%,#050B1A 100%)" }}>
      <EstilosPublica />
      <div aria-hidden="true" className="lg-glow pointer-events-none absolute -bottom-40 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.35), transparent 70%)" }} />
      <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 h-72 w-72 overflow-hidden rounded-full opacity-70 sm:-right-40 sm:-top-40 sm:h-[34rem] sm:w-[34rem] sm:opacity-100">
        <OjoOptico className="block h-full w-full" />
        <div className="lg-luz absolute inset-0" style={{ background: "radial-gradient(circle at 50% 50%, rgba(125,211,252,0.35), transparent 45%)" }} />
      </div>

      <div className="lg-rise relative z-10 w-full max-w-[28.5rem] rounded-3xl border border-white/15 bg-white/[0.06] p-6 backdrop-blur-xl sm:p-7" style={{ boxShadow: "0 30px 80px -30px rgba(0,0,0,0.7)" }}>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-600 text-white"><ShieldCheck size={24} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold leading-tight sm:text-xl">Administración del sistema</h1>
            <p className="text-sm text-slate-300">Acceso restringido · se registra cada ingreso</p>
          </div>
        </div>

        <div className="mt-5">
          {mfaPendiente ? (
            <div className="rounded-2xl bg-white p-5 text-slate-900">
              <FormularioCodigoMfa codigo={codigoMfa} setCodigo={setCodigoMfa} errorLogin={errorLogin} enviando={enviando} onSubmit={verificarCodigoMfa} onCancelar={cancelarMfa} />
            </div>
          ) : (
            <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
              {errorLogin && (
                <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-300/40 bg-red-500/15 p-3 text-sm font-medium text-red-100">
                  <X size={16} className="mt-0.5 shrink-0" />
                  {errorLogin}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="usuario-solo" className="text-sm font-semibold">Correo</label>
                <input id="usuario-solo" type="text" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="tu@correo.com" className={CAMPO} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password-solo" className="text-sm font-semibold">Contraseña</label>
                <div className="relative">
                  <input id="password-solo" type={verPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" className={CAMPO + " pr-24"} />
                  <button type="button" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-1 top-1/2 min-h-11 -translate-y-1/2 px-3 text-sm font-medium text-slate-300 transition-colors hover:text-white cursor-pointer">
                    {verPassword ? "Ocultar" : "Mostrar"}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={enviando || resolviendoOptica}
                className="min-h-12 w-full rounded-xl py-3 text-base font-semibold text-white transition duration-200 hover:brightness-110 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 14px 30px -12px rgba(37,99,235,0.7)" }}>
                {enviando ? "Ingresando…" : resolviendoOptica ? "Cargando…" : "Ingresar"}
              </button>
            </form>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm text-slate-300">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" aria-hidden="true" />Sistema operativo</span>
          <span>¿Problemas? Soporte técnico</span>
        </div>
      </div>
    </div>
  )
}
