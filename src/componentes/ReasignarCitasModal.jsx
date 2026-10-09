"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { X, Loader2 } from "lucide-react"
import { INK } from "@/lib/tema"
import { supabase } from "../lib/supabaseClient"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { formatoFecha } from "../utilidades/formatoFecha"
import { ausenteEnHorario } from "../utilidades/reasignacion"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"

// Reasignación en bloque: las citas abiertas de una persona que registró una ausencia ese día. Cada cita se pasa con la
// función reasignar_cita (valida permiso y alcance en la base y deja el registro en la actividad). "Pasar todas a" rellena
// todas las filas; después se puede cambiar una por una.
export default function ReasignarCitasModal({ grupo, personas = [], disponibilidad, onCerrar, onHecho }) {
  const refModal = useModalAccesible(true, onCerrar)
  const destinosPosibles = personas.filter((m) => m.id !== grupo.personaId)
  const [elegidos, setElegidos] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const nombreAusente = grupo.personaNombre || personas.find((m) => m.id === grupo.personaId)?.nombre || "La persona"
  const textoOpcion = (m, cita) => m.nombre + (ausenteEnHorario(disponibilidad, m.id, cita.fecha, cita.hora) ? " (ausente a esa hora)" : "")
  const elegidasN = grupo.citas.filter((c) => elegidos[c.id]).length

  const pasarTodas = (id) => setElegidos(Object.fromEntries(grupo.citas.map((c) => [c.id, id])))

  const reasignar = async () => {
    if (!supabase || elegidasN === 0) return
    setGuardando(true)
    setError("")
    const hechas = []
    let fallo = null
    for (const cita of grupo.citas) {
      const destino = elegidos[cita.id]
      if (!destino) continue
      const { data, error: err } = await supabase.rpc("reasignar_cita", { p_cita_id: cita.id, p_nuevo: destino })
      if (err) { fallo = err; break }
      const fila = Array.isArray(data) ? data[0] : data
      hechas.push({ id: cita.id, asignadoA: fila?.nuevo_asignado ?? destino, asignadoOriginal: fila?.nuevo_original ?? cita.asignadoA })
    }
    setGuardando(false)
    if (hechas.length > 0) onHecho(hechas, !fallo)
    if (fallo) setError((esErrorSinPermiso(fallo) ? MENSAJE_SIN_PERMISO : fallo.message) || "No se pudieron reasignar todas. Revisa tu conexión e intenta de nuevo.")
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reasignar-citas-titulo"
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h4 id="reasignar-citas-titulo" className="text-lg font-bold" style={{ color: INK }}>Reasignar citas de {nombreAusente}</h4>
            <p className="text-xs text-slate-500">{nombreAusente} estará ausente el {formatoFecha(grupo.fecha, "largo")}</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <label className="mb-4 flex items-center justify-between gap-3 text-sm font-semibold text-slate-700">
            Pasar todas a
            <select
              value=""
              onChange={(e) => pasarTodas(e.target.value)}
              className="w-56 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Elegir persona…</option>
              {destinosPosibles.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
            </select>
          </label>

          <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
            {grupo.citas.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.paciente}</p>
                  <p className="truncate text-xs text-slate-500">{c.hora}{c.motivo ? ` · ${c.motivo}` : ""}</p>
                </div>
                <select
                  aria-label={`Pasar la cita de ${c.paciente} a`}
                  value={elegidos[c.id] || ""}
                  onChange={(e) => setElegidos((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  className="w-52 shrink-0 rounded-xl border border-slate-200/60 bg-white px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Sin cambio</option>
                  {destinosPosibles.map((m) => <option key={m.id} value={m.id}>{textoOpcion(m, c)}</option>)}
                </select>
              </li>
            ))}
          </ul>
          {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onCerrar} className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
          <button
            type="button"
            onClick={reasignar}
            disabled={guardando || elegidasN === 0}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {guardando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {elegidasN === 0 ? "Reasignar" : `Reasignar ${elegidasN} ${elegidasN === 1 ? "cita" : "citas"}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
