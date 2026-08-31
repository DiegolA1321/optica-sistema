import React, { useState } from "react"
import { Star, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabaseClient"

const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Página que abre el link "Calificar mi visita" del correo de encuesta (ver
// notificar_encuesta_satisfaccion en la migración 0041). El id de la cita en
// la URL hace de token de un solo uso funcional — un segundo envío con el
// mismo id no crea una segunda fila (índice único sobre cita_id), así que no
// hace falta ningún estado extra para evitar duplicados del lado servidor.
export default function EncuestaSatisfaccion({ citaId }) {
  const [puntaje, setPuntaje] = useState(0)
  const [puntajeHover, setPuntajeHover] = useState(0)
  const [comentario, setComentario] = useState("")
  const [estado, setEstado] = useState("form") // form | enviando | ok | error

  const enviar = async (e) => {
    e.preventDefault()
    if (!supabase || !citaId || puntaje < 1) return
    setEstado("enviando")
    const { data, error } = await supabase.rpc("enviar_encuesta_satisfaccion", {
      p_cita_id: citaId,
      p_puntaje: puntaje,
      p_comentario: comentario.trim() || null,
    })
    setEstado(!error && data ? "ok" : "error")
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: PORCELAIN }}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        {estado === "form" || estado === "enviando" ? (
          <form onSubmit={enviar} className="flex flex-col items-center gap-1">
            <h1 className="font-heading text-xl font-extrabold" style={{ color: INK }}>¿Cómo te fue en tu visita?</h1>
            <p className="mt-1 text-sm text-slate-500">Tu opinión nos ayuda a mejorar. Te toma menos de un minuto.</p>

            <div className="mt-6 flex items-center gap-1.5" role="radiogroup" aria-label="Calificación de 1 a 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPuntaje(n)}
                  onMouseEnter={() => setPuntajeHover(n)}
                  onMouseLeave={() => setPuntajeHover(0)}
                  aria-label={`${n} de 5`}
                  aria-pressed={puntaje === n}
                  className="cursor-pointer rounded-lg p-1 transition-transform hover:scale-110"
                >
                  <Star
                    size={34}
                    fill={(puntajeHover || puntaje) >= n ? "#C8A24E" : "none"}
                    stroke={(puntajeHover || puntaje) >= n ? "#C8A24E" : "#CBD5E1"}
                    strokeWidth={1.8}
                  />
                </button>
              ))}
            </div>

            <textarea
              rows={3}
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="¿Algo que quieras contarnos? (opcional)"
              className="mt-5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
            />

            <button
              type="submit"
              disabled={puntaje < 1 || estado === "enviando"}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
            >
              {estado === "enviando" ? <><Loader2 size={16} className="animate-spin" /> Enviando...</> : "Enviar calificación"}
            </button>
          </form>
        ) : estado === "ok" ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: GRAD }}>
              <CheckCircle2 size={28} />
            </div>
            <h1 className="mt-4 font-heading text-xl font-extrabold" style={{ color: INK }}>¡Gracias por tu opinión!</h1>
            <p className="mt-2 text-sm text-slate-500">Tu calificación ya quedó registrada.</p>
          </>
        ) : (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-600">
              <XCircle size={28} />
            </div>
            <h1 className="mt-4 font-heading text-xl font-extrabold" style={{ color: INK }}>No pudimos enviarla</h1>
            <p className="mt-2 text-sm text-slate-500">El enlace ya no es válido o ya respondiste esta encuesta antes.</p>
          </>
        )}
      </div>
    </div>
  )
}
