"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowUpRight, MessageSquare, RotateCcw, Send, Star } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import { BurbujaMensaje, CampoCapturas, InsigniaEstado, InsigniaUrgencia } from "./piezas"
import { codigoConsulta, nombreModulo, nombreTipo } from "../../utilidades/soporte"
import { supabase } from "../../lib/supabaseClient"
import { calificarConsulta, cerrarConsulta, escalarConsulta, leerConversacion, marcarConsultaLeida, reabrirConsulta, responderConsulta } from "../../utilidades/soporteDatos"
import { dondeEsta, puedeEscalar } from "../../utilidades/comunicacionInterna"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"

const CAMPO = "w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"

// La conversación completa de una consulta, vista desde la óptica: responder y adjuntar mientras esté abierta; al resolverse, calificar (solo quien la
// escribió) o reabrirla si el problema sigue. Una consulta de otra persona (la ve el administrador) se puede leer y contestar, pero no calificar.
export default function VentanaConsulta({ consulta, usuario, puedeEscribir, onCambio, onCerrar }) {
  const [mensajes, setMensajes] = useState(null)
  const [errorCarga, setErrorCarga] = useState("")
  const [texto, setTexto] = useState("")
  const [archivos, setArchivos] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [modoReabrir, setModoReabrir] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [nota, setNota] = useState(0)
  const [comentario, setComentario] = useState("")
  const [modoEscalar, setModoEscalar] = useState(false)
  const [notaEscalada, setNotaEscalada] = useState("")
  const [permitirEntrada, setPermitirEntrada] = useState(false)
  const fin = useRef(null)
  const esAutor = consulta.autorId === usuario.id
  const resuelta = consulta.estado === "resuelta"
  // Solo el administrador escala, y solo una consulta de su personal que sigue con él.
  const escalable = puedeEscribir && puedeEscalar(consulta, usuario)

  const cargar = useCallback(async () => {
    const r = await leerConversacion(consulta.id)
    if (r.error) setErrorCarga(r.error)
    else { setErrorCarga(""); setMensajes(r.datos) }
  }, [consulta.id])
  useEffect(() => { cargar() }, [cargar, consulta.actualizadaEn])
  useEffect(() => { fin.current?.scrollIntoView?.({ block: "end" }) }, [mensajes?.length])
  // Abrirla es leer la respuesta: la campanita baja.
  useEffect(() => { if (esAutor && consulta.respuestaSinLeer) marcarConsultaLeida(consulta.id).then(() => onCambio?.()) }, [consulta.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const despues = async (r, mensajeError) => {
    if (r.error) { setError(r.error || mensajeError); return false }
    setError("")
    await cargar()
    onCambio?.()
    return true
  }

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto.trim() || enviando) return
    setEnviando(true)
    const r = await responderConsulta({ opticaId: usuario.opticaId, consultaId: consulta.id, cuerpo: texto.trim(), archivos })
    if (await despues(r)) { setTexto(""); setArchivos([]) }
    setEnviando(false)
  }
  const escalar = async (e) => {
    e.preventDefault()
    setEnviando(true)
    if (await despues(await escalarConsulta(consulta.id, notaEscalada.trim()))) {
      // Opcional: dejar que el soporte entre a la óptica por 24 horas para resolverla (lo valida el servidor).
      if (permitirEntrada) await supabase.rpc("permitir_acceso_soporte", { p_horas: 24, p_consulta: consulta.id })
      setModoEscalar(false); setNotaEscalada(""); setPermitirEntrada(false)
    }
    setEnviando(false)
  }
  const marcarResuelta = async () => { setEnviando(true); await despues(await cerrarConsulta(consulta.id)); setEnviando(false) }
  const reabrir = async (e) => {
    e.preventDefault()
    if (!motivo.trim()) { setError("Cuéntanos qué sigue pasando."); return }
    setEnviando(true)
    if (await despues(await reabrirConsulta(consulta.id, motivo.trim()))) { setModoReabrir(false); setMotivo("") }
    setEnviando(false)
  }
  const calificar = async (e) => {
    e.preventDefault()
    if (!nota) { setError("Elige de 1 a 5 estrellas."); return }
    setEnviando(true)
    await despues(await calificarConsulta(consulta.id, nota, comentario.trim()))
    setEnviando(false)
  }

  return (
    <Cascaron titulo={`${codigoConsulta(consulta.numero)} · ${consulta.asunto}`} subtitulo={`${nombreModulo(consulta.modulo)} · ${nombreTipo(consulta.tipo)} · ${fechaHoraLegible(consulta.creadaEn, { anio: true })}`} Icono={MessageSquare} onCerrar={onCerrar} ancho="max-w-2xl"
      pie={<>
        <span className="text-xs text-slate-500">{!esAutor && `Escribió ${consulta.autorNombre} · ${consulta.autorRol}`}</span>
        <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
      </>}>
      <div className="space-y-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <InsigniaEstado estado={consulta.estado} />
          <InsigniaUrgencia urgencia={consulta.urgencia} />
          {!resuelta && <span className="text-xs font-semibold text-slate-500">{dondeEsta(consulta, usuario)}</span>}
          {consulta.reabiertaVeces > 0 && <span className="text-xs text-slate-500">Reabierta {consulta.reabiertaVeces === 1 ? "1 vez" : `${consulta.reabiertaVeces} veces`}</span>}
        </div>

        {errorCarga && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{errorCarga}</p>}
        {mensajes === null && !errorCarga
          ? <div className="space-y-2" aria-hidden="true">{[0, 1].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
          : <div className="space-y-3" role="log" aria-label="Conversación">{(mensajes || []).map((m) => <BurbujaMensaje key={m.id} mensaje={m} esMio={m.autorId ? m.autorId === usuario.id : m.de === "optica"} />)}</div>}
        <div ref={fin} />

        {resuelta ? (
          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 px-4 py-3.5">
            <p className="text-sm font-bold text-emerald-800">Consulta resuelta{consulta.resueltaEn ? ` el ${fechaHoraLegible(consulta.resueltaEn, { anio: true })}` : ""}</p>
            {consulta.calificacion ? (
              <p className="text-sm text-slate-700">
                Calificaste la atención con <span className="font-bold">{consulta.calificacion} de 5</span> <span aria-hidden="true" className="text-amber-500">{"★".repeat(consulta.calificacion)}</span>{consulta.calificacionComentario ? ` · «${consulta.calificacionComentario}»` : ""}
              </p>
            ) : esAutor && puedeEscribir ? (
              <form onSubmit={calificar} className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">¿Cómo fue la atención?</p>
                <div role="radiogroup" aria-label="Calificación de 1 a 5" className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" role="radio" aria-checked={nota === n} aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`} onClick={() => setNota(n)}
                      className={"rounded-md p-1 transition-colors cursor-pointer " + (n <= nota ? "text-amber-500" : "text-slate-300 hover:text-amber-300")}>
                      <Star size={26} fill={n <= nota ? "currentColor" : "none"} aria-hidden="true" />
                    </button>
                  ))}
                </div>
                <textarea rows={2} value={comentario} maxLength={500} onChange={(e) => setComentario(e.target.value)} placeholder="Comentario (opcional)" aria-label="Comentario sobre la atención" className={CAMPO} />
                <button type="submit" disabled={enviando || !nota} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Enviar calificación</button>
              </form>
            ) : null}
            {puedeEscribir && !modoReabrir && <button type="button" onClick={() => setModoReabrir(true)} className={CLASE_ACCION_SECUNDARIA}><RotateCcw size={14} aria-hidden="true" /> El problema sigue: reabrir</button>}
            {puedeEscribir && modoReabrir && (
              <form onSubmit={reabrir} className="space-y-2">
                <label htmlFor="soporte-reabrir" className="block text-sm font-semibold text-slate-700">¿Qué sigue pasando?</label>
                <textarea id="soporte-reabrir" rows={3} value={motivo} maxLength={4000} onChange={(e) => setMotivo(e.target.value)} className={CAMPO} />
                <div className="flex items-center gap-2">
                  <button type="submit" disabled={enviando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Reabrir consulta</button>
                  <button type="button" onClick={() => { setModoReabrir(false); setMotivo(""); setError("") }} className={CLASE_ACCION_SECUNDARIA}>Cancelar</button>
                </div>
              </form>
            )}
          </div>
        ) : puedeEscribir ? (
          <form onSubmit={enviar} className="space-y-2 rounded-2xl border border-slate-200/60 bg-slate-50/60 p-3">
            <label htmlFor="soporte-respuesta" className="sr-only">Tu mensaje</label>
            <textarea id="soporte-respuesta" rows={3} value={texto} maxLength={4000} onChange={(e) => setTexto(e.target.value)} placeholder="Escribe tu mensaje…" className={CAMPO + " bg-white"} />
            <CampoCapturas id="soporte-respuesta-capturas" archivos={archivos} onCambiar={setArchivos} deshabilitado={enviando} />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={marcarResuelta} disabled={enviando} className={CLASE_ACCION_SECUNDARIA}>Ya está resuelto</button>
                {escalable && !modoEscalar && <button type="button" onClick={() => setModoEscalar(true)} disabled={enviando} className={CLASE_ACCION_SECUNDARIA}><ArrowUpRight size={14} aria-hidden="true" /> Escalar al soporte del sistema</button>}
              </div>
              <button type="submit" disabled={enviando || !texto.trim()} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Send size={14} aria-hidden="true" /> {enviando ? "Enviando…" : "Enviar"}</button>
            </div>
          </form>
        ) : <p className="text-sm text-slate-500">Tu rol puede leer esta consulta, pero no escribir en ella.</p>}

        {escalable && modoEscalar && (
          <form onSubmit={escalar} className="space-y-2 rounded-2xl border border-blue-200 bg-blue-50/40 p-3">
            <label htmlFor="soporte-escalar" className="block text-sm font-semibold text-slate-700">Escalar al soporte del sistema</label>
            <p className="text-xs text-slate-500">El soporte verá toda la conversación y los archivos. Puedes agregar una nota para explicar qué ya probaste.</p>
            <textarea id="soporte-escalar" rows={2} value={notaEscalada} maxLength={1000} onChange={(e) => setNotaEscalada(e.target.value)} placeholder="Nota para el soporte (opcional)" className={CAMPO + " bg-white"} />
            <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={permitirEntrada} onChange={(e) => setPermitirEntrada(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600" /><span>Permitir que el soporte entre a mi óptica por 24 horas para resolverla. Recibirás un aviso con el motivo de cada entrada.</span></label>
            <div className="flex items-center gap-2">
              <button type="submit" disabled={enviando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{enviando ? "Escalando…" : "Escalar consulta"}</button>
              <button type="button" onClick={() => { setModoEscalar(false); setNotaEscalada(""); setError("") }} className={CLASE_ACCION_SECUNDARIA}>Cancelar</button>
            </div>
          </form>
        )}

        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
