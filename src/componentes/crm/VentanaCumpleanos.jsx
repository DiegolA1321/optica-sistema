"use client"

import { Gift } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { BOTON_CERRAR } from "../ventas/estilos"
import { enDias } from "../../utilidades/crmResumen"
import { formatoFecha } from "../../utilidades/formatoFecha"

// Los próximos cumpleaños de los pacientes (la lista de la tarjeta «Próximo cumpleaños»): del más cercano al más lejano, con la fecha y los días que faltan.
export default function VentanaCumpleanos({ cumpleanos, onVerPerfil, onCerrar }) {
  return (
    <Cascaron titulo="Próximos cumpleaños" subtitulo="Del más cercano al más lejano" Icono={Gift} ancho="max-w-md" onCerrar={onCerrar}
      pie={<><span /><button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button></>}>
      {cumpleanos.length === 0 ? (
        <p className="px-5 py-6 text-sm text-slate-500">Ningún paciente tiene su fecha de nacimiento registrada todavía.</p>
      ) : (
        <ul aria-label="Próximos cumpleaños" className="divide-y divide-slate-100 px-5">
          {cumpleanos.map(({ paciente, dias, fecha }) => (
            <li key={paciente.id} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{paciente.nombre}</p>
                <p className="text-xs text-slate-500">{formatoFecha(fecha, "medioSinAnio")} · {enDias(dias)}</p>
              </div>
              {onVerPerfil && <button type="button" onClick={() => onVerPerfil(paciente.id)} aria-label={`Ver el perfil de ${paciente.nombre}`} className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver perfil</button>}
            </li>
          ))}
        </ul>
      )}
    </Cascaron>
  )
}
