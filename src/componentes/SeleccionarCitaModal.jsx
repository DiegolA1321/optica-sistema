"use client"

import { CalendarClock, Stethoscope, ChevronRight, Activity } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "./AtencionPaciente"

// Paso previo a "Atender ahora" desde la lista de pacientes del paciente (pedido del ing,
// reunión 29 sept.): si tiene citas pendientes o en atención, hay que elegir
// cuál se está atendiendo en vez de abrir la ficha sin vínculo. Al elegir una,
// el llamador la pasa como citaIdInicial a ConsultaMedica.jsx — mismo camino
// que "Atender" desde Citas médicas (motivo precargado, estado a "En
// Atención", cita_id guardado con la consulta). Ventana estándar (regla 43).
export default function SeleccionarCitaModal({ paciente, citas, onSeleccionar, onAbrirSinCita, onCerrar }) {
  return (
    <Cascaron
      titulo="¿Qué cita vas a atender?"
      subtitulo={`${paciente} tiene ${citas.length === 1 ? "una cita" : `${citas.length} citas`} sin terminar. Elige una para atenderla.`}
      Icono={CalendarClock}
      ancho="max-w-md"
      capa="z-[70]"
      onCerrar={onCerrar}
      pie={<>
        <button type="button" onClick={onAbrirSinCita} className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-700 cursor-pointer">Es otra visita: atender ahora</button>
        <button type="button" onClick={onCerrar} className="ml-auto rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
      </>}
    >
      <div className="space-y-2 p-6">
        {citas.map((cita) => (
          <button
            key={cita.id}
            type="button"
            onClick={() => onSeleccionar(cita.id)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5 text-left transition-colors hover:border-blue-200/60 hover:bg-blue-50/60 cursor-pointer"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold" style={{ color: INK }}>{cita.fechaEtiqueta}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-sm text-slate-600">{cita.horaEtiqueta}</span>
                {cita.estado === "En Atención" && (
                  <span className="flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-50 px-2 py-0.5 text-[12px] font-semibold text-blue-600">
                    <Activity size={10} /> En atención
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                <Stethoscope size={12} className="shrink-0" />
                <span className="truncate">{cita.motivo || "Sin motivo especificado"}</span>
              </div>
            </div>
            <ChevronRight size={18} className="shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
    </Cascaron>
  )
}
