"use client"

import { useState } from "react"
import { FileText, AlertTriangle } from "lucide-react"
import { LEYENDA_INTERNO, normalizarFacturaElectronica, numeroComprobante } from "../utilidades/comprobantes"
import { Cascaron, PieFormulario } from "./AtencionPaciente"

// Cargar, corregir o quitar el número de la factura electrónica (SRI o proveedor) de un comprobante
// de venta interno. Se registra aparte porque la factura suele emitirse después de la venta.
export default function FacturaElectronicaModal({ factura, paciente, onGuardar, onCerrar }) {
  const [texto, setTexto] = useState(factura.facturaElectronica || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
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

  return (
    <Cascaron
      titulo="Factura electrónica (SRI)"
      subtitulo={`${numeroComprobante(factura.numero)}${paciente?.nombre ? ` · ${paciente.nombre}` : ""}`}
      Icono={FileText}
      ancho="max-w-md"
      onCerrar={() => { if (!guardando) onCerrar() }}
      formulario={{ onSubmit: guardar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Guardar número" guardando={guardando} />}
    >
      <div className="space-y-3 px-5 py-4">
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
          <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-sm font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {error}</div>
        )}
      </div>
    </Cascaron>
  )
}
