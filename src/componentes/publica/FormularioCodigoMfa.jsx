import { X } from "lucide-react"

// Paso 2 del ingreso cuando la cuenta tiene verificación en dos pasos: se muestra dentro de la misma ventana (o tarjeta del superadmin).
export default function FormularioCodigoMfa({ codigo, setCodigo, errorLogin, enviando, onSubmit, onCancelar }) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {errorLogin && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
          <X size={16} className="mt-0.5 shrink-0" />
          {errorLogin}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="codigo-mfa" className="text-sm font-medium text-slate-700">Código de verificación</label>
        <p className="text-xs text-slate-500">Abre tu app de autenticación e ingresa el código de 6 dígitos.</p>
        <input
          id="codigo-mfa" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
          value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} placeholder="123456"
          className="w-full rounded-xl border border-slate-300 bg-white py-3 text-center font-mono text-xl tracking-[0.4em] text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </div>
      <button type="submit" disabled={enviando || codigo.length !== 6}
        className="mt-2 w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
        style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 12px 26px -10px rgba(37,99,235,0.5)" }}>
        {enviando ? "Verificando…" : "Verificar"}
      </button>
      <button type="button" onClick={onCancelar} className="text-sm font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline cursor-pointer">
        Cancelar e iniciar sesión de nuevo
      </button>
    </form>
  )
}
