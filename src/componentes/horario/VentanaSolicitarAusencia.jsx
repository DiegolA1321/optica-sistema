"use client"

import { useMemo, useRef, useState } from "react"
import { CalendarX, Paperclip } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import CampoFecha from "../CampoFecha"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL } from "../ventas/estilos"
import { hoyISO } from "../../utilidades/disponibilidad"
import { sumarDiasISO } from "../../utilidades/controles"
import { TIPOS_AUSENCIA, citasEnAusencia, problemaDeDocumento } from "../../utilidades/agendaPersonal"
import { tamanoLegible } from "../../utilidades/soporte"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
const OPCIONES = [{ id: "todo", etiqueta: "Todo el día" }, { id: "manana", etiqueta: "Mañana" }, { id: "tarde", etiqueta: "Tarde" }, { id: "varios", etiqueta: "Varios días" }]

// «Solicitar ausencia» (todos los roles): tipo, el día o los días, todo el día / mañana / tarde, motivo opcional y un documento de respaldo opcional (PDF o foto, hasta 5 MB). Avisa si la persona tiene citas
// en ese tiempo. El documento es un dato sensible (puede ser un certificado médico): se guarda en almacenamiento privado y solo lo ven quien lo envía y la administración de la óptica.
export default function VentanaSolicitarAusencia({ usuario, disponibilidad, citas = [], datos, onCerrar, onEnviada }) {
  const hoy = hoyISO()
  const [tipo, setTipo] = useState("cita_medica")
  const [modo, setModo] = useState("todo") // todo | manana | tarde | varios
  const [desde, setDesde] = useState(hoy)
  const [hasta, setHasta] = useState(hoy)
  const [motivo, setMotivo] = useState("")
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const entrada = useRef(null)

  const varios = modo === "varios"
  const ultimo = varios ? hasta : desde
  const franja = modo === "manana" || modo === "tarde" ? modo : "todo"
  // Las citas de la persona en ese tiempo: la administración las verá para reagendarlas o reasignarlas.
  const conflicto = useMemo(() => (desde && ultimo >= desde ? citasEnAusencia({ ausencia: { fechaDesde: desde, fechaHasta: ultimo, franja }, personaId: usuario.id, citas, disponibilidad }) : []), [desde, ultimo, franja, usuario.id, citas, disponibilidad])

  const elegirArchivo = (f) => {
    const problema = problemaDeDocumento(f)
    if (problema) { setError(problema); return }
    setError("")
    setArchivo(f)
  }
  const enviar = async (e) => {
    e.preventDefault()
    setError("")
    if (!desde) { setError("Elige el día de la ausencia."); return }
    if (varios && (!hasta || hasta < desde)) { setError("El último día no puede ser antes del primero."); return }
    setEnviando(true)
    const { error: e2 } = await datos.solicitarAusencia({ tipo, desde, hasta: varios ? hasta : desde, franja, motivo: motivo.trim(), archivo })
    setEnviando(false)
    if (e2) { setError(e2); return }
    onEnviada()
  }

  return (
    <Cascaron titulo="Solicitar ausencia" subtitulo="La aprueba o rechaza la administración" Icono={CalendarX} ancho="max-w-xl" onCerrar={() => { if (!enviando) onCerrar() }} formulario={{ onSubmit: enviar }}
      pie={<><span /><div className="ml-auto flex items-center gap-2">
        <button type="button" onClick={onCerrar} disabled={enviando} className={BOTON_CERRAR}>Cancelar</button>
        <button type="submit" disabled={enviando} className={CLASE_ACCION_PRINCIPAL + " px-5 py-2.5"} style={{ background: GRAD_MARCA }}>{enviando ? "Enviando…" : "Enviar solicitud"}</button>
      </div></>}>
      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Tipo</span>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={CAMPO}>{TIPOS_AUSENCIA.map((t) => <option key={t.id} value={t.id}>{t.etiqueta}</option>)}</select>
          </label>
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-slate-600">{varios ? "Desde" : "Cuándo"}</span>
            <CampoFecha id="ausencia-desde" etiqueta={varios ? "Primer día de la ausencia" : "Día de la ausencia"} valor={desde} onCambiar={(v) => { setDesde(v); if (hasta < v) setHasta(v) }} min={hoy} max={sumarDiasISO(hoy, 730)} requerido />
          </div>
        </div>

        <div role="group" aria-label="Cuánto dura" className="flex flex-wrap gap-2">
          {OPCIONES.map((o) => (
            <button key={o.id} type="button" aria-pressed={modo === o.id} onClick={() => setModo(o.id)}
              className={"h-10 rounded-full border px-4 text-sm font-semibold transition-colors cursor-pointer " + (modo === o.id ? "border-transparent text-white" : "border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50")} style={modo === o.id ? { background: GRAD_MARCA } : undefined}>{o.etiqueta}</button>
          ))}
        </div>
        {varios && (
          <div>
            <span className="mb-1.5 block text-sm font-semibold text-slate-600">Hasta</span>
            <CampoFecha id="ausencia-hasta" etiqueta="Último día de la ausencia" valor={hasta} onCambiar={setHasta} min={desde || hoy} max={sumarDiasISO(hoy, 730)} requerido />
          </div>
        )}

        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-600">Motivo <span className="font-normal text-slate-500">(opcional)</span></span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={300} placeholder="Ej. Control médico programado" className={CAMPO} />
        </label>

        <div>
          <span className="mb-1.5 block text-sm font-semibold text-slate-600">Documento de respaldo <span className="font-normal text-slate-500">(opcional)</span></span>
          <input ref={entrada} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="sr-only" aria-label="Elegir el documento de respaldo" onChange={(e) => { elegirArchivo(e.target.files?.[0] || null); e.target.value = "" }} />
          {archivo ? (
            <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-sm">
              <Paperclip size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate"><strong className="font-semibold text-slate-800">{archivo.name}</strong> <span className="text-slate-500">· {tamanoLegible(archivo.size)}</span></span>
              <button type="button" onClick={() => setArchivo(null)} className="shrink-0 text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Quitar</button>
            </div>
          ) : (
            <button type="button" onClick={() => entrada.current?.click()} className="flex w-full items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3.5 py-2.5 text-left text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"><Paperclip size={16} aria-hidden="true" /> Adjuntar un documento</button>
          )}
          <p className="mt-1.5 text-sm text-slate-500">PDF o foto, hasta 5 MB. Solo lo ve la administración.</p>
        </div>

        {conflicto.length > 0 && <p className="text-sm text-slate-600">{conflicto.length === 1 ? "Tienes 1 cita" : `Tienes ${conflicto.length} citas`} {varios ? "en ese tiempo" : "ese día"}: la administración {conflicto.length === 1 ? "la" : "las"} verá para {conflicto.length === 1 ? "reagendarla" : "reagendarlas"} si aprueba.</p>}
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
