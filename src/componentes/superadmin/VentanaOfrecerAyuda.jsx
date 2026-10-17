"use client"

import { useState } from "react"
import { BookOpen, HandHelping, MessageSquare, Send } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import ContadorMensaje from "../ContadorMensaje"
import VistaPrevia, { BotonDeMuestra } from "../VistaPrevia"
import { ICONO_MODULO } from "./iconos"
import { ofrecerAyuda } from "../../utilidades/soporteDatos"
import { LIMITE_MENSAJE } from "../../utilidades/limiteMensaje"

const CAMPO = "w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"

// El mensaje que se propone: corto y editable. La guía no va escrita como dirección: el administrador la abre con un botón, en el sistema donde esté.
export const mensajeDeAyuda = (nombreModulo) =>
  `Vimos que en los últimos 30 días no usaron ${nombreModulo}. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí.`

// «Ofrecer ayuda con [módulo]»: abre una conversación de Soporte con el administrador de la óptica (una consulta «Iniciada por el soporte»), no un anuncio de
// una sola vía. Antes de enviarla se ve, como una muestra, cómo la recibirá el administrador.
export default function VentanaOfrecerAyuda({ modulo, optica, onEnviada, onCerrar }) {
  const [mensaje, setMensaje] = useState(() => mensajeDeAyuda(modulo.nombre))
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const Icono = ICONO_MODULO[modulo.id] || HandHelping
  const texto = mensaje.trim()

  const enviar = async (e) => {
    e.preventDefault()
    if (!texto || enviando) return
    setEnviando(true)
    setError("")
    const r = await ofrecerAyuda({ opticaId: optica.id, modulo: modulo.id, mensaje: texto })
    setEnviando(false)
    if (r.error) { setError(r.error); return }
    onEnviada?.({ ...r.datos, modulo, mensaje: texto })
  }

  return (
    <Cascaron
      titulo={`Ofrecer ayuda con ${modulo.nombre}`} subtitulo="El administrador la recibe en Soporte y puede responder." Icono={Icono} ancho="max-w-xl" onCerrar={() => !enviando && onCerrar()}
      formulario={{ onSubmit: enviar, autoComplete: "off" }}
      pie={<>
        <span className="text-xs text-slate-500">Si dice que no usa este módulo, no se le vuelve a ofrecer ayuda.</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} disabled={enviando} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={!texto || enviando} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer disabled:opacity-60">
            <Send size={14} aria-hidden="true" /> {enviando ? "Enviando…" : "Enviar a la óptica"}
          </button>
        </div>
      </>}
    >
      <div className="space-y-4 p-5">
        <div>
          <label htmlFor="mensaje-ayuda" className="mb-1.5 block text-sm font-semibold text-slate-700">Mensaje para el administrador</label>
          <textarea id="mensaje-ayuda" rows={5} value={mensaje} maxLength={LIMITE_MENSAJE} onChange={(e) => setMensaje(e.target.value)} className={CAMPO} autoFocus />
          <ContadorMensaje valor={mensaje} />
        </div>

        <VistaPrevia leyenda="Así lo verá el administrador">
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}><MessageSquare size={15} className="text-slate-500" aria-hidden="true" /> El soporte te ofrece ayuda con {modulo.nombre}</p>
            <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">{texto || "Escribe tu mensaje…"}</p>
            {/* Los tres botones que verá: aquí son de muestra (atenuados, sin efecto) */}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <BotonDeMuestra principal><BookOpen size={13} aria-hidden="true" /> Ver la guía de {modulo.nombre}</BotonDeMuestra>
                <BotonDeMuestra><MessageSquare size={13} aria-hidden="true" /> Responder</BotonDeMuestra>
                <BotonDeMuestra>No usamos este módulo</BotonDeMuestra>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Botones de muestra: el administrador podrá usarlos.</p>
            </div>
          </div>
        </VistaPrevia>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
