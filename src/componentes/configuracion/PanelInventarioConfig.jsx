"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { umbralStock, umbralMaximo, UMBRAL_STOCK_BAJO, UMBRAL_STOCK_MAXIMO, TOPE_STOCK } from "../../utilidades/inventario"

const CAMPO = "w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:bg-white"

// Configuración → Inventario: el stock mínimo y el máximo GENERALES (para no hacerlo producto por producto). Cada producto puede «usar el general» o tener uno propio (se define al agregarlo o editarlo).
// El mínimo avisa «stock bajo»; el máximo avisa «sobrestock» y NO limita nada. Se guardan juntos en la parametrización de la óptica.
export default function PanelInventarioConfig({ parametrizacion, setParametrizacion, onExito, onError }) {
  const minActual = umbralStock(parametrizacion)
  const maxActual = umbralMaximo(parametrizacion)
  const [minTexto, setMinTexto] = useState(null)
  const [maxTexto, setMaxTexto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const min = parseInt(minTexto ?? String(minActual), 10)
  const max = parseInt(maxTexto ?? String(maxActual), 10)
  const errorMin = !(min >= 0 && min <= TOPE_STOCK) ? `El mínimo debe ser un número entre 0 y ${TOPE_STOCK}.` : ""
  const errorMax = !(max >= 1 && max <= TOPE_STOCK) ? `El máximo debe ser un número entre 1 y ${TOPE_STOCK}.` : !errorMin && max <= min ? "El máximo debe ser mayor que el mínimo." : ""
  const cambio = minTexto !== null || maxTexto !== null

  const guardar = async () => {
    if (errorMin || errorMax) { onError?.(errorMin || errorMax); return }
    setGuardando(true)
    const { error } = (await setParametrizacion((prev) => ({ ...prev, stockMinimo: min, stockMaximo: max }))) || {}
    setGuardando(false)
    if (error) { onError?.("No se pudo guardar el stock mínimo y máximo. Revisa tu conexión e intenta de nuevo."); return }
    setMinTexto(null); setMaxTexto(null)
    onExito?.("Stock mínimo y máximo guardados correctamente.")
  }

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Package size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <p className="text-sm font-bold" style={{ color: INK }}>Stock mínimo y máximo de todos los productos</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Valen para todos los productos que no tengan los suyos (se definen al agregar o editar el producto, con «Usar el general»). Así no hay que ponerlos uno por uno.
            </p>
          </div>

          <div className="space-y-1">
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Stock mínimo
              <input type="number" min={0} max={TOPE_STOCK} inputMode="numeric" value={minTexto ?? String(minActual)} aria-invalid={Boolean(errorMin)} onChange={(e) => setMinTexto(e.target.value)} className={CAMPO} />
              unidades
            </label>
            <p className="text-xs leading-relaxed text-slate-500">Un producto con esta cantidad o menos aparece como «stock bajo» en Inicio, Inventario y los avisos. Por defecto es {UMBRAL_STOCK_BAJO}.</p>
            {errorMin && <p role="alert" className="text-xs font-medium text-red-600">{errorMin}</p>}
          </div>

          <div className="space-y-1">
            <label className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-700">
              Stock máximo
              <input type="number" min={1} max={TOPE_STOCK} inputMode="numeric" value={maxTexto ?? String(maxActual)} aria-invalid={Boolean(errorMax)} onChange={(e) => setMaxTexto(e.target.value)} className={CAMPO} />
              unidades
            </label>
            <p className="text-xs leading-relaxed text-slate-500">Un producto con más unidades que esto aparece como «sobrestock» y, al registrar un ingreso que lo pase, se avisa antes. Solo avisa: no limita las ventas ni los ingresos. Por defecto es {UMBRAL_STOCK_MAXIMO}.</p>
            {errorMax && <p role="alert" className="text-xs font-medium text-red-600">{errorMax}</p>}
          </div>

          <button type="button" onClick={guardar} disabled={!cambio || guardando || Boolean(errorMin || errorMax)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD_MARCA }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}
