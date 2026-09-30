"use client"

import { createPortal } from "react-dom"
import { CalendarCheck, User, Stethoscope, CalendarDays, Clock } from "lucide-react"
import { INK } from "@/lib/tema"
import FilaDato from "./FilaDato"
import { useModalAccesible } from "../utilidades/useModalAccesible"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso de confirmación explícita antes de guardar una cita, para evitar
// agendamientos accidentales por un clic de más sobre fecha/hora ya elegidas.
// Se monta por encima del formulario de agendar (no lo reemplaza), así que
// "Cancelar" solo cierra este paso y deja los datos ya escritos intactos.
//
// Antes usaba el Dialog de Radix — se pasó al mismo patrón hand-rolled
// (createPortal + overlay-in/modal-in) que usan los otros ~15 modales del
// sistema, que ya tenía el fix de max-h-[85vh]+overflow-y-auto para no
// dejar el header/botones fuera de pantalla en una ventana chica (ver
// C6/lección de modales). Dos arquitecturas de modal competían por lo
// mismo sin ninguna razón real para que este fuera distinto.
export default function ConfirmarCitaModal({ paciente, motivo, fecha, hora, onCancelar, onConfirmar, guardando = false, error = "", etiquetaConfirmar = "Confirmar", etiquetaCancelar = "Cancelar", titulo = "¿Confirmar esta cita?", subtitulo = "Revisa los datos antes de agendar." }) {
  // Escape + foco atrapado + devolución de foco, mismo hook que ya usa el
  // resto del sistema (antes: Escape agregado a mano, sin trap de foco).
  const cerrar = () => { if (!guardando) onCancelar() }
  const refModal = useModalAccesible(true, cerrar)

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={cerrar}
    >
      <div
        ref={refModal}
        className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-cita-titulo"
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
            <CalendarCheck size={22} />
          </div>
          <h2 id="confirmar-cita-titulo" className="text-lg font-bold" style={{ color: INK }}>{titulo}</h2>
          <p className="mt-1.5 text-sm text-slate-500">{subtitulo}</p>

          <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            {paciente && <FilaDato icon={User} label="Paciente" valor={paciente} />}
            <FilaDato icon={Stethoscope} label="Motivo" valor={motivo} />
            <FilaDato icon={CalendarDays} label="Fecha" valor={fecha} />
            <FilaDato icon={Clock} label="Hora" valor={hora} />
          </div>

          {error && (
            <p role="alert" className="mt-3 rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-slate-100 p-6 pt-4">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            {etiquetaCancelar}
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={guardando}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: GRAD }}
          >
            {guardando ? "Guardando..." : etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
