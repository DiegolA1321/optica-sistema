"use client"

import { CheckCircle, CreditCard, FileText } from "lucide-react"
import { fechaLegible } from "../utilidades/formatoFecha"
import { saldoFactura, totalAbonado } from "../utilidades/abonos"
import { METODOS_PAGO } from "../utilidades/ventas"
import { numeroComprobante } from "../utilidades/comprobantes"

// Una fila de comprobante de venta interno: la misma en la lista de Ventas y en el perfil del paciente.
// Las acciones aparecen solo si quien mira tiene el nivel (el permiso real lo exige la base).
export default function FilaComprobante({
  factura: f, abonos = [], ordenes = [], paciente = null, mostrarPaciente = false,
  puedeEditar = false, puedeVender = false, puedeAnular = false,
  onAbonar, onOrden, onAnular, onFacturaElectronica, onVerPaciente,
}) {
  const saldo = saldoFactura(f, abonos)
  const abonado = totalAbonado(f.id, abonos)
  const anulada = f.estado === "anulada"
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={"text-sm font-semibold " + (anulada ? "text-slate-400 line-through" : "text-slate-800")}>
          <span className="mr-1.5 font-mono text-xs font-bold text-slate-500">{numeroComprobante(f.numero)}</span>
          ${f.montoTotal.toFixed(2)} · {METODOS_PAGO[f.metodoPago] || f.metodoPago}{f.metodoPago === "cuotas" && f.cuotasTotales ? ` (${f.cuotasPagadas || 0}/${f.cuotasTotales})` : ""} · {fechaLegible(f.creadoEn)}
        </p>
        {mostrarPaciente && (
          <p className="text-xs font-semibold text-slate-600">
            {onVerPaciente && paciente ? (
              <button type="button" onClick={() => onVerPaciente(paciente)} className="transition-colors hover:text-blue-700 cursor-pointer">{paciente.nombre}</button>
            ) : (paciente?.nombre || "Paciente")}
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          {(f.lineas || []).map((l) => l.descripcion).join(", ") || "Sin detalle"}
          {f.estado === "pendiente_pago" && ` · abonado $${abonado.toFixed(2)}`}
          {ordenes.length > 0 && ` · ${ordenes.length} orden${ordenes.length === 1 ? "" : "es"} de laboratorio`}
        </p>
        {f.facturaElectronica ? (
          <p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
            <FileText size={11} aria-hidden="true" /> Factura electrónica <span className="font-mono font-semibold text-slate-600">{f.facturaElectronica}</span>
            {puedeEditar && !anulada && <button type="button" onClick={() => onFacturaElectronica?.(f)} className="ml-1 font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Corregir</button>}
          </p>
        ) : (
          !anulada && puedeEditar && <button type="button" onClick={() => onFacturaElectronica?.(f)} className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"><FileText size={11} aria-hidden="true" /> Registrar factura electrónica</button>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {anulada ? (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">Anulada</span>
        ) : f.estado === "pagada" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle size={12} aria-hidden="true" /> Pagada</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><CreditCard size={12} aria-hidden="true" /> Saldo ${saldo.toFixed(2)}</span>
            {puedeEditar && <button type="button" onClick={() => onAbonar?.(f)} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer">Abonar</button>}
          </>
        )}
        {!anulada && puedeVender && (
          <button type="button" onClick={() => onOrden?.(f)} className="rounded-lg border border-slate-200/60 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">{ordenes.length > 0 ? "Otra orden" : "Crear orden"}</button>
        )}
        {!anulada && puedeAnular && (
          <button type="button" onClick={() => onAnular?.(f)} className="rounded-lg border border-slate-200/60 px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer">Anular</button>
        )}
      </div>
    </li>
  )
}
