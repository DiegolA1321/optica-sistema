"use client"

import { Ruler, MessageCircle, Check, CalendarPlus } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"
import { formatoFecha } from "../utilidades/formatoFecha"
import { medidaConUnidad } from "../utilidades/medidasMontaje"

// «Atender» el aviso de que el paciente pidió sus medidas de montaje desde el portal. La óptica la responde de una de dos maneras (el paciente lo ve en su portal): enviarle la distancia pupilar
// y la altura que ya existen (por WhatsApp con la ventana única de Contactar y/o marcándolas como enviadas) o, si faltan, agendarle una cita para tomarlas.
export default function MedidasPedidasModal({ paciente, solicitadaEn, medidas, puedeEscribirWhatsApp, onWhatsApp, onMarcarEnviadas, onAgendar, ocupado, onCerrar }) {
  const opcion = "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
  return (
    <Cascaron titulo="Medidas de montaje pedidas" subtitulo={paciente?.nombre} Icono={Ruler} ancho="max-w-md" onCerrar={onCerrar}
      pie={<><span /><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}
    >
      <div className="space-y-4 p-6">
        <p className="text-sm text-slate-700">Este paciente pidió sus medidas el {formatoFecha(solicitadaEn, "largoSinDia")}.</p>
        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm">
          <div><dt className="text-xs font-semibold text-slate-500">Distancia pupilar</dt><dd className="mt-0.5 font-bold text-slate-800">{medidas.dp ? medidaConUnidad(medidas.dp) : "No registrada"}</dd></div>
          <div><dt className="text-xs font-semibold text-slate-500">Altura de montaje</dt><dd className="mt-0.5 font-bold text-slate-800">{medidas.altura ? medidaConUnidad(medidas.altura) : "No registrada"}</dd></div>
          {medidas.faltan && <p className="col-span-2 text-xs text-slate-600">Lo que falta se toma en la óptica (la altura se registra en el pedido).</p>}
        </dl>
        <div className="space-y-2">
          {medidas.hayAlgo && puedeEscribirWhatsApp && (
            <button type="button" onClick={onWhatsApp} className={opcion + " border-emerald-300 text-emerald-800 hover:bg-emerald-50"}><MessageCircle size={18} aria-hidden="true" /> Enviar por WhatsApp</button>
          )}
          {medidas.hayAlgo && (
            <button type="button" onClick={onMarcarEnviadas} disabled={ocupado} className={opcion + " border-blue-300 text-blue-800 hover:bg-blue-50"}><Check size={18} aria-hidden="true" /> Marcar como enviadas</button>
          )}
          {medidas.faltan && onAgendar && (
            <button type="button" onClick={onAgendar} disabled={ocupado} className={opcion + " border-blue-300 text-blue-800 hover:bg-blue-50"}><CalendarPlus size={18} aria-hidden="true" /> Agendar toma de medidas</button>
          )}
        </div>
      </div>
    </Cascaron>
  )
}
