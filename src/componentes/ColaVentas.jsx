"use client"

import { ShoppingBag, FileText, UserX, Undo2, Stethoscope, Wallet } from "lucide-react"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { diasEnEspera, textoEspera, etiquetaMotivo, textoDiagnostico } from "../utilidades/pasesVenta"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Lista de pacientes esperando a quien vende ("Listos para venta") o que no
// compraron ("No compraron"). Cada tarjeta trae lo necesario para atender sin
// abrir el perfil: la consulta, el diagnóstico y el lente recomendado.
export default function ColaVentas({ modo = "listos", items, saldoDe, puedeActuar = true, reabriendoId, onTomarDatos, onNoCompro, onReabrir, onVerPerfil }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><ShoppingBag size={24} aria-hidden="true" /></div>
        <p className="text-sm font-semibold text-slate-600">{modo === "listos" ? "No hay pacientes esperando para venta." : "Nadie ha dejado de comprar."}</p>
        <p className="max-w-sm text-xs text-slate-500">{modo === "listos" ? "Cuando el optómetra termine una atención y pulse \"Pasar a la óptica\", el paciente aparece aquí." : "Aquí quedan quienes consultaron y no compraron, con su motivo."}</p>
      </div>
    )
  }
  return (
    <ul className="space-y-3" aria-label={modo === "listos" ? "Pacientes listos para venta" : "Pacientes que no compraron"}>
      {items.map(({ pase, paciente, consulta }) => {
        const diagnostico = textoDiagnostico(consulta)
        return (
          <li key={pase.id} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => paciente && onVerPerfil?.(paciente)} className="truncate text-left text-base font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>
                  {paciente?.nombre || "Paciente"}
                </button>
                <p className="text-xs text-slate-500">
                  {paciente?.cedula ? `${paciente.cedula} · ` : ""}Consulta del {fechaLegible(consulta?.fecha) || "—"}{consulta?.motivo ? ` · ${consulta.motivo}` : ""}
                </p>
                {diagnostico && <p className="mt-1.5 flex items-start gap-1.5 text-sm text-slate-700"><Stethoscope size={14} className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />{diagnostico}</p>}
                {consulta?.lenteRecomendado && <p className="mt-0.5 text-sm text-slate-600">Lente recomendado: <span className="font-semibold">{consulta.lenteRecomendado}</span></p>}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  {modo === "listos" ? (
                    <span className="rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-0.5 font-semibold text-emerald-700">{textoEspera(diasEnEspera(pase))}</span>
                  ) : (
                    <span className="rounded-full border border-slate-200/60 bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-600">{etiquetaMotivo(pase.motivoDescarte, pase.detalleDescarte)}</span>
                  )}
                  {saldoDe && paciente && saldoDe(paciente.id) > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 font-semibold text-amber-700" title="El paciente tiene ventas anteriores sin pagar por completo">
                      <Wallet size={11} aria-hidden="true" /> Saldo pendiente ${saldoDe(paciente.id).toFixed(2)}
                    </span>
                  )}
                  {pase.proformaEntregadaEn && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2.5 py-0.5 font-semibold text-blue-700">
                      <FileText size={11} aria-hidden="true" /> Proforma {fechaLegible(pase.proformaEntregadaEn)} · ${Number(pase.proformaTotal || 0).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              {puedeActuar && <div className="flex shrink-0 flex-wrap items-center gap-2">
                {modo === "listos" ? (
                  <>
                    <button type="button" onClick={() => onNoCompro({ pase, paciente, consulta })} className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                      <UserX size={14} aria-hidden="true" /> No compró
                    </button>
                    <button type="button" onClick={() => onTomarDatos({ pase, paciente, consulta })} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                      <ShoppingBag size={14} aria-hidden="true" /> Tomar datos del diagnóstico
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={() => onReabrir({ pase, paciente, consulta })} disabled={reabriendoId === pase.id} className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">
                    <Undo2 size={14} aria-hidden="true" /> {reabriendoId === pase.id ? "Volviendo…" : "Volver a la lista de espera"}
                  </button>
                )}
              </div>}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
