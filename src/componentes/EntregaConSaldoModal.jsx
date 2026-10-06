"use client"

import { createPortal } from "react-dom"
import { Wallet } from "lucide-react"
import { INK } from "@/lib/tema"
import { numeroOrden } from "../utilidades/ordenesLaboratorio"
import { useModalAccesible } from "../utilidades/useModalAccesible"

const dinero = (n) => `$${(Number(n) || 0).toFixed(2)}`

// Al marcar una orden como "entregada" con la venta sin pagar por completo: se muestra el saldo
// para cobrarlo antes de entregar (o entregar igual, a conciencia).
export default function EntregaConSaldoModal({ orden, paciente, saldo, saldoTotal, puedeCobrar, onCobrar, onEntregar, onCancelar }) {
  const refModal = useModalAccesible(true, onCancelar)
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCancelar}>
      <div ref={refModal} role="alertdialog" aria-modal="true" aria-labelledby="entrega-saldo-titulo" className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-600"><Wallet size={19} aria-hidden="true" /></span>
          <div>
            <h2 id="entrega-saldo-titulo" className="text-base font-bold" style={{ color: INK }}>Hay un saldo por cobrar</h2>
            <p className="text-xs text-slate-500">{numeroOrden(orden.numero)} · {paciente?.nombre}</p>
          </div>
        </div>
        <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
          <p>Esta venta tiene <span className="font-bold text-amber-700">{dinero(saldo)}</span> pendientes. Cóbralos antes de entregar los lentes.</p>
          {saldoTotal > saldo + 0.004 && <p className="text-xs text-slate-500">En total, el paciente debe {dinero(saldoTotal)} en todas sus ventas.</p>}
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-5 py-4">
          {puedeCobrar && <button type="button" onClick={onCobrar} className="rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer">Cobrar abono</button>}
          <button type="button" onClick={onEntregar} className="rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Entregar de todos modos</button>
          <button type="button" onClick={onCancelar} className="py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-slate-700 cursor-pointer">Cancelar</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
