import React from "react"
import { Wallet } from "lucide-react"
import { INK } from "@/lib/tema"
import { formatoFecha } from "../utilidades/formatoFecha"

// Lo que compró el paciente, para quien no tiene Ventas "ver": producto y fecha, nada más (sin montos, pagos, saldos ni comprobantes).
// El servidor solo le entrega eso (función compras_de_paciente, migración 0118).
export default function ComprasBasicas({ lista = [], cargando = false }) {
  if (cargando) return <div className="space-y-2" aria-busy="true" aria-label="Cargando las compras">{[0, 1].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-200/70" />)}</div>
  if (lista.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Wallet size={22} aria-hidden="true" /></div>
        <p className="text-sm font-medium text-slate-500">Este paciente todavía no tiene compras registradas.</p>
      </div>
    )
  }
  return (
    <section aria-label="Compras que ve este rol">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Compras</h3>
      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white">
        {lista.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold" style={{ color: INK }}>{c.productos.map((p) => (p.cantidad > 1 ? `${p.cantidad} × ${p.descripcion}` : p.descripcion)).join(" · ") || "Compra"}</span>
            <span className="text-sm text-slate-500">{formatoFecha(c.fecha, "medio")}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-slate-500">Los comprobantes, los pagos y los saldos los ve quien tiene el módulo Ventas.</p>
    </section>
  )
}
