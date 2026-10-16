import { useState } from "react"
import { Eye, EyeOff, Info, Lock } from "lucide-react"

// La contraseña temporal de una cuenta nueva (Usuarios y Agregar superadmin): por defecto la genera el sistema y se ve una sola vez;
// quien prefiera puede escribirla (debe cumplir la regla de contraseñas del sistema, que valida `resolverClaveTemporal`).
// En los dos casos la persona la cambia en su primer ingreso, y el campo no se autocompleta con datos guardados del navegador.
export default function CampoClaveTemporal({ escribir, onEscribir, valor, onValor, id = "clave-temporal" }) {
  const [ver, setVer] = useState(false)
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
        <input type="checkbox" checked={escribir} onChange={(e) => onEscribir(e.target.checked)} className="h-4 w-4 accent-blue-600" />
        Escribir la contraseña temporal
      </label>
      {escribir ? (
        <div>
          <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña temporal</label>
          <div className="relative">
            <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id={id} type={ver ? "text" : "password"} value={valor} onChange={(e) => onValor(e.target.value)}
              autoComplete="new-password" placeholder="8 o más, con letra y número"
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-9 pr-9 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
            />
            <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer">{ver ? <EyeOff size={16} /> : <Eye size={16} />}</button>
          </div>
          <p className="mt-1.5 text-xs text-slate-500">La persona la cambia al entrar por primera vez.</p>
        </div>
      ) : (
        <div className="flex items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 text-slate-600"><Info size={17} className="mt-0.5 shrink-0" aria-hidden="true" /><p className="text-xs leading-relaxed">La contraseña la genera el sistema: la verás una sola vez al crear la cuenta, y la persona elige la suya al entrar.</p></div>
      )}
    </div>
  )
}
