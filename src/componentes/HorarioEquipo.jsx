"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Users, CalendarRange, Loader2 } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { hoyISO, etiquetaFecha, ETIQUETAS_DIA, DIAS_SEMANA } from "../utilidades/disponibilidad"
import { lunesDeSemana, sumarDiasISO } from "../utilidades/calendarioSemana"
import { citasDePersona, resumenSemana, resumenDia, estadoAhora } from "../utilidades/horarioPersonal"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const ESTADO_AHORA = {
  enAtencion: { texto: "En atención", clase: "border-blue-200/60 bg-blue-50 text-blue-700" },
  citaAhora: { texto: "Con cita ahora", clase: "border-amber-200/60 bg-amber-50 text-amber-700" },
  libre: { texto: "Libre", clase: "border-emerald-200/60 bg-emerald-50 text-emerald-700" },
  sinHorario: { texto: "Sin horario hoy", clase: "border-slate-200/60 bg-slate-100 text-slate-500" },
}

const diaDe = (iso) => ETIQUETAS_DIA[DIAS_SEMANA[new Date(`${iso}T12:00:00`).getDay()]]
const diaNumero = (iso) => iso.split("-")[2]
// "5 oct – 11 oct" (sin "Ayer", "Hoy" ni "Mañana", que no sirven para un rango)
const corta = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("es-EC", { day: "numeric", month: "short" }).replace(".", "")

// Horarios ocupados y disponibles (R19). Cada persona ve su semana; el
// administrador además ve a todo el equipo: quién está ocupado ahora, cuántos
// espacios le quedan hoy y el detalle de la semana de cada uno. Lo ocupado son
// las citas asignadas a esa persona; una cita sin asignar no ocupa a nadie.
export default function HorarioEquipo({ usuario, equipo = [], citas = [], duracion = 40, horarioPersonal, disponibilidad }) {
  const esAdmin = usuario?.rol === "admin"
  const [lunes, setLunes] = useState(() => lunesDeSemana(hoyISO()))
  const [verId, setVerId] = useState(usuario?.id)
  const [horarios, setHorarios] = useState(null) // id → horario_semanal (solo administrador)
  const [errorCarga, setErrorCarga] = useState(false)

  useEffect(() => {
    if (!esAdmin || !supabase) return
    let vivo = true
    supabase.from("horarios_usuario").select("usuario_id, horario_semanal").then(({ data, error }) => {
      if (!vivo) return
      if (error) { setErrorCarga(true); setHorarios({}); return }
      setHorarios(Object.fromEntries((data || []).map((h) => [h.usuario_id, h.horario_semanal || {}])))
    })
    return () => { vivo = false }
  }, [esAdmin])

  // El horario propio viene de la app (siempre al día); el de los demás, de la lectura del administrador.
  // Un día que la persona no configuró se completa con el horario general de la óptica.
  const horarioDe = (id) => (id === usuario?.id ? horarioPersonal?.horarioSemanal : horarios?.[id]) || {}
  const miembros = esAdmin ? equipo : equipo.filter((m) => m.id === usuario?.id)
  const nombreVisto = miembros.find((m) => m.id === verId)?.nombre || usuario?.nombre
  const ahora = new Date()

  const semana = useMemo(
    () => resumenSemana({ lunes, horarioSemanal: horarioDe(verId), disponibilidad, citas: citasDePersona(citas, verId), duracion }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lunes, verId, citas, duracion, horarios, horarioPersonal, disponibilidad],
  )
  const totalOcupados = semana.reduce((n, d) => n + d.ocupados, 0)
  const totalLibres = semana.reduce((n, d) => n + d.libres, 0)
  const hoy = hoyISO()
  const cargandoEquipo = esAdmin && horarios === null
  const cargando = verId === usuario?.id ? horarioPersonal === null : cargandoEquipo

  return (
    <div className={"grid grid-cols-1 gap-6 " + (esAdmin ? "lg:grid-cols-2" : "")}>
      {/* ─── LA SEMANA DE UNA PERSONA ─── */}
      <section aria-label="Horarios ocupados y disponibles de la semana" className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><CalendarRange size={16} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold" style={{ color: INK }}>Ocupados y disponibles</h4>
            <p className="truncate text-xs text-slate-500">
              {verId === usuario?.id ? "Tu semana" : nombreVisto} · {corta(lunes)} – {corta(sumarDiasISO(lunes, 6))}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1">
            <button type="button" onClick={() => setLunes(sumarDiasISO(lunes, -7))} aria-label="Semana anterior" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><ChevronLeft size={15} /></button>
            <button type="button" onClick={() => setLunes(lunesDeSemana(hoy))} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer">Esta semana</button>
            <button type="button" onClick={() => setLunes(sumarDiasISO(lunes, 7))} aria-label="Semana siguiente" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><ChevronRight size={15} /></button>
          </div>
        </div>

        {esAdmin && (
          <div className="mb-3">
            <label htmlFor="horario-ver-persona" className="mb-1 block text-xs font-semibold text-slate-500">Ver el horario de</label>
            <select
              id="horario-ver-persona"
              value={verId}
              onChange={(e) => setVerId(e.target.value)}
              className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
            >
              {miembros.map((m) => (
                <option key={m.id} value={m.id}>{m.id === usuario?.id ? `${m.nombre} (yo)` : m.nombre}</option>
              ))}
            </select>
          </div>
        )}

        {cargando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando horarios…</div>
        ) : (
          <>
            <p className="mb-2 text-xs text-slate-500">
              <span className="font-bold text-slate-700">{totalOcupados}</span> ocupados · <span className="font-bold text-slate-700">{totalLibres}</span> turnos libres esta semana
            </p>
            <ul className="divide-y divide-slate-100">
              {semana.map((d) => (
                <li key={d.fecha} className={"flex items-center gap-3 py-2 " + (d.fecha === hoy ? "rounded-lg bg-blue-50/50 px-2" : "")}>
                  <div className="w-16 shrink-0">
                    <p className="text-sm font-semibold text-slate-700">{diaDe(d.fecha).slice(0, 3)} {diaNumero(d.fecha)}</p>
                    {d.fecha === hoy && <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600">Hoy</p>}
                  </div>
                  {d.cerrado ? (
                    <p className="text-xs text-slate-400">{d.segunGeneral ? "Cerrado · según el horario general" : "Sin horario"}</p>
                  ) : (
                    <>
                      <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-emerald-100" role="img" aria-label={`${d.ocupados} de ${d.total} espacios ocupados`}>
                        <div className="h-full rounded-full" style={{ width: `${d.total ? (d.ocupados / d.total) * 100 : 0}%`, backgroundColor: INK }} />
                      </div>
                      <p className="w-44 shrink-0 text-right text-xs text-slate-600">
                        <span className="font-bold">{d.ocupados}</span> ocupados · <span className="font-bold">{d.libres}</span> turnos libres
                        {d.segunGeneral && <span className="block text-[10px] text-slate-400">Según el horario general</span>}
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">Lo ocupado son las citas asignadas a esta persona. Una cita sin asignar no cuenta en ningún horario.</p>
          </>
        )}
      </section>

      {/* ─── EL EQUIPO HOY (solo administrador) ─── */}
      {esAdmin && (
        <section aria-label="El equipo hoy" className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 border-b border-slate-100 pb-3">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><Users size={16} aria-hidden="true" /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>El equipo hoy</h4>
              <p className="text-xs text-slate-500">{etiquetaFecha(hoy)} · quién está ocupado y cuánto le queda</p>
            </div>
          </div>
          {cargandoEquipo ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Cargando horarios…</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {miembros.map((m) => {
                const horarioSemanal = horarioDe(m.id)
                const suyas = citasDePersona(citas, m.id)
                const hoyResumen = resumenDia({ fecha: hoy, horarioSemanal, disponibilidad, citas: suyas, duracion, ahora })
                const estado = ESTADO_AHORA[estadoAhora({ horarioSemanal, disponibilidad, citas: suyas, duracion, ahora })]
                return (
                  <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">{m.nombre}{m.id === usuario?.id ? " (yo)" : ""}</p>
                      <p className="text-xs text-slate-500">
                        {hoyResumen.cerrado ? "No atiende hoy" : `${hoyResumen.ocupados} ocupados · ${hoyResumen.libres} turnos libres`}{hoyResumen.segunGeneral ? " · según el horario general" : ""}
                        {m.esOptometra ? " · Optómetra" : ""}
                      </p>
                    </div>
                    <span className={"rounded-full border px-2 py-0.5 text-xs font-semibold " + estado.clase}>{estado.texto}</span>
                    <button
                      type="button"
                      onClick={() => setVerId(m.id)}
                      aria-pressed={verId === m.id}
                      className={"rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (verId === m.id ? "border-transparent text-white" : "border-slate-200/60 text-slate-600 hover:bg-slate-50")}
                      style={verId === m.id ? { backgroundColor: INK } : undefined}
                    >
                      Ver semana
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {errorCarga && <p role="alert" className="mt-3 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">No se pudieron leer los horarios del equipo. Revisa tu conexión e intenta de nuevo.</p>}
        </section>
      )}
    </div>
  )
}
