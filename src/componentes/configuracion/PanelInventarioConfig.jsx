"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { umbralStock, umbralMaximo, UMBRAL_STOCK_BAJO, UMBRAL_STOCK_MAXIMO, TOPE_STOCK } from "../../utilidades/inventario"
import { recordatorioDeConteo, DIAS_CONTEO_POR_DEFECTO, TOPE_DIAS_CONTEO } from "../../utilidades/recordatorioConteo"

const CAMPO = "w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:bg-white"

// Configuración → Inventario: el stock mínimo y el máximo GENERALES (para no hacerlo producto por producto). Cada producto puede «usar el general» o tener uno propio (se define al agregarlo o editarlo).
// El mínimo avisa «stock bajo»; el máximo avisa «sobrestock» y NO limita nada. Debajo, el recordatorio del conteo físico (cada N días, desactivable). Todo se guarda junto en la parametrización de la óptica.
export default function PanelInventarioConfig({ parametrizacion, setParametrizacion, onExito, onError }) {
  const minActual = umbralStock(parametrizacion)
  const maxActual = umbralMaximo(parametrizacion)
  const [minTexto, setMinTexto] = useState(null)
  const [maxTexto, setMaxTexto] = useState(null)
  const conteoActual = recordatorioDeConteo(parametrizacion)
  const [conteoActivo, setConteoActivo] = useState(null)
  const [conteoDiasTexto, setConteoDiasTexto] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const activo = conteoActivo ?? conteoActual.activo
  const diasConteo = parseInt(conteoDiasTexto ?? String(conteoActual.dias), 10)
  const errorConteo = activo && !(diasConteo >= 1 && diasConteo <= TOPE_DIAS_CONTEO) ? `Los días deben ser un número entre 1 y ${TOPE_DIAS_CONTEO}.` : ""
  const min = parseInt(minTexto ?? String(minActual), 10)
  const max = parseInt(maxTexto ?? String(maxActual), 10)
  const errorMin = !(min >= 0 && min <= TOPE_STOCK) ? `El mínimo debe ser un número entre 0 y ${TOPE_STOCK}.` : ""
  const errorMax = !(max >= 1 && max <= TOPE_STOCK) ? `El máximo debe ser un número entre 1 y ${TOPE_STOCK}.` : !errorMin && max <= min ? "El máximo debe ser mayor que el mínimo." : ""
  const cambio = minTexto !== null || maxTexto !== null || conteoActivo !== null || conteoDiasTexto !== null

  const guardar = async () => {
    if (errorMin || errorMax || errorConteo) { onError?.(errorMin || errorMax || errorConteo); return }
    setGuardando(true)
    const { error } = (await setParametrizacion((prev) => ({ ...prev, stockMinimo: min, stockMaximo: max, recordatorioConteo: { activo, dias: Number.isFinite(diasConteo) && diasConteo >= 1 ? diasConteo : conteoActual.dias } }))) || {}
    setGuardando(false)
    if (error) { onError?.("No se pudo guardar la configuración del inventario. Revisa tu conexión e intenta de nuevo."); return }
    setMinTexto(null); setMaxTexto(null); setConteoActivo(null); setConteoDiasTexto(null)
    onExito?.("Configuración del inventario guardada correctamente.")
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

          <div className="space-y-1 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center gap-2.5">
              <button type="button" role="switch" aria-checked={activo} aria-label="Recordar el conteo" onClick={() => setConteoActivo(!activo)} className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors" style={{ backgroundColor: activo ? "#2563EB" : "#e2e8f0" }}>
                <span className={"absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (activo ? "translate-x-[16px]" : "translate-x-0")} />
              </button>
              <label htmlFor="conteo-dias" className="text-sm font-medium text-slate-700">Recordar el conteo cada</label>
              <input id="conteo-dias" type="number" min={1} max={TOPE_DIAS_CONTEO} inputMode="numeric" disabled={!activo} value={conteoDiasTexto ?? String(conteoActual.dias)} aria-invalid={Boolean(errorConteo)} onChange={(e) => setConteoDiasTexto(e.target.value)} className={CAMPO + " disabled:opacity-50"} />
              <span className="text-sm font-medium text-slate-700">días</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-500">Cuando toca, aparece en «Requiere tu atención» del Inventario y del Inicio con «Imprimir hoja»; al generar la hoja de conteo, vuelve a contar desde ese día. Por defecto son {DIAS_CONTEO_POR_DEFECTO} días. Apagado, no avisa.</p>
            {errorConteo && <p role="alert" className="text-xs font-medium text-red-600">{errorConteo}</p>}
          </div>

          <button type="button" onClick={guardar} disabled={!cambio || guardando || Boolean(errorMin || errorMax || errorConteo)}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD_MARCA }}>
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}
