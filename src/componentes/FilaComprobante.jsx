"use client"

import { Check } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { dinero } from "../utilidades/formatoMoneda"
import { fechaLegible } from "../utilidades/formatoFecha"
import { numeroComprobante } from "../utilidades/comprobantes"
import { estadoDeComprobante } from "../utilidades/saldosVentas"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { Insignia } from "./ventas/Lista"
import { COLUMNAS_COMPROBANTES, COLUMNAS_COMPROBANTES_PERFIL, CLASE_ACCION_PRINCIPAL } from "./ventas/estilos"

const TONO = { pagada: "verde", saldo: "ambar", anulada: "gris" }

// Una fila de comprobante de venta, la misma en la lista de Ventas y en el perfil del paciente (regla 18): número, fecha, paciente, total, estado
// y si tiene factura electrónica. Una sola acción de contexto ("Abonar", si tiene saldo); todo lo demás está en el detalle, que abre al pulsar la fila.
export default function FilaComprobante({ factura: f, abonos = [], paciente = null, mostrarPaciente = false, puedeEditar = false, onAbonar, onAbrir, onVerPaciente }) {
  const estado = estadoDeComprobante(f, abonos)
  const anulada = estado.id === "anulada"
  return (
    <li data-fila className={"relative grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-slate-50/70 lg:items-center " + (mostrarPaciente ? COLUMNAS_COMPROBANTES : COLUMNAS_COMPROBANTES_PERFIL)}>
      <button type="button" onClick={() => onAbrir?.(f)} aria-label={`Ver el comprobante ${numeroComprobante(f.numero)}`} className="text-left font-mono text-sm font-bold after:absolute after:inset-0 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{numeroComprobante(f.numero)}</button>
      <p className="text-sm text-slate-600">{fechaLegible(diaDeRegistro(f.creadoEn)) || "—"}</p>
      {mostrarPaciente && (
        <div className="min-w-0">
          {onVerPaciente && paciente
            ? <button type="button" onClick={() => onVerPaciente(paciente)} title={paciente.nombre} className="relative z-10 block max-w-full truncate text-left text-sm font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{paciente.nombre}</button>
            : <p className="truncate text-sm font-bold" title={paciente?.nombre} style={{ color: INK }}>{paciente?.nombre || "Paciente"}</p>}
        </div>
      )}
      <p data-col="monto" className={"font-mono text-sm lg:text-right " + (anulada ? "text-slate-400 line-through" : "font-semibold text-slate-800")}>{dinero(f.montoTotal)}</p>
      <div data-col="estado" className="min-w-0"><Insignia tono={TONO[estado.id]}>{estado.id === "saldo" ? `Con saldo ${dinero(estado.saldo)}` : estado.etiqueta}</Insignia></div>
      <p className="min-w-0 truncate text-sm" title={f.facturaElectronica || undefined}>
        {anulada ? <span className="text-slate-400">—</span> : f.facturaElectronica
          ? <span className="inline-flex items-center gap-1 text-slate-600"><Check size={14} className="text-emerald-600" aria-hidden="true" /> Con factura electrónica</span>
          : <span className="text-slate-400">Sin factura electrónica</span>}
      </p>
      <div className="relative z-10 flex justify-end">
        {estado.id === "saldo" && puedeEditar && <button type="button" onClick={() => onAbonar?.(f)} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Abonar</button>}
      </div>
    </li>
  )
}
