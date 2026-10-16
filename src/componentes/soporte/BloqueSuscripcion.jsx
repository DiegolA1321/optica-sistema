"use client"

import { useEffect, useState } from "react"
import { Printer, Receipt, Wallet } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { imprimirDocumento, estilosImpresion } from "../../utilidades/imprimir"
import { GRAD_MARCA as GRAD, INK } from "@/lib/tema"

const formatearFecha = (fecha) => fechaLegible(fecha)

// La suscripción y las facturas de la óptica (solo cuando el modo comercial está visible). Es lo que la pantalla de Soporte ya mostraba: no cambia.
export default function BloqueSuscripcion({ usuario }) {
  const [optica, setOptica] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [facturaImprimir, setFacturaImprimir] = useState(null)

  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vigente = true
    Promise.all([
      supabase.from("opticas").select("estado_pago, monto_mensual, proximo_vencimiento").eq("id", usuario.opticaId).single(),
      supabase.from("facturas").select("*").eq("optica_id", usuario.opticaId).order("emitida_at", { ascending: false }),
    ]).then(([a, b]) => { if (!vigente) return; setOptica(a.data || null); setFacturas(b.data || []) })
    return () => { vigente = false }
  }, [usuario?.opticaId])

  const estadoPago = optica?.estado_pago || "al_dia"
  return (
    <>
      {/* ─── Suscripción — solo ocupa espacio si hay algo que atender.
          Oculta mientras MODO_SAAS_VISIBLE esté apagado (ver src/lib/config.js). ─── */}
      {estadoPago !== "al_dia" && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-5" style={{ borderColor: estadoPago === "vencido" ? "#FECACA" : "#FDE68A", boxShadow: `0 0 0 3px ${estadoPago === "vencido" ? "rgba(225,29,72,0.08)" : "rgba(217,119,6,0.08)"}` }}>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Suscripción</p>
            <p className="mt-1 text-lg font-serif font-semibold leading-tight" style={{ color: estadoPago === "vencido" ? "#BE123C" : "#B45309" }}>
              {estadoPago === "vencido" ? "Pago vencido" : "Pago pendiente"}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-500">
              {optica?.proximo_vencimiento ? <>Vencimiento: {formatearFecha(optica.proximo_vencimiento)}</> : "Escríbenos si ya lo hiciste para confirmarlo."}
            </p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: estadoPago === "vencido" ? "#FEE2E2" : "#FFF7E6", color: estadoPago === "vencido" ? "#BE123C" : "#B45309" }}>
            <Wallet size={22} />
          </div>
        </div>
      )}

      {facturas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200/60 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Receipt size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Tus facturas</h4>
              <p className="text-xs text-slate-500">Historial de facturación de tu suscripción</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {facturas.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-slate-700">{f.numero}</p>
                  <p className="text-xs text-slate-500">{f.periodo} · {dinero(Number(f.monto))}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider"
                    style={f.estado === "pagada" ? { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" } : { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}
                  >
                    {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setFacturaImprimir(f); setTimeout(() => imprimirDocumento("factura-imprimible-admin", "printing-factura-admin"), 50) }}
                    title="Imprimir factura"
                    aria-label="Imprimir factura"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Factura imprimible (oculta salvo al imprimir) ─── */}
      {facturaImprimir && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <style>{estilosImpresion("printing-factura-admin")}</style>
          <div id="factura-imprimible-admin" className="w-[480px] bg-white p-8 text-sm text-slate-800">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200/60 pb-4">
              <div>
                <p className="text-lg font-bold" style={{ color: INK }}>Diego Óptica</p>
                <p className="text-xs text-slate-500">Sistema multi-óptica</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Factura</p>
                <p className="font-mono text-sm font-bold">{facturaImprimir.numero}</p>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Facturado a</p>
                <p className="font-semibold">{usuario?.opticaNombre || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p>
                <p className="font-semibold">{facturaImprimir.periodo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emitida</p>
                <p className="font-semibold">{formatearFecha(facturaImprimir.emitida_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</p>
                <p className="font-semibold">{facturaImprimir.estado === "pagada" ? "Pagada" : "Pendiente"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">Suscripción mensual</p>
              <p className="text-lg font-bold" style={{ color: INK }}>{dinero(Number(facturaImprimir.monto))}</p>
            </div>
            <button type="button" onClick={() => setFacturaImprimir(null)} className="no-print mt-6 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}
    </>
  )
}
