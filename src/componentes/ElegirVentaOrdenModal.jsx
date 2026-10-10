"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { createPortal } from "react-dom"
import { FlaskConical, X, ChevronRight, ShoppingCart } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { useModalAccesible } from "../utilidades/useModalAccesible"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Una orden de laboratorio sale de una venta (ahí están la montura y la luna). Esta ventana deja elegir de cuál:
// con una sola venta se abre directo, así que aquí solo se llega cuando hay que elegir o cuando todavía no hay ninguna.
export default function ElegirVentaOrdenModal({ paciente, comprobantes, ordenes, onElegir, onNuevaVenta, onCerrar }) {
  const refModal = useModalAccesible(true, onCerrar)
  const ventas = comprobantes.filter((c) => c.factura && c.factura.estado !== "anulada")
  const descripcion = (f) => (f.lineas || []).map((l) => l.descripcion).filter(Boolean).join(", ") || "Venta"
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-label="Enviar a laboratorio" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD }}><FlaskConical size={20} aria-hidden="true" /></div>
            <div className="min-w-0">
              <h2 className="text-lg font-bold leading-tight" style={{ color: INK }}>Enviar a laboratorio</h2>
              <p className="truncate text-xs text-slate-500">{paciente.nombre} · elige la venta de la que sale el pedido</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {ventas.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
              <div className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 text-blue-600"><ShoppingCart size={24} aria-hidden="true" /></div>
              <p className="text-sm font-bold" style={{ color: INK }}>Aún no hay una venta para enviar</p>
              <p className="max-w-sm text-xs text-slate-500">El pedido al laboratorio lleva la montura y la luna de una venta. Registra primero la venta del paciente.</p>
              <button type="button" onClick={onNuevaVenta} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}><ShoppingCart size={14} aria-hidden="true" /> Nueva venta</button>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 px-2 py-1">
              {ventas.map((c) => {
                const f = c.factura
                const nOrdenes = ordenes.filter((o) => o.facturaId === f.id).length
                return (
                  <li key={f.id}>
                    <button type="button" onClick={() => onElegir(f)} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold" style={{ color: INK }}>Venta del {fechaLegible(String(f.creadoEn).slice(0, 10))} · {dinero(Number(f.montoTotal))}</span>
                        <span className="block truncate text-xs text-slate-500">{descripcion(f)}</span>
                        {nOrdenes > 0 && <span className="block text-xs text-slate-500">Ya tiene {nOrdenes} orden{nOrdenes === 1 ? "" : "es"} de laboratorio</span>}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 justify-end border-t border-slate-100 px-5 py-3">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
