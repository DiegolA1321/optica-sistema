import React from "react"
import { CheckCircle2 } from "lucide-react"
import { INK, PORCELAIN } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Los correos de recordatorio anteriores traían el enlace «Confirmar mi asistencia». La cita ya no se confirma (quien agenda, viene; si no, cancela), así
// que el enlace solo dice que no hace falta hacer nada y no cambia nada en la base.
export default function ConfirmarCita() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: PORCELAIN }}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: GRAD }}>
          <CheckCircle2 size={28} />
        </div>
        <h1 className="mt-4 font-serif text-xl font-bold" style={{ color: INK }}>Tu cita sigue agendada</h1>
        <p className="mt-2 text-sm text-slate-500">Ya no hace falta confirmarla: te esperamos. Si no puedes venir, cancélala o reagéndala desde tu portal o escríbenos.</p>
      </div>
    </div>
  )
}
