"use client"

import { Dialog as DialogPrimitive } from "radix-ui"
import { CalendarCheck, User, Stethoscope, CalendarDays, Clock } from "lucide-react"
import { Dialog, DialogPortal, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso de confirmación explícita antes de guardar una cita, para evitar
// agendamientos accidentales por un clic de más sobre fecha/hora ya elegidas.
// Se monta por encima del formulario de agendar (no lo reemplaza), así que
// "Cancelar" solo cierra este paso y deja los datos ya escritos intactos.
//
// Construido sobre el Dialog de shadcn/ui (Radix): agrega foco atrapado,
// cierre con ESC y click-afuera "gratis" respecto de la versión anterior.
export default function ConfirmarCitaModal({ paciente, motivo, fecha, hora, onCancelar, onConfirmar, guardando = false, error = "" }) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancelar()}>
      <DialogPortal>
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[70] backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)" }}
        />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-[70] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl outline-none"
        >
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
            <CalendarCheck size={22} />
          </div>
          <DialogTitle className="text-lg font-bold" style={{ color: INK }}>¿Confirmar esta cita?</DialogTitle>
          <DialogDescription className="mt-1.5 text-sm text-slate-500">Revisa los datos antes de agendar.</DialogDescription>

          <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
            {paciente && <FilaDato icon={User} label="Paciente" valor={paciente} />}
            <FilaDato icon={Stethoscope} label="Motivo" valor={motivo} />
            <FilaDato icon={CalendarDays} label="Fecha" valor={fecha} />
            <FilaDato icon={Clock} label="Hora" valor={hora} />
          </div>

          {error && (
            <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
          )}

          <div className="mt-5 flex gap-3">
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
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  )
}

function FilaDato({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon size={14} className="shrink-0 text-slate-500" />
      <span className="text-slate-500">{label}:</span>
      <span className="ml-auto truncate font-semibold" style={{ color: INK }}>{valor}</span>
    </div>
  )
}
