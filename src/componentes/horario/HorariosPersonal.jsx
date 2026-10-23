"use client"

import { useEffect, useMemo, useState } from "react"
import CampoHora from "../CampoHora"
import { horaSinCero } from "../../utilidades/formatoFecha"
import { AlertTriangle, User } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import { hoyISO, ETIQUETAS_DIA } from "../../utilidades/disponibilidad"
import { ETIQUETA_TURNO, ORDEN_DIAS, TURNOS, citasFueraDelHorario, resumenDeJornada, semanaDe, semanaDeLaOptica, turnosFueraDeLaOptica } from "../../utilidades/agendaPersonal"

const CAMPO_HORA = "h-10 w-[7.5rem] rounded-xl border border-slate-200/60 bg-white px-2.5 text-sm font-medium text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:opacity-50"

const rolDe = (m, rolesDe) => (m.rol === "admin" ? "Administrador" : rolesDe[m.id]?.length ? rolesDe[m.id].join(" · ") : m.esOptometra ? "Optómetra" : "Personal")

function Interruptor({ activo, onCambiar, etiqueta }) {
  return (
    <button type="button" role="switch" aria-checked={activo} aria-label={etiqueta} onClick={onCambiar} className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600" style={{ backgroundColor: activo ? "#2563EB" : "#cbd5e1" }}>
      <span className={"absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " + (activo ? "translate-x-5" : "translate-x-0")} />
    </button>
  )
}

// «Horarios del personal» (administrador): a la izquierda las personas con su rol; a la derecha la semana de la elegida, con mañana y tarde por día (cada turno se activa o no, para el medio tiempo),
// «Usar el horario de la óptica» y «Copiar a…». Debe estar dentro del horario de la óptica; las citas ya agendadas que queden fuera se avisan antes de guardar.
// La agenda de cada profesional y las horas que ofrece la web salen de este horario.
export default function HorariosPersonal({ miembros, disponibilidad, citas = [], datos, onAviso, onCopiado }) {
  const { horarios, rolesDe, guardarHorario } = datos
  const profesionalDe = (id) => ({ id, ...(horarios[id] || { usaOptica: true, horario: null }), ausencias: [] })
  const [elegido, setElegido] = useState(() => miembros[0]?.id || null)
  const persona = miembros.find((m) => m.id === elegido) || miembros[0] || null
  const guardado = persona ? profesionalDe(persona.id) : null
  const [semana, setSemana] = useState(() => (guardado ? semanaDe(guardado, disponibilidad) : semanaDeLaOptica(disponibilidad)))
  const [usaOptica, setUsaOptica] = useState(guardado ? guardado.usaOptica : true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [aviso, setAviso] = useState(null) // { citas, aplicar }: citas que quedarían fuera
  const [copiando, setCopiando] = useState(false)

  // Al cambiar de persona (o llegar sus datos) se muestra lo guardado.
  const firma = JSON.stringify([persona?.id, guardado?.usaOptica, guardado?.horario])
  useEffect(() => {
    if (!persona) return
    setSemana(semanaDe(guardado, disponibilidad))
    setUsaOptica(guardado.usaOptica)
    setError("")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma])

  const hayCambios = useMemo(() => {
    if (!guardado) return false
    if (usaOptica !== guardado.usaOptica) return true
    return !usaOptica && JSON.stringify(semana) !== JSON.stringify(semanaDe(guardado, disponibilidad))
  }, [semana, usaOptica, guardado, disponibilidad])
  const fuera = useMemo(() => (usaOptica ? [] : turnosFueraDeLaOptica(semana, disponibilidad)), [semana, usaOptica, disponibilidad])
  const estaFuera = (dia, turno) => fuera.some((f) => f.dia === dia && f.turno === turno)

  if (!persona) return <p className="rounded-2xl border border-slate-200/70 bg-white p-6 text-sm text-slate-500">Todavía no hay personal con horario. Crea a las personas en Usuarios y permisos.</p>

  const cambiar = (dia, turno, cambios) => {
    setUsaOptica(false)
    setSemana((s) => ({ ...s, [dia]: { ...s[dia], [turno]: { ...s[dia][turno], ...cambios } } }))
  }
  const usarLaDeLaOptica = () => { setUsaOptica(true); setSemana(semanaDeLaOptica(disponibilidad)); setError("") }

  const aplicar = async () => {
    setGuardando(true)
    setError("")
    const { error: e } = await guardarHorario(persona.id, usaOptica, semana)
    setGuardando(false)
    if (e) { setError(e); return }
    onAviso?.(`Horario de ${persona.nombre} guardado.`)
  }
  const guardar = () => {
    if (fuera.length > 0) { setError(`Debe estar dentro del horario de la óptica: ${fuera.map((f) => `${ETIQUETAS_DIA[f.dia].toLowerCase()} (${ETIQUETA_TURNO[f.turno].toLowerCase()})`).join(", ")} queda fuera.`); return }
    const afectadas = usaOptica ? [] : citasFueraDelHorario({ persona: persona.id, semanaNueva: semana, usaOptica, citas, disponibilidad, hoy: hoyISO() })
    if (afectadas.length > 0) { setAviso({ citas: afectadas, aplicar }); return }
    aplicar()
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(15rem,0.62fr)_minmax(0,2fr)] lg:items-start">
      <nav aria-label="Personal que atiende o trabaja" className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
        <p className="px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Personal que atiende o trabaja</p>
        <ul className="space-y-1">
          {miembros.map((m) => {
            const activo = m.id === persona.id
            return (
              <li key={m.id}>
                <button type="button" onClick={() => setElegido(m.id)} aria-current={activo ? "true" : undefined}
                  className={"block w-full rounded-xl border-l-4 px-3 py-2.5 text-left transition-colors cursor-pointer " + (activo ? "border-blue-600 bg-blue-50" : "border-transparent hover:bg-slate-50")}>
                  <span className="block truncate text-sm font-bold" style={{ color: INK }}>{m.nombre}</span>
                  <span className="block truncate text-sm text-slate-500">{rolDe(m, rolesDe)} · {resumenDeJornada(profesionalDe(m.id), disponibilidad)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <section aria-label={`Horario de ${persona.nombre}`} className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-3 pt-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold" style={{ color: INK }}>{persona.nombre} · {rolDe(persona, rolesDe)}</h2>
            <p className="text-sm text-slate-500">Su agenda y las horas que se ofrecen en la web salen de este horario.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={usarLaDeLaOptica} className={CLASE_ACCION_SECUNDARIA}>Usar el horario de la óptica</button>
            {miembros.length > 1 && <button type="button" onClick={() => setCopiando(true)} className={CLASE_ACCION_SECUNDARIA}>Copiar a…</button>}
          </div>
        </div>

        <ul aria-label="Semana" className="divide-y divide-slate-100 border-t border-slate-100">
          {ORDEN_DIAS.map((dia) => (
            <li key={dia} className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
              <span className="w-24 text-sm font-bold" style={{ color: INK }}>{ETIQUETAS_DIA[dia]}</span>
              {TURNOS.map((turno) => {
                const t = semana[dia][turno]
                const mal = estaFuera(dia, turno)
                return (
                  <div key={turno} className="flex min-w-[17rem] flex-1 items-center gap-2">
                    <Interruptor activo={t.activo} onCambiar={() => cambiar(dia, turno, { activo: !t.activo })} etiqueta={`${ETIQUETAS_DIA[dia]}: ${ETIQUETA_TURNO[turno].toLowerCase()}`} />
                    {t.activo ? (
                      <>
                        <span className="text-sm text-slate-600">{ETIQUETA_TURNO[turno]}:</span>
                        <CampoHora sinCero value={t.inicio} onChange={(v) => cambiar(dia, turno, { inicio: v })} aria-label={`${ETIQUETAS_DIA[dia]}, ${ETIQUETA_TURNO[turno].toLowerCase()}: desde`} aria-invalid={mal} className={CAMPO_HORA + (mal ? " border-red-400" : "")} />
                        <span className="text-sm text-slate-500">a</span>
                        <CampoHora sinCero value={t.fin} onChange={(v) => cambiar(dia, turno, { fin: v })} aria-label={`${ETIQUETAS_DIA[dia]}, ${ETIQUETA_TURNO[turno].toLowerCase()}: hasta`} aria-invalid={mal} className={CAMPO_HORA + (mal ? " border-red-400" : "")} />
                      </>
                    ) : (
                      <span className="text-sm text-slate-400">{ETIQUETA_TURNO[turno]}: no trabaja</span>
                    )}
                  </div>
                )
              })}
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mx-5 mb-2 flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700"><AlertTriangle size={15} aria-hidden="true" /> {error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3.5">
          <p className="max-w-xl text-sm text-slate-500">Debe estar dentro del horario de la óptica. Las citas ya agendadas fuera del nuevo horario se avisan antes de guardar.</p>
          <button type="button" onClick={guardar} disabled={!hayCambios || guardando} className={CLASE_ACCION_PRINCIPAL + " px-5 py-2.5"} style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar horario"}</button>
        </div>
      </section>

      {aviso && (
        <Cascaron titulo="Hay citas fuera de este horario" subtitulo="Revisa antes de guardar el nuevo horario" Icono={AlertTriangle} ancho="max-w-md" capa="z-[60]" onCerrar={() => setAviso(null)}
          pie={<><span /><div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={() => setAviso(null)} className={BOTON_CERRAR}>Cancelar</button>
            <button type="button" onClick={() => { const a = aviso; setAviso(null); a.aplicar() }} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 cursor-pointer">Guardar de todas formas</button>
          </div></>}>
          <div className="space-y-3 p-6">
            <p className="text-sm text-slate-600">{aviso.citas.length === 1 ? "Esta cita de" : `Estas ${aviso.citas.length} citas de`} {persona.nombre} {aviso.citas.length === 1 ? "queda" : "quedan"} fuera del horario nuevo:</p>
            <ul className="max-h-48 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/60">
              {aviso.citas.map((c) => (
                <li key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <User size={13} className="shrink-0 text-slate-500" aria-hidden="true" />
                  <span className="truncate font-semibold text-slate-700">{c.paciente}</span>
                  <span className="ml-auto shrink-0 text-xs text-slate-500">{c.fecha} · {horaSinCero(c.hora)}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-slate-500">Puedes guardar igual y reagendarlas o reasignarlas desde Citas, o cancelar y dejar el horario como está.</p>
          </div>
        </Cascaron>
      )}

      {copiando && <VentanaCopiar origen={persona} miembros={miembros} semana={semana} usaOptica={usaOptica} citas={citas} disponibilidad={disponibilidad} rolDe={(m) => rolDe(m, rolesDe)} guardarHorario={guardarHorario}
        onCerrar={() => setCopiando(false)} onCopiado={(n) => { setCopiando(false); onAviso?.(`Horario de ${persona.nombre} copiado a ${n} ${n === 1 ? "persona" : "personas"}.`); onCopiado?.() }} />}
    </div>
  )
}

// «Copiar a…»: el horario que se ve ahora (aunque no esté guardado) pasa a las personas que se elijan. Cada una se guarda por separado, con las mismas reglas.
function VentanaCopiar({ origen, miembros, semana, usaOptica, citas, disponibilidad, rolDe, guardarHorario, onCerrar, onCopiado }) {
  const otros = miembros.filter((m) => m.id !== origen.id)
  const [marcados, setMarcados] = useState([])
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const alternar = (id) => setMarcados((a) => (a.includes(id) ? a.filter((x) => x !== id) : [...a, id]))
  const fueraPorPersona = Object.fromEntries(marcados.map((id) => [id, usaOptica ? [] : citasFueraDelHorario({ persona: id, semanaNueva: semana, usaOptica, citas, disponibilidad, hoy: hoyISO() })]))
  const nFuera = Object.values(fueraPorPersona).reduce((n, l) => n + l.length, 0)
  const copiar = async () => {
    setTrabajando(true)
    setError("")
    let hechos = 0
    for (const id of marcados) {
      const { error: e } = await guardarHorario(id, usaOptica, semana)
      if (e) { setError(`${otros.find((m) => m.id === id)?.nombre}: ${e}`); break }
      hechos++
    }
    setTrabajando(false)
    if (hechos === marcados.length) onCopiado(hechos)
  }
  return (
    <Cascaron titulo="Copiar el horario a…" subtitulo={`El de ${origen.nombre}, tal como se ve ahora`} Icono={User} ancho="max-w-md" capa="z-[60]" onCerrar={onCerrar}
      pie={<><span /><div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cancelar</button>
        <button type="button" onClick={copiar} disabled={marcados.length === 0 || trabajando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{trabajando ? "Copiando…" : "Copiar"}</button>
      </div></>}>
      <div className="space-y-3 p-6">
        <ul aria-label="Personas" className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
          {otros.map((m) => (
            <li key={m.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                <input type="checkbox" checked={marcados.includes(m.id)} onChange={() => alternar(m.id)} className="h-4 w-4 accent-blue-600" />
                <span className="min-w-0"><span className="block truncate font-semibold text-slate-800">{m.nombre}</span><span className="block truncate text-xs text-slate-500">{rolDe(m)}</span></span>
              </label>
            </li>
          ))}
        </ul>
        {nFuera > 0 && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">{nFuera === 1 ? "Hay 1 cita agendada" : `Hay ${nFuera} citas agendadas`} fuera de ese horario; podrás reagendarlas o reasignarlas desde Citas.</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
