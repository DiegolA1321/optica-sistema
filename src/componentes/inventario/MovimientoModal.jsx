"use client"

import { useState } from "react"
import { AlertTriangle, ArrowDownToLine, SlidersHorizontal } from "lucide-react"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import { TIPOS_AJUSTE, cambioDeMovimiento, etiquetaMovimiento } from "../../utilidades/inventarioKardex"

const CAMPO = "w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 "
const OK = "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50"
const MAL = "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100"
const ETIQUETA = "mb-1.5 block text-sm font-semibold text-slate-700"

// "Registrar ingreso" (llegó mercadería: suma) y "Ajustar stock" (conteo, merma o devolución). El stock ya no se edita a mano sin motivo:
// los dos piden el motivo y dejan su movimiento en el kárdex con quién lo hizo.
export default function MovimientoModal({ modo, producto, sinAnimarFondo = false, onRegistrar, onCerrar }) {
  const esIngreso = modo === "ingreso"
  const [tipo, setTipo] = useState(esIngreso ? "ingreso_compra" : "ajuste_conteo")
  const existencia = Number(producto.stock) || 0
  const [cantidad, setCantidad] = useState(esIngreso ? "" : String(existencia))
  const [motivo, setMotivo] = useState(esIngreso && producto.proveedor ? `Compra a ${producto.proveedor}` : "")
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)

  const cambio = cambioDeMovimiento(tipo, cantidad, existencia)
  const resultante = cambio === null ? null : existencia + cambio
  const esConteo = tipo === "ajuste_conteo"

  const elegirTipo = (id) => {
    setTipo(id)
    setCantidad(id === "ajuste_conteo" ? String(existencia) : "")
    setErrores({})
  }

  const enviar = async (e) => {
    e.preventDefault()
    const errs = {}
    if (cantidad === "" || isNaN(Number(cantidad)) || Number(cantidad) < 0 || !Number.isInteger(Number(cantidad))) errs.cantidad = esConteo ? "Escribe las unidades que hay realmente (0 o más)." : "Escribe una cantidad entera mayor que cero."
    else if (cambio === null) errs.cantidad = esConteo ? "La existencia contada es igual a la del sistema: no hay nada que ajustar." : "Escribe una cantidad mayor que cero."
    else if (resultante < 0) errs.cantidad = `Solo hay ${existencia} unidades: no se pueden quitar ${Math.abs(cambio)}.`
    if (motivo.trim().length < 3) errs.motivo = "Escribe el motivo: queda registrado en el historial."
    setErrores(errs)
    if (Object.keys(errs).length > 0) return
    setGuardando(true)
    const error = await onRegistrar({ tipo, cambio, motivo: motivo.trim() })
    setGuardando(false)
    if (error) setErrores({ general: error })
  }

  return (
    <Cascaron
      titulo={esIngreso ? "Registrar ingreso" : "Ajustar stock"} subtitulo={producto.nombre} Icono={esIngreso ? ArrowDownToLine : SlidersHorizontal} ancho="max-w-md" sinAnimarFondo={sinAnimarFondo}
      onCerrar={onCerrar} formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar={esIngreso ? "Registrar ingreso" : "Guardar ajuste"} guardando={guardando} nota="Queda en el historial del producto." />}
    >
      <div className="space-y-4 p-6">
        {!esIngreso && (
          <fieldset>
            <legend className={ETIQUETA}>¿Qué pasó?</legend>
            <div className="grid gap-2">
              {TIPOS_AJUSTE.map((t) => (
                <label key={t.id} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (tipo === t.id ? "border-blue-400 bg-blue-50/60" : "border-slate-200/60 hover:bg-slate-50")}>
                  <input type="radio" name="tipo-ajuste" value={t.id} checked={tipo === t.id} onChange={() => elegirTipo(t.id)} className="mt-0.5 accent-blue-600" />
                  <span><span className="block text-sm font-semibold text-slate-700">{t.etiqueta}</span><span className="block text-xs text-slate-500">{t.ayuda}</span></span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <div>
          <label htmlFor="mov-cantidad" className={ETIQUETA}>{esIngreso ? "Unidades recibidas" : esConteo ? "Unidades que hay realmente" : "Unidades"}</label>
          <input id="mov-cantidad" type="number" min="0" step="1" required autoFocus value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={esIngreso ? "5" : ""} className={CAMPO + (errores.cantidad ? MAL : OK)} />
          {errores.cantidad && <p className="mt-1 text-xs font-medium text-red-600">{errores.cantidad}</p>}
        </div>
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600" aria-live="polite">
          Existencia: <strong className="text-slate-800">{existencia}</strong>
          {resultante !== null && resultante >= 0 && <> → <strong className="text-slate-800">{resultante}</strong> <span className={cambio > 0 ? "text-emerald-700" : "text-red-600"}>({cambio > 0 ? "+" : "−"}{Math.abs(cambio)} · {etiquetaMovimiento(tipo).toLowerCase()})</span></>}
        </p>
        <div>
          <label htmlFor="mov-motivo" className={ETIQUETA}>{esIngreso ? "Motivo o referencia" : "Motivo"} <span className="font-normal text-slate-500">(obligatorio)</span></label>
          <input id="mov-motivo" type="text" required maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder={esIngreso ? "Ej. Factura de compra 001-123" : esConteo ? "Ej. Faltaban dos en el estante" : tipo === "merma" ? "Ej. Se rompió al limpiarla" : "Ej. Llegó con defecto de fábrica"} className={CAMPO + (errores.motivo ? MAL : OK)} />
          {errores.motivo && <p className="mt-1 text-xs font-medium text-red-600">{errores.motivo}</p>}
        </div>
        {errores.general && (
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {errores.general}</div>
        )}
      </div>
    </Cascaron>
  )
}
