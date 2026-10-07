"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, FileText, AlertTriangle } from "lucide-react"
import { INK } from "@/lib/tema"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { LEYENDA_INTERNO, normalizarFacturaElectronica, numeroComprobante } from "../utilidades/comprobantes"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Cargar, corregir o quitar el número de la factura electrónica (SRI o proveedor) de un comprobante
// de venta interno. Se registra aparte porque la factura suele emitirse después de la venta.
export default function FacturaElectronicaModal({ factura, paciente, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState(factura.facturaElectronica || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const refModal = useModalAccesible(true, () => { if (!guardando) onCerrar() })
  const fe = normalizarFacturaElectronica(texto)

  const guardar = async (e) => {
    e.preventDefault()
    if (fe.demasiadoLargo) { setError("El número es demasiado largo (máximo 60 caracteres)."); return }
    setGuardando(true)
    setError("")
    const { error: errorGuardar } = await onGuardar(factura, fe.valor)
    setGuardando(false)
    if (errorGuardar) { setError(errorGuardar); return }
    onCerrar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => { if (!guardando) onCerrar() }}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-labelledby="fe-titulo" className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: GRAD }}><FileText size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="fe-titulo" className="text-lg font-bold" style={{ color: INK }}>Factura electrónica (SRI)</h2>
              <p className="text-xs text-slate-500">{numeroComprobante(factura.numero)}{paciente?.nombre ? ` · ${paciente.nombre}` : ""}</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} disabled={guardando} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
        </div>
        <form onSubmit={guardar} className="space-y-3 p-5">
          <div>
            <label htmlFor="fe-numero" className="mb-1.5 block text-sm font-semibold text-slate-700">Número de la factura electrónica</label>
            <input id="fe-numero" type="text" autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} onBlur={() => setTexto((v) => normalizarFacturaElectronica(v).valor)} placeholder="001-001-000000123"
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
            {texto.trim() && !fe.formatoSri ? (
              <p className="mt-1 text-xs text-amber-700">No tiene el formato 001-001-000000123 del SRI. Puedes guardarlo igual si tu proveedor lo numera distinto.</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Déjalo vacío para quitar el número. {LEYENDA_INTERNO}</p>
            )}
          </div>
          {error && (
            <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} /> {error}</div>
          )}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onCerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer">Cancelar</button>
            <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:opacity-60 cursor-pointer" style={{ background: INK }}>{guardando ? "Guardando..." : "Guardar número"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
