"use client"

import { hoyISO, fechaAISO } from "../utilidades/disponibilidad"
import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Wallet } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { registrarLog } from "../utilidades/logs"
import { abonosDeFactura, abonoSugerido, mapAbono, saldoFactura, totalAbonado, EVENTO_ABONO } from "../utilidades/abonos"

const GRAD = "linear-gradient(135deg,#059669,#10B981)"
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus-visible:border-emerald-500 focus-visible:bg-white"
const dinero = (n) => `$${(Number(n) || 0).toFixed(2)}`

// Registrar un abono de monto y fecha libres sobre una venta con saldo (R38).
// Si la venta es un plan de cuotas y se abona justo el valor de la cuota, cuenta como cuota pagada.
export default function AbonoModal({ factura, paciente, abonos, usuario, onRegistrado, onCerrar }) {
  const saldo = saldoFactura(factura, abonos)
  const sugerido = abonoSugerido(factura, abonos)
  const [monto, setMonto] = useState(sugerido ? sugerido.toFixed(2) : "")
  const [fecha, setFecha] = useState(hoyISO())
  const [nota, setNota] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }
  const refModal = useModalAccesible(true, cerrar)
  const historial = abonosDeFactura(factura.id, abonos)
  const fechaVenta = (() => { const d = new Date(factura.creadoEn); return Number.isNaN(d.getTime()) ? "" : fechaAISO(d) })()

  const confirmar = async (e) => {
    e.preventDefault()
    const valor = Math.round((parseFloat(monto) || 0) * 100) / 100
    if (!(valor > 0)) { setError("Escribe un monto mayor que cero."); return }
    if (valor > saldo) { setError(`El abono no puede superar el saldo pendiente (${dinero(saldo)}).`); return }
    if (!fecha || fecha > hoyISO()) { setError("La fecha del abono no puede ser futura."); return }
    if (fechaVenta && fecha < fechaVenta) { setError("La fecha del abono no puede ser anterior a la de la venta."); return }
    setGuardando(true)
    setError("")
    let resultado = { estado: valor >= saldo ? "pagada" : "pendiente_pago", cuotasPagadas: factura.cuotasPagadas }
    if (supabase) {
      const esCuota = factura.metodoPago === "cuotas" && valor === sugerido && fecha === hoyISO() && !nota.trim()
      const { data, error: errorRpc } = esCuota
        ? await supabase.rpc("registrar_pago_cuota_venta", { p_factura_id: factura.id }).single()
        : await supabase.rpc("registrar_abono", { p_factura_id: factura.id, p_monto: valor, p_fecha: fecha, p_nota: nota.trim() || null }).single()
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo registrar el abono. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
      resultado = { estado: data.estado, cuotasPagadas: esCuota ? data.cuotas_pagadas : data.estado === "pagada" && factura.cuotasTotales ? factura.cuotasTotales : factura.cuotasPagadas }
      // Se vuelven a leer los abonos de esta venta para que la lista refleje exactamente lo guardado.
      const { data: filas } = await supabase.from("abonos_factura").select("*").eq("factura_id", factura.id)
      ;(filas || []).forEach((f) => window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(f) })))
    }
    registrarLog(usuario, "ventas", "Registró un abono", `${paciente?.nombre || ""} · ${dinero(valor)}`)
    setGuardando(false)
    onRegistrado?.({ monto: valor, ...resultado })
    onCerrar()
  }

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <form ref={refModal} onSubmit={confirmar} role="dialog" aria-modal="true" aria-labelledby="abono-titulo" className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Wallet size={19} aria-hidden="true" /></span>
            <div>
              <h2 id="abono-titulo" className="text-base font-bold" style={{ color: INK }}>Registrar abono</h2>
              <p className="text-xs text-slate-500">{paciente?.nombre}</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={18} /></button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[["Total", dinero(factura.montoTotal)], ["Abonado", dinero(totalAbonado(factura.id, abonos))], ["Saldo", dinero(saldo)]].map(([k, v], i) => (
              <div key={k} className={"rounded-xl border px-2 py-2 " + (i === 2 ? "border-amber-200/60 bg-amber-50" : "border-slate-200/60 bg-slate-50")}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{k}</dt>
                <dd className={"font-mono text-base font-bold " + (i === 2 ? "text-amber-700" : "text-slate-800")}>{v}</dd>
              </div>
            ))}
          </dl>

          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Monto *</span>
              <input type="number" min="0.01" step="0.01" max={saldo} value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus className={CAMPO + " font-mono"} />
            </label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Fecha *</span>
              <input type="date" value={fecha} min={fechaVenta || undefined} max={hoyISO()} onChange={(e) => setFecha(e.target.value)} className={CAMPO} />
            </label>
          </div>
          <button type="button" onClick={() => setMonto(saldo.toFixed(2))} className="text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-800 cursor-pointer">Pagar el saldo completo ({dinero(saldo)})</button>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nota (opcional)</span>
            <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} placeholder="Ej. transferencia, efectivo…" className={CAMPO} />
          </label>

          {historial.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Abonos anteriores</p>
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60 text-sm">
                {historial.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="text-slate-600">{fechaLegible(a.fecha)}{a.nota ? ` · ${a.nota}` : ""}</span>
                    <span className="font-mono font-semibold text-slate-800">{dinero(a.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>}
        </div>

        <div className="flex gap-3 border-t border-slate-100 px-5 py-4">
          <button type="button" onClick={cerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={guardando} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>{guardando ? "Guardando…" : "Registrar abono"}</button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
