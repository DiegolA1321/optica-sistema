import React, { useEffect, useState } from "react"
import { CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabaseClient"

const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Página que abre el link "Confirmar mi asistencia" del correo de
// recordatorio (ver enviar_recordatorios_citas en la migración 0031). El id
// de la cita en la URL hace de token de un solo uso funcional — no expone ni
// cambia nada más que la marca de confirmación.
export default function ConfirmarCita({ citaId }) {
  const [estado, setEstado] = useState("cargando") // cargando | ok | error

  useEffect(() => {
    if (!supabase || !citaId) { setEstado("error"); return }
    supabase.rpc("confirmar_asistencia_cita", { p_cita_id: citaId }).then(({ data, error }) => {
      setEstado(!error && data ? "ok" : "error")
    })
  }, [citaId])

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: PORCELAIN }}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        {estado === "cargando" && (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-blue-500" />
            <p className="mt-4 text-sm text-slate-500">Confirmando tu asistencia...</p>
          </>
        )}
        {estado === "ok" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: GRAD }}>
              <CheckCircle2 size={28} />
            </div>
            <h1 className="mt-4 font-serif text-xl font-bold" style={{ color: INK }}>¡Asistencia confirmada!</h1>
            <p className="mt-2 text-sm text-slate-500">Te esperamos en tu cita. Gracias por confirmar.</p>
          </>
        )}
        {estado === "error" && (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-600">
              <XCircle size={28} />
            </div>
            <h1 className="mt-4 font-serif text-xl font-bold" style={{ color: INK }}>No pudimos confirmar</h1>
            <p className="mt-2 text-sm text-slate-500">El enlace ya no es válido. Si necesitas ayuda, comunícate directamente con la óptica.</p>
          </>
        )}
      </div>
    </div>
  )
}
