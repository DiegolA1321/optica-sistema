"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronDown, MessageSquare, Send } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL } from "../ventas/estilos"
import { BurbujaMensaje, CampoCapturas, InsigniaEstado, InsigniaUrgencia } from "./piezas"
import { ESTADOS_CONSULTA, codigoConsulta, nombreModulo, nombreTipo } from "../../utilidades/soporte"
import { cambiarEstadoSoporte, leerConversacionSoporte, responderSoporte } from "../../utilidades/soporteDatos"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"

const CAMPO = "w-full resize-none rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"

// La consulta vista por el soporte: el contexto que mandó el sistema, la conversación (con las notas internas, que la óptica no ve), y desde aquí se
// responde, se agrega una nota interna, se inserta una respuesta guardada y se cambia el estado.
export default function VentanaConsultaSoporte({ consulta, opticaNombre, respuestasGuardadas = [], onCambio, onAuditoria, onCerrar }) {
  const [mensajes, setMensajes] = useState(null)
  const [errorCarga, setErrorCarga] = useState("")
  const [texto, setTexto] = useState("")
  const [interna, setInterna] = useState(false)
  const [archivos, setArchivos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const fin = useRef(null)
  const campo = useRef(null)

  const cargar = useCallback(async () => {
    const r = await leerConversacionSoporte(consulta.id)
    if (r.error) setErrorCarga(r.error)
    else { setErrorCarga(""); setMensajes(r.datos) }
  }, [consulta.id])
  useEffect(() => { cargar() }, [cargar, consulta.actualizadaEn])
  useEffect(() => { fin.current?.scrollIntoView?.({ block: "end" }) }, [mensajes?.length])

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto.trim() || enviando) return
    setEnviando(true)
    setError("")
    const r = await responderSoporte({ opticaId: consulta.opticaId, consultaId: consulta.id, cuerpo: texto.trim(), interna, archivos })
    setEnviando(false)
    if (r.error) { setError(r.error); return }
    if (!interna) onAuditoria?.("responder_mensaje", { opticaId: consulta.opticaId, opticaNombre, detalle: codigoConsulta(consulta.numero) })
    setTexto(""); setArchivos([]); setInterna(false)
    await cargar()
    onCambio?.()
  }

  const cambiarEstado = async (estado) => {
    if (estado === consulta.estado) return
    setEnviando(true)
    setError("")
    const r = await cambiarEstadoSoporte(consulta.id, estado)
    setEnviando(false)
    if (r.error) { setError(r.error); return }
    onAuditoria?.("cambiar_estado_soporte", { opticaId: consulta.opticaId, opticaNombre, detalle: codigoConsulta(consulta.numero), antes: consulta.estado, despues: estado })
    onCambio?.()
  }

  // Una respuesta guardada entra en el cuadro de texto (si ya hay algo escrito, va debajo) y queda lista para editar antes de enviar.
  const insertarGuardada = (id) => {
    const g = respuestasGuardadas.find((x) => x.id === id)
    if (!g) return
    setTexto((t) => (t.trim() ? `${t.trimEnd()}\n\n${g.texto}` : g.texto))
    campo.current?.focus()
  }

  const ctx = consulta.contexto || {}
  const filas = [
    ["Óptica", opticaNombre || "—"], ["Escribe", `${consulta.autorNombre} · ${consulta.autorRol}`], ["Módulo", nombreModulo(consulta.modulo)], ["Tipo", nombreTipo(consulta.tipo)],
    ["Pantalla desde la que escribió", ctx.pantalla || "—"], ["Navegador", ctx.navegador || "—"],
  ]
  return (
    <Cascaron titulo={`${codigoConsulta(consulta.numero)} · ${consulta.asunto}`} subtitulo={`${opticaNombre || "Óptica"} · ${consulta.autorNombre} · ${fechaHoraLegible(consulta.creadaEn, { anio: true })}`} Icono={MessageSquare} onCerrar={onCerrar} ancho="max-w-3xl"
      pie={<>
        <span className="text-xs text-slate-500">{consulta.calificacion ? `La óptica calificó la atención: ${consulta.calificacion} de 5${consulta.calificacionComentario ? ` · «${consulta.calificacionComentario}»` : ""}` : ""}</span>
        <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
      </>}>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2"><InsigniaEstado estado={consulta.estado} /><InsigniaUrgencia urgencia={consulta.urgencia} />{consulta.reabiertaVeces > 0 && <span className="text-xs text-slate-500">Reabierta {consulta.reabiertaVeces === 1 ? "1 vez" : `${consulta.reabiertaVeces} veces`}</span>}</div>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            Estado
            <select value={consulta.estado} disabled={enviando} onChange={(e) => cambiarEstado(e.target.value)} className="rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50">
              {ESTADOS_CONSULTA.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </label>
        </div>

        {consulta.escaladaEn && <p className="rounded-xl bg-blue-50 px-3.5 py-2 text-sm text-blue-800">La escaló el administrador {consulta.escaladaPor ? `(${consulta.escaladaPor}) ` : ""}el {fechaHoraLegible(consulta.escaladaEn, { anio: true })}: escribió {consulta.autorNombre} · {consulta.autorRol}. Abajo está toda la conversación.</p>}

        <details className="group rounded-xl border border-slate-200/60 bg-slate-50/70">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3.5 py-2.5 text-sm font-semibold text-slate-700 [&::-webkit-details-marker]:hidden">
            Contexto que envió el sistema
            <ChevronDown size={16} className="text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
          </summary>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-slate-200/60 px-3.5 py-3 text-sm sm:grid-cols-2">
            {filas.map(([k, v]) => <div key={k} className="min-w-0"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{k}</dt><dd className="break-words text-slate-800">{v}</dd></div>)}
          </dl>
        </details>

        {errorCarga && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{errorCarga}</p>}
        {mensajes === null && !errorCarga
          ? <div className="space-y-2" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          : <div className="space-y-3" role="log" aria-label="Conversación">{(mensajes || []).map((m) => <BurbujaMensaje key={m.id} mensaje={m} esMio={m.de === "soporte"} />)}</div>}
        <div ref={fin} />

        <form onSubmit={enviar} className={"space-y-2 rounded-2xl border p-3 " + (interna ? "border-amber-300 bg-amber-50/60" : "border-slate-200/60 bg-slate-50/60")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={interna} onChange={(e) => setInterna(e.target.checked)} className="h-4 w-4 accent-amber-600" /> Nota interna (la óptica no la ve)
            </label>
            {respuestasGuardadas.length > 0 && (
              <select value="" onChange={(e) => insertarGuardada(e.target.value)} aria-label="Insertar una respuesta guardada" className="max-w-[16rem] rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50">
                <option value="">Insertar respuesta guardada…</option>
                {respuestasGuardadas.map((g) => <option key={g.id} value={g.id}>{g.titulo}</option>)}
              </select>
            )}
          </div>
          <label htmlFor="soporte-sa-respuesta" className="sr-only">{interna ? "Nota interna" : "Tu respuesta"}</label>
          <textarea ref={campo} id="soporte-sa-respuesta" rows={4} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} placeholder={interna ? "Una nota para el equipo de soporte…" : "Escribe tu respuesta para la óptica…"} className={CAMPO} />
          <CampoCapturas id="soporte-sa-capturas" archivos={archivos} onCambiar={setArchivos} deshabilitado={enviando} />
          <div className="flex justify-end">
            <button type="submit" disabled={enviando || !texto.trim()} className={CLASE_ACCION_PRINCIPAL} style={{ background: interna ? "#B45309" : GRAD_MARCA }}>
              <Send size={14} aria-hidden="true" /> {enviando ? "Enviando…" : interna ? "Guardar nota interna" : "Enviar respuesta"}
            </button>
          </div>
        </form>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
