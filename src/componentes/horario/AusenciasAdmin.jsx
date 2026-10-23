"use client"

import { useMemo, useState } from "react"
import { horaSinCero } from "../../utilidades/formatoFecha"
import { AlertTriangle, CalendarX } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { supabase } from "../../lib/supabaseClient"
import { mensajeDeError } from "../../utilidades/permisos"
import { Cascaron } from "../AtencionPaciente"
import { Insignia } from "../ventas/Lista"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import { hoyISO } from "../../utilidades/disponibilidad"
import { ESTADOS_AUSENCIA, citasEnAusencia, etiquetaTipoAusencia, textoCuando } from "../../utilidades/agendaPersonal"

const COLUMNAS = "lg:grid-cols-[minmax(10rem,1.2fr)_minmax(8rem,1fr)_minmax(9rem,1.1fr)_minmax(14rem,1.6fr)_auto]"
const POR_PAGINA = 30
const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"

// «Ausencias» (administrador): las solicitudes con persona, cuándo, motivo, «Ver documento» si lo tiene, estado y «Aprobar» o «Rechazar» (con motivo). Al aprobar, ese tiempo se bloquea en la agenda de la persona
// y en la web; si tenía citas en ese tiempo se listan para reagendarlas o reasignarlas antes de aprobar. La persona recibe el aviso de la respuesta.
export default function AusenciasAdmin({ miembros, rolDe, ausencias, citas = [], setCitas, disponibilidad, datos, onReagendarCita, onAviso }) {
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [aprobando, setAprobando] = useState(null) // { ausencia, citas }
  const [rechazando, setRechazando] = useState(null)
  const [trabajando, setTrabajando] = useState(null)
  const lista = useMemo(() => {
    const vivas = ausencias.filter((a) => a.estado !== "cancelada")
    const pendientes = vivas.filter((a) => a.estado === "pendiente").sort((a, b) => (a.fechaDesde < b.fechaDesde ? -1 : 1))
    const resto = vivas.filter((a) => a.estado !== "pendiente").sort((a, b) => (a.fechaDesde < b.fechaDesde ? 1 : -1))
    return [...pendientes, ...resto]
  }, [ausencias])
  const miembroDe = (id) => miembros.find((m) => m.id === id)

  const abrirDocumento = async (a) => {
    const ventana = window.open("", "_blank")
    const url = await datos.urlDocumento(a.documentoRuta)
    if (!url) { ventana?.close(); onAviso?.("No se pudo abrir el documento. Intenta de nuevo.", "error"); return }
    if (ventana) { ventana.opener = null; ventana.location.href = url } else window.location.href = url
  }

  const aprobar = async (a, aviso = "Ausencia aprobada. Ese tiempo queda bloqueado en la agenda y en la web.") => {
    setTrabajando(a.id)
    const { error } = await datos.resolverAusencia(a.id, true)
    setTrabajando(null)
    if (error) { onAviso?.(error, "error"); return false }
    onAviso?.(aviso)
    return true
  }
  const pedirAprobar = (a) => {
    const enTiempo = citasEnAusencia({ ausencia: a, personaId: a.usuarioId, citas, disponibilidad })
    if (enTiempo.length === 0) aprobar(a)
    else setAprobando({ ausencia: a, citas: enTiempo })
  }

  return (
    <div className="space-y-4">
      {lista.length === 0 ? (
        <section className="rounded-2xl border border-slate-200/70 bg-white p-8 text-center shadow-sm">
          <CalendarX size={28} className="mx-auto text-slate-300" aria-hidden="true" />
          <p className="mt-3 text-base font-semibold text-slate-700">Todavía no hay solicitudes de ausencia</p>
          <p className="mt-1 text-sm text-slate-500">Cuando alguien del personal pida una ausencia, aparece aquí para que la apruebes o la rechaces.</p>
        </section>
      ) : (
        <section aria-label="Solicitudes de ausencia" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className={"hidden gap-x-4 border-b border-slate-100 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid " + COLUMNAS}>
            <span>Persona</span><span>Cuándo</span><span>Motivo</span><span>Estado</span><span className="w-44" />
          </div>
          <ul aria-label="Ausencias" className="divide-y divide-slate-100">
            {lista.slice(0, visibles).map((a) => {
              const m = miembroDe(a.usuarioId)
              const e = ESTADOS_AUSENCIA[a.estado] || ESTADOS_AUSENCIA.pendiente
              return (
                <li key={a.id} className={"grid grid-cols-1 items-center gap-x-4 gap-y-1.5 px-5 py-3.5 " + COLUMNAS}>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: INK }}>{a.usuarioNombre}</p>
                    <p className="truncate text-sm text-slate-500">{m ? rolDe(m) : "Ya no está en el equipo"}</p>
                  </div>
                  <p className="text-sm text-slate-800">{textoCuando(a)}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm text-slate-800">{etiquetaTipoAusencia(a.tipo)}</p>
                    {a.motivo && <p className="truncate text-xs text-slate-500" title={a.motivo}>{a.motivo}</p>}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                    {a.documentoRuta && <button type="button" onClick={() => abrirDocumento(a)} className="truncate text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline underline-offset-2 cursor-pointer">Ver documento ({a.documentoNombre || "documento"})</button>}
                    <Insignia tono={e.tono}>{e.etiqueta}</Insignia>
                    {a.estado === "rechazada" && a.motivoRechazo && <span className="truncate text-xs text-red-700" title={a.motivoRechazo}>{a.motivoRechazo}</span>}
                  </div>
                  <div className="flex w-full justify-start gap-2 lg:w-44 lg:justify-end">
                    {a.estado === "pendiente" && (
                      <>
                        <button type="button" onClick={() => setRechazando(a)} disabled={trabajando === a.id} aria-label={`Rechazar la ausencia de ${a.usuarioNombre}`} className={CLASE_ACCION_SECUNDARIA}>Rechazar</button>
                        <button type="button" onClick={() => pedirAprobar(a)} disabled={trabajando === a.id} aria-label={`Aprobar la ausencia de ${a.usuarioNombre}`} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Aprobar</button>
                      </>
                    )}
                    {a.estado === "aprobada" && a.fechaHasta >= hoyISO() && (
                      <button type="button" onClick={async () => { const { error } = await datos.retirarAusencia(a.id); onAviso?.(error || "Ausencia retirada: ese tiempo vuelve a la agenda.", error ? "error" : undefined) }} aria-label={`Retirar la ausencia aprobada de ${a.usuarioNombre}`} className={CLASE_ACCION_SECUNDARIA}>Retirar</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
          {visibles < lista.length && <div className="border-t border-slate-100 px-5 py-3 text-right"><button type="button" onClick={() => setVisibles((n) => n + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, lista.length - visibles)} más · quedan {lista.length - visibles}</button></div>}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
        <h2 className="text-base font-bold" style={{ color: INK }}>Al aprobar una ausencia</h2>
        <p className="mt-1 text-sm text-slate-500">Ese tiempo se bloquea en su agenda y en la web. Si ya tenía citas en ese tiempo, el sistema las lista para reagendarlas o reasignarlas antes de aprobar.</p>
      </section>

      {aprobando && <VentanaAprobar {...aprobando} miembros={miembros} citas={citas} setCitas={setCitas} disponibilidad={disponibilidad} onReagendar={onReagendarCita} onCerrar={() => setAprobando(null)}
        onAprobar={async () => { const ok = await aprobar(aprobando.ausencia, "Ausencia aprobada. Las citas que quedaron sin pasar a otra persona aparecen en «citas por reasignar» del Inicio."); if (ok) setAprobando(null) }} onAviso={onAviso} />}
      {rechazando && <VentanaRechazar ausencia={rechazando} onCerrar={() => setRechazando(null)} onRechazar={async (motivo) => {
        const { error } = await datos.resolverAusencia(rechazando.id, false, motivo)
        if (error) return error
        setRechazando(null)
        onAviso?.("Ausencia rechazada. La persona recibe el aviso con tu motivo.")
        return ""
      }} />}
    </div>
  )
}

// Las citas de la persona en ese tiempo, para reasignarlas a otro profesional o reagendarlas antes de aprobar.
function VentanaAprobar({ ausencia, citas: enTiempo, miembros, citas, setCitas, disponibilidad, onReagendar, onCerrar, onAprobar, onAviso }) {
  const [restantes, setRestantes] = useState(enTiempo.map((c) => c.id))
  const [destino, setDestino] = useState({})
  const [trabajando, setTrabajando] = useState(null)
  const [aprobando, setAprobando] = useState(false)
  const [error, setError] = useState("")
  const otros = miembros.filter((m) => m.id !== ausencia.usuarioId && m.esOptometra)
  const lista = restantes.map((id) => citas.find((c) => c.id === id) || enTiempo.find((c) => c.id === id)).filter(Boolean)

  const reasignar = async (c) => {
    const nuevo = destino[c.id]
    if (!nuevo) { setError("Elige a quién pasar la cita."); return }
    setTrabajando(c.id)
    setError("")
    const { error: e } = supabase ? await supabase.rpc("reasignar_cita", { p_cita_id: c.id, p_nuevo: nuevo }) : { error: null }
    setTrabajando(null)
    if (e) { setError(mensajeDeError(e, "No se pudo reasignar la cita. Revisa tu conexión e intenta de nuevo.")); return }
    setCitas?.((prev) => prev.map((x) => (x.id === c.id ? { ...x, asignadoA: nuevo } : x)))
    setRestantes((r) => r.filter((id) => id !== c.id))
    onAviso?.(`Cita de ${c.paciente} pasada a ${otros.find((m) => m.id === nuevo)?.nombre || "otra persona"}.`)
  }

  return (
    <Cascaron titulo={`${ausencia.usuarioNombre} tiene ${enTiempo.length === 1 ? "1 cita" : `${enTiempo.length} citas`} en ese tiempo`} subtitulo={`${textoCuando(ausencia)} · reasígnalas o reagéndalas antes de aprobar`} Icono={AlertTriangle} ancho="max-w-2xl" capa="z-[60]" onCerrar={() => { if (!aprobando) onCerrar() }}
      pie={<><span className="text-xs text-slate-500">{lista.length === 0 ? "Ya no quedan citas por pasar." : `Si apruebas ya, ${lista.length === 1 ? "queda 1 cita" : `quedan ${lista.length} citas`} en «citas por reasignar» del Inicio.`}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} disabled={aprobando} className={BOTON_CERRAR}>Cancelar</button>
          <button type="button" onClick={async () => { setAprobando(true); await onAprobar(); setAprobando(false) }} disabled={aprobando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{aprobando ? "Aprobando…" : lista.length === 0 ? "Aprobar" : "Aprobar igual"}</button>
        </div></>}>
      <div className="space-y-3 p-5">
        {lista.length === 0 ? <p className="text-sm text-slate-600">Todas las citas ya tienen otra persona. Puedes aprobar la ausencia.</p> : (
          <ul aria-label="Citas en ese tiempo" className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
            {lista.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.paciente}</p>
                  <p className="text-xs text-slate-500">{c.fecha} · {horaSinCero(c.hora)}</p>
                </div>
                {otros.length > 0 && (
                  <>
                    <select value={destino[c.id] || ""} onChange={(e) => setDestino((d) => ({ ...d, [c.id]: e.target.value }))} aria-label={`Pasar la cita de ${c.paciente} a`} className={CAMPO + " w-44"}>
                      <option value="">Pasar a…</option>
                      {otros.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                    </select>
                    <button type="button" onClick={() => reasignar(c)} disabled={trabajando === c.id} aria-label={`Reasignar la cita de ${c.paciente}`} className={CLASE_ACCION_SECUNDARIA}>{trabajando === c.id ? "Pasando…" : "Reasignar"}</button>
                  </>
                )}
                {onReagendar && <button type="button" onClick={() => onReagendar(c)} aria-label={`Reagendar la cita de ${c.paciente}`} className={CLASE_ACCION_SECUNDARIA}>Reagendar</button>}
              </li>
            ))}
          </ul>
        )}
        {otros.length === 0 && lista.length > 0 && <p className="text-xs text-slate-500">No hay otro profesional a quien pasarlas: reagéndalas desde Citas.</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}

function VentanaRechazar({ ausencia, onCerrar, onRechazar }) {
  const [motivo, setMotivo] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const enviar = async (e) => {
    e.preventDefault()
    if (motivo.trim().length < 3) { setError("Escribe el motivo del rechazo."); return }
    setEnviando(true)
    const r = await onRechazar(motivo.trim())
    setEnviando(false)
    if (r) setError(r)
  }
  return (
    <Cascaron titulo={`¿Rechazar la ausencia de ${ausencia.usuarioNombre}?`} subtitulo={textoCuando(ausencia)} Icono={CalendarX} ancho="max-w-md" capa="z-[60]" onCerrar={() => { if (!enviando) onCerrar() }} formulario={{ onSubmit: enviar }}
      pie={<><span /><div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCerrar} disabled={enviando} className={BOTON_CERRAR}>Cancelar</button>
        <button type="submit" disabled={enviando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">{enviando ? "Rechazando…" : "Rechazar"}</button>
      </div></>}>
      <div className="space-y-3 p-5">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Motivo</span>
          <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} maxLength={300} className={CAMPO + " resize-none"} placeholder="La persona lo lee en su aviso" autoFocus />
        </label>
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
