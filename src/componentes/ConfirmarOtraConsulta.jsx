"use client"

import { Stethoscope } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"
import { TEXTO_OTRA_CONSULTA } from "../utilidades/atencionDeHoy"

// La confirmación explícita antes de registrar una SEGUNDA consulta el mismo día: «Atender» continúa la atención de hoy; solo aquí se crea otra.
export default function ConfirmarOtraConsulta({ paciente, onConfirmar, onCerrar }) {
  return (
    <Cascaron titulo="Este paciente ya se atendió hoy" subtitulo={paciente?.nombre} Icono={Stethoscope} ancho="max-w-md" etiqueta="Otra consulta hoy" onCerrar={onCerrar}
      pie={<><span /><div className="flex items-center gap-2">
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
        <button type="button" onClick={onConfirmar} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Sí, registrar otra consulta</button>
      </div></>}>
      <p className="px-5 py-4 text-[15px] text-slate-700">{TEXTO_OTRA_CONSULTA}</p>
    </Cascaron>
  )
}
