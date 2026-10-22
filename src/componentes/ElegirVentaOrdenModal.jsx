"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { FlaskConical, ChevronRight, ShoppingCart } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { Cascaron } from "./AtencionPaciente"

// Una orden de laboratorio sale de una venta (ahí están la montura y la luna). Esta ventana deja elegir de cuál:
// con una sola venta se abre directo, así que aquí solo se llega cuando hay que elegir o cuando todavía no hay ninguna.
export default function ElegirVentaOrdenModal({ paciente, comprobantes, ordenes, onElegir, onNuevaVenta, onCerrar }) {
  const ventas = comprobantes.filter((c) => c.factura && c.factura.estado !== "anulada")
  const descripcion = (f) => (f.lineas || []).map((l) => l.descripcion).filter(Boolean).join(", ") || "Venta"
  return (
    <Cascaron
      titulo="Crear pedido"
      subtitulo={`${paciente.nombre} · elige la venta de la que sale el pedido`}
      Icono={FlaskConical}
      ancho="max-w-lg"
      etiqueta="Crear pedido"
      onCerrar={onCerrar}
      pie={<><span /><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button></>}
    >
      {ventas.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 px-5 py-8 text-center">
          <div className="mb-1 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-cyan-50 to-blue-100 text-blue-600"><ShoppingCart size={24} aria-hidden="true" /></div>
          <p className="text-sm font-bold" style={{ color: INK }}>Aún no hay una venta para enviar</p>
          <p className="max-w-sm text-sm text-slate-500">El pedido lleva la montura y la luna de una venta. Registra primero la venta del paciente.</p>
          <button type="button" onClick={onNuevaVenta} className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD_MARCA }}><ShoppingCart size={14} aria-hidden="true" /> Nueva venta</button>
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
                    <span className="block truncate text-sm text-slate-500" title={descripcion(f)}>{descripcion(f)}</span>
                    {nOrdenes > 0 && <span className="block text-xs text-slate-500">Ya tiene {nOrdenes} pedido{nOrdenes === 1 ? "" : "s"}</span>}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Cascaron>
  )
}
