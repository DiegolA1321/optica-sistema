"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { useState } from "react"
import { CheckCircle, CreditCard, ChevronRight, FileText } from "lucide-react"
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
  lineasDesplegables = false,
}) {
  const [abierta, setAbierta] = useState(false)
  const saldo = saldoFactura(f, abonos)
  const abonado = totalAbonado(f.id, abonos)
  const anulada = f.estado === "anulada"
  return (
    <li className="px-4 py-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className={"text-sm font-semibold " + (anulada ? "text-slate-400 line-through" : "text-slate-800")}>
          <span className="mr-1.5 font-mono text-xs font-bold text-slate-500">{numeroComprobante(f.numero)}</span>
          {dinero(f.montoTotal)} · {METODOS_PAGO[f.metodoPago] || f.metodoPago}{f.metodoPago === "cuotas" && f.cuotasTotales ? ` (${f.cuotasPagadas || 0}/${f.cuotasTotales})` : ""} · {fechaLegible(f.creadoEn)}
        </p>
        {mostrarPaciente && (
          <p className="text-xs font-semibold text-slate-600">
            {onVerPaciente && paciente ? (
              <button type="button" onClick={() => onVerPaciente(paciente)} className="transition-colors hover:text-blue-700 cursor-pointer">{paciente.nombre}</button>
            ) : (paciente?.nombre || "Paciente")}
          </p>
        )}
        <p className="text-[11px] text-slate-500">
          {!lineasDesplegables && ((f.lineas || []).map((l) => l.descripcion).join(", ") || "Sin detalle")}
          {f.estado === "pendiente_pago" && `${lineasDesplegables ? "" : " · "}abonado ${dinero(abonado)}`}
          {ordenes.length > 0 && `${lineasDesplegables && f.estado !== "pendiente_pago" ? "" : " · "}${ordenes.length} orden${ordenes.length === 1 ? "" : "es"} de laboratorio`}
        </p>
        {lineasDesplegables && (
          <button type="button" onClick={() => setAbierta((v) => !v)} aria-expanded={abierta} className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">
            <ChevronRight size={12} aria-hidden="true" className={"transition-transform " + (abierta ? "rotate-90" : "")} />
            {abierta ? "Ocultar" : "Ver"} {(f.lineas || []).length} {(f.lineas || []).length === 1 ? "línea" : "líneas"}
          </button>
        )}
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
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700"><CreditCard size={12} aria-hidden="true" /> Saldo {dinero(saldo)}</span>
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
    </div>
    {lineasDesplegables && abierta && (
      <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200/60 bg-slate-50/60" aria-label="Líneas del comprobante">
        {(f.lineas || []).map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 px-3 py-1.5 text-xs">
            <span className="min-w-0 truncate text-slate-700">{l.descripcion}{l.cantidad > 1 ? ` (${l.cantidad})` : ""} <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{l.tipo === "servicio" ? "Servicio" : "Producto"}</span></span>
            <span className="shrink-0 font-semibold text-slate-700">{dinero((l.cantidad * Number(l.precioUnitario)))}</span>
          </li>
        ))}
      </ul>
    )}
    </li>
  )
}
