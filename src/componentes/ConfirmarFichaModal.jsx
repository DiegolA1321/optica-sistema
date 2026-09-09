"use client"

import { useEffect } from "react"
import { createPortal } from "react-dom"
import { ClipboardCheck, User, Stethoscope, Glasses, CheckCircle2 } from "lucide-react"
import { INK } from "@/lib/tema"
import FilaDato from "./FilaDato"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso de confirmación explícita antes de guardar una ficha clínica, para evitar
// guardados accidentales (la ficha queda fija en el historial del paciente y,
// si hay un producto vinculado, descuenta stock del inventario).
// Se monta por encima del formulario (no lo reemplaza), así que "Cancelar"
// solo cierra este paso y deja los datos ya escritos intactos.
//
// Antes usaba el Dialog de Radix, igual que ConfirmarCitaModal — pasado al
// mismo patrón hand-rolled que el resto del sistema (ver C6/comentario en
// ConfirmarCitaModal.jsx), con el Escape agregado a mano para no perder lo
// que Radix daba gratis.
export default function ConfirmarFichaModal({ paciente, diagnostico, lenteRecomendado, usaLentes, onCancelar, onConfirmar, guardando = false, error = "" }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape" && !guardando) onCancelar() }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [guardando, onCancelar])

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={() => !guardando && onCancelar()}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-ficha-titulo"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
            <ClipboardCheck size={22} />
          </div>
          <h2 id="confirmar-ficha-titulo" className="text-lg font-bold" style={{ color: INK }}>¿Guardar esta ficha clínica?</h2>
          <p className="mt-1.5 text-sm text-slate-500">Revisa los datos antes de guardar. Quedará registrada en el historial del paciente.</p>

          <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            {paciente && <FilaDato icon={User} label="Paciente" valor={paciente} />}
            <FilaDato icon={Stethoscope} label="Diagnóstico" valor={diagnostico} />
            {lenteRecomendado && <FilaDato icon={Glasses} label="Lente" valor={lenteRecomendado} />}
            {usaLentes && <FilaDato icon={CheckCircle2} label="¿Usa lentes?" valor={usaLentes === "si" ? "Sí" : "No"} />}
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={guardando}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: GRAD }}
          >
            {guardando ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
