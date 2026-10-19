"use client"

import { Ruler, MessageCircle, Check, CalendarPlus } from "lucide-react"
import { formatoFecha } from "../utilidades/formatoFecha"
import { medidaConUnidad } from "../utilidades/medidasMontaje"

// Aviso del perfil del paciente cuando pidió sus medidas de montaje desde el portal. La óptica la responde de una de dos maneras (el paciente lo ve en su portal):
// enviarle la distancia pupilar y la altura que ya existen (por WhatsApp y/o marcándolas como enviadas) o, si faltan, agendarle una cita para tomarlas.
export default function AvisoMedidasPedidas({ solicitadaEn, medidas, puedeEscribirWhatsApp, onWhatsApp, onMarcarEnviadas, onAgendar, ocupado }) {
  const boton = "inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
  return (
    <div role="region" aria-label="Medidas de montaje solicitadas" className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-blue-200/60 bg-blue-50 px-4 py-3 sm:px-8">
      <div className="flex min-w-0 items-start gap-2.5">
        <Ruler size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-800">Este paciente pidió sus medidas el {formatoFecha(solicitadaEn, "largoSinDia")}.</p>
          <p className="text-xs text-blue-700">
            Distancia pupilar: <b>{medidas.dp ? medidaConUnidad(medidas.dp) : "no registrada"}</b> · Altura de montaje: <b>{medidas.altura ? medidaConUnidad(medidas.altura) : "no registrada"}</b>
            {medidas.faltan && <span> · Lo que falta se toma en la óptica (la altura se registra en la orden de laboratorio).</span>}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {medidas.hayAlgo && puedeEscribirWhatsApp && (
          <button type="button" onClick={onWhatsApp} className={boton + " border-emerald-300 bg-white text-emerald-700 hover:bg-emerald-50"}><MessageCircle size={14} aria-hidden="true" /> Enviar por WhatsApp</button>
        )}
        {medidas.hayAlgo && (
          <button type="button" onClick={onMarcarEnviadas} disabled={ocupado} className={boton + " border-blue-300 bg-white text-blue-700 hover:bg-blue-100"}><Check size={14} aria-hidden="true" /> Marcar como enviadas</button>
        )}
        {medidas.faltan && onAgendar && (
          <button type="button" onClick={onAgendar} disabled={ocupado} className={boton + " border-blue-300 bg-white text-blue-700 hover:bg-blue-100"}><CalendarPlus size={14} aria-hidden="true" /> Agendar toma de medidas</button>
        )}
      </div>
    </div>
  )
}
