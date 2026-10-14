"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { Wallet } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { numeroOrden } from "../utilidades/ordenesLaboratorio"
import { Cascaron } from "./AtencionPaciente"

// Al entregar una orden con la venta sin pagar por completo: se muestra el saldo
// para cobrarlo antes de entregar (o entregar igual, a conciencia).
export default function EntregaConSaldoModal({ orden, paciente, saldo, saldoTotal, puedeCobrar, onCobrar, onEntregar, onCancelar }) {
  return (
    <Cascaron
      titulo="Hay un saldo por cobrar"
      subtitulo={`${numeroOrden(orden.numero)} · ${paciente?.nombre || "Paciente"}`}
      Icono={Wallet}
      ancho="max-w-md"
      onCerrar={onCancelar}
      pie={(
        <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
          <button type="button" onClick={onEntregar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Entregar de todos modos</button>
          {puedeCobrar && <button type="button" onClick={onCobrar} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD_MARCA }}>Cobrar abono</button>}
        </div>
      )}
    >
      <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
        <p>Esta venta tiene <span className="font-bold text-amber-700">{dinero(saldo)}</span> pendientes. Cóbralos antes de entregar los lentes.</p>
        {saldoTotal > saldo + 0.004 && <p className="text-slate-500">En total, el paciente debe {dinero(saldoTotal)} en todas sus ventas.</p>}
      </div>
    </Cascaron>
  )
}
