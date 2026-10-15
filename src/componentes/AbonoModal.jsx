import CampoFecha from "./CampoFecha"
"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { hoyISO } from "../utilidades/disponibilidad"
import { diaDeRegistro } from "../utilidades/periodoLista"
import { useState } from "react"
import { Wallet } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { registrarLog } from "../utilidades/logs"
import { abonoSugerido, mapAbono, saldoFactura, totalAbonado, EVENTO_ABONO } from "../utilidades/abonos"
import { filasParaTotal, revisarPagos, textoPagos } from "../utilidades/pagos"
import { numeroComprobante } from "../utilidades/comprobantes"
import { Cascaron, PieFormulario } from "./AtencionPaciente"
import CamposPagos, { FILAS_INICIALES } from "./ventas/CamposPagos"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

// Registrar un abono de monto y fecha libres sobre una venta con saldo (R38), pagado con uno o varios métodos a la vez.
// Si la venta es un plan de cuotas y se abona justo el valor de la cuota, cuenta como cuota pagada.
export default function AbonoModal({ factura, paciente, abonos, usuario, onRegistrado, onCerrar }) {
  const saldo = saldoFactura(factura, abonos)
  const sugerido = abonoSugerido(factura, abonos)
  const [monto, setMonto] = useState(sugerido ? String(sugerido) : "")
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState("")
  const [filas, setFilas] = useState(FILAS_INICIALES)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const fechaVenta = diaDeRegistro(factura.creadoEn)
  const valor = Math.round((parseFloat(monto) || 0) * 100) / 100

  const confirmar = async (e) => {
    e.preventDefault()
    if (!(valor > 0)) { setError("Escribe un monto mayor que cero."); return }
    if (valor > saldo) { setError(`El abono no puede superar el saldo pendiente (${dinero(saldo)}).`); return }
    if (!fecha || fecha > hoyISO()) { setError("La fecha del abono no puede ser futura."); return }
    if (fechaVenta && fecha < fechaVenta) { setError("La fecha del abono no puede ser anterior a la de la venta."); return }
    const revision = revisarPagos(filasParaTotal(filas, valor), valor)
    if (revision.error) { setError(revision.error); return }
    setGuardando(true)
    setError("")
    let resultado = { estado: valor >= saldo ? "pagada" : "pendiente_pago", cuotasPagadas: factura.cuotasPagadas }
    if (supabase) {
      const esCuota = factura.metodoPago === "cuotas" && valor === sugerido && fecha === hoyISO() && !nota.trim()
      const { data, error: errorRpc } = esCuota
        ? await supabase.rpc("registrar_pago_cuota_venta", { p_factura_id: factura.id, p_pagos: revision.pagos }).single()
        : await supabase.rpc("registrar_abono", { p_factura_id: factura.id, p_monto: valor, p_fecha: fecha, p_nota: nota.trim() || null, p_pagos: revision.pagos }).single()
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo registrar el abono. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
      resultado = { estado: data.estado, cuotasPagadas: esCuota ? data.cuotas_pagadas : data.estado === "pagada" && factura.cuotasTotales ? factura.cuotasTotales : factura.cuotasPagadas }
      // Se vuelven a leer los abonos de esta venta para que la lista refleje exactamente lo guardado.
      const { data: filasLeidas } = await supabase.from("abonos_factura").select("*").eq("factura_id", factura.id)
      ;(filasLeidas || []).forEach((f) => window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(f) })))
    }
    registrarLog(usuario, "ventas", "Registró un abono", `${paciente?.nombre || ""} · ${numeroComprobante(factura.numero)} · ${dinero(valor)} · ${textoPagos(revision.pagos)}`)
    setGuardando(false)
    onRegistrado?.({ monto: valor, ...resultado })
    onCerrar()
  }

  return (
    <Cascaron
      titulo="Registrar abono"
      subtitulo={`${paciente?.nombre || "Paciente"} · ${numeroComprobante(factura.numero)}`}
      Icono={Wallet}
      ancho="max-w-lg"
      onCerrar={() => { if (!guardando) onCerrar() }}
      formulario={{ onSubmit: confirmar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Registrar abono" guardando={guardando} />}
    >
      <div className="space-y-4 px-5 py-4">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[["Total", dinero(factura.montoTotal)], ["Abonado", dinero(totalAbonado(factura.id, abonos))], ["Saldo", dinero(saldo)]].map(([k, v], i) => (
            <div key={k} className={"rounded-xl border px-2 py-2 " + (i === 2 ? "border-amber-200/60 bg-amber-50" : "border-slate-200/60 bg-slate-50")}>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
              <dd className={"font-mono text-base font-bold " + (i === 2 ? "text-amber-700" : "text-slate-800")}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Monto *</span>
            <input type="number" min="0.01" step="0.01" max={saldo} value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus className={CAMPO + " text-right font-mono"} />
          </label>
          <div className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Fecha *</span>
            <CampoFecha id="abono-fecha" etiqueta="Fecha del abono" valor={fecha} onCambiar={setFecha} min={fechaVenta || ""} max={hoyISO()} />
          </div>
        </div>
        <button type="button" onClick={() => setMonto(String(saldo))} className="text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">Pagar el saldo completo ({dinero(saldo)})</button>

        <CamposPagos filas={filas} onChange={setFilas} total={valor} idBase="abono" />

        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nota (opcional)</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} placeholder="Ej. número de transferencia" className={CAMPO} />
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
