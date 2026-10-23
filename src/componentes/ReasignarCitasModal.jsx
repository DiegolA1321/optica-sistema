"use client"

import { useState } from "react"
import { Users, Loader2 } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"
import { supabase } from "../lib/supabaseClient"
import { formatoFecha, horaSinCero } from "../utilidades/formatoFecha"
import { ausenteEnHorario } from "../utilidades/reasignacion"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Reasignación en bloque: las citas abiertas de una persona que registró una ausencia ese día. Cada cita se pasa con la
// función reasignar_cita (valida permiso y alcance en la base y deja el registro en la actividad). "Pasar todas a" rellena
// todas las filas; después se puede cambiar una por una.
export default function ReasignarCitasModal({ grupo, personas = [], disponibilidad, onCerrar, onHecho }) {
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

  return (
    <Cascaron
      titulo={"Reasignar citas de " + nombreAusente}
      subtitulo={nombreAusente + " estará ausente el " + formatoFecha(grupo.fecha, "largo")}
      Icono={Users}
      ancho="max-w-xl"
      capa="z-[60]"
      onCerrar={onCerrar}
      pie={<>
        <span />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
          <button
            type="button"
            onClick={reasignar}
            disabled={guardando || elegidasN === 0}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: GRAD }}
          >
            {guardando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {elegidasN === 0 ? "Reasignar" : `Reasignar ${elegidasN} ${elegidasN === 1 ? "cita" : "citas"}`}
          </button>
        </div>
      </>}
    >
      <div className="px-6 py-5">
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
                <p className="truncate text-xs text-slate-500">{horaSinCero(c.hora)}{c.motivo ? ` · ${c.motivo}` : ""}</p>
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
    </Cascaron>
  )
}
