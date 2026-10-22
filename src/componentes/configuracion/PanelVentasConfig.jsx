"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { diasDePedido, DIAS_PEDIDO_POR_DEFECTO } from "../../utilidades/ventasModulo"

const CAMPO = "w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:bg-white"

// Configuración → Ventas: los días que suele tardar un pedido (lo que se encarga afuera, como las lunas) en estar listo. «Nueva venta» propone esa fecha aproximada y se puede cambiar en cada venta.
export default function PanelVentasConfig({ parametrizacion, setParametrizacion, onExito, onError }) {
  const actual = diasDePedido(parametrizacion)
  const [texto, setTexto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const dias = parseInt(texto ?? String(actual), 10)
  const error = !(dias >= 1 && dias <= 90) ? "Los días deben ser un número entre 1 y 90." : ""

  const guardar = async () => {
    if (error) { onError?.(error); return }
    setGuardando(true)
    const { error: errorGuardar } = (await setParametrizacion((prev) => ({ ...prev, diasPedido: dias }))) || {}
    setGuardando(false)
    if (errorGuardar) { onError?.("No se pudo guardar los días del pedido. Revisa tu conexión e intenta de nuevo."); return }
    setTexto(null)
    onExito?.("Días del pedido guardados correctamente.")
  }

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Package size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-sm font-bold" style={{ color: INK }}>Días que tarda un pedido en estar listo</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Cuando una venta incluye algo que se encarga afuera (como las lunas), «Nueva venta» propone esta fecha aproximada de entrega. Se puede cambiar en cada venta.
            </p>
          </div>

          <div className="space-y-1">
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Días por defecto
              <input type="number" min={1} max={90} inputMode="numeric" value={texto ?? String(actual)} aria-invalid={Boolean(error)} onChange={(e) => setTexto(e.target.value)} className={CAMPO} />
              días
            </label>
            <p className="text-xs leading-relaxed text-slate-500">Un pedido que pasa de su fecha sin estar listo aparece como «Atrasado». Por defecto son {DIAS_PEDIDO_POR_DEFECTO} días.</p>
            {error && <p role="alert" className="text-xs font-medium text-red-600">{error}</p>}
          </div>

          <button type="button" onClick={guardar} disabled={texto === null || guardando || Boolean(error)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD_MARCA }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}
