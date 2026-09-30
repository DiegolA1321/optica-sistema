"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { CalendarClock, Stethoscope, ChevronRight, Activity } from "lucide-react"
import { INK } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso previo a "Ficha clínica" desde el perfil del paciente (pedido del ing,
// reunión 29 sept.): si tiene citas pendientes o en atención, hay que elegir
// cuál se está atendiendo en vez de abrir la ficha sin vínculo. Al elegir una,
// el llamador la pasa como citaIdInicial a ConsultaMedica.jsx — mismo camino
// que "Atender" desde Citas médicas (motivo precargado, estado a "En
// Atención", cita_id guardado con la consulta). Mismo patrón hand-rolled que
// ConfirmarCitaModal (createPortal + overlay-in/modal-in, max-h-[85vh] +
// scroll interno, Escape).
export default function SeleccionarCitaModal({ paciente, citas, onSeleccionar, onAbrirSinCita, onCerrar }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onCerrar() }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onCerrar])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="seleccionar-cita-titulo"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
            <CalendarClock size={22} />
          </div>
          <h2 id="seleccionar-cita-titulo" className="text-lg font-bold" style={{ color: INK }}>¿Qué cita vas a atender?</h2>
          <p className="mt-1.5 text-sm text-slate-500">{paciente} tiene {citas.length === 1 ? "una cita" : `${citas.length} citas`} sin terminar. Elige una para vincularla a la ficha clínica.</p>

          <div className="mt-4 space-y-2">
            {citas.map((cita) => (
              <button
                key={cita.id}
                type="button"
                onClick={() => onSeleccionar(cita.id)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5 text-left transition-colors hover:border-blue-200/60 hover:bg-blue-50/60 cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: INK }}>{cita.fechaEtiqueta}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-sm text-slate-600">{cita.horaEtiqueta}</span>
                    {cita.estado === "En Atención" && (
                      <span className="flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                        <Activity size={10} /> En atención
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                    <Stethoscope size={12} className="shrink-0" />
                    <span className="truncate">{cita.motivo || "Sin motivo especificado"}</span>
                  </div>
                </div>
                <ChevronRight size={18} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={onCerrar}
            className="w-full rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={onAbrirSinCita}
            className="w-full py-1 text-center text-xs font-medium text-slate-400 transition-colors hover:text-slate-600 cursor-pointer"
          >
            Abrir sin vincular a una cita
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
